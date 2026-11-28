import { editImage, generateImage, generateResponse, generateVideo, getVideo, downloadVideo, GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { findVoice, generateSpeech } from "./voice-engine.server";
import { userVoicePlan } from "./credits.server";
import { voiceAllowed } from "./plans";
import { studioSchema, studioSceneSchema, taskKey, type StudioData, type StudioRates } from "./s2v-studio";
import type { Json } from "@/integrations/supabase/types";

export async function studioRates(): Promise<StudioRates> {
  const { data, error } = await db.from("s2v_settings").select("*").eq("id",1).single();
  if (error || !data) throw new Error("Video settings unavailable");
  return { image: data.studio_image_price, character: data.studio_character_price, voicePerMinute: data.studio_voice_per_minute, anim5: data.price_anim_5, anim10: data.price_anim_10, render: data.price_render };
}
export async function studioText(instructions: string, input: string) {
  const r = await generateResponse({model:"openai/gpt-6-astra",instructions,input,reasoning:{effort:"medium"}});
  return r.output.filter(o => o.type === "message").flatMap(o => o.content).filter(c => c.type === "output_text").map(c => c.text).join("");
}
export async function analyzeStudio(script: string, d: StudioData, maxScenes: number) {
  const raw = await studioText(`Analyze the WHOLE story without rewriting or skipping dialogue. Identify every recurring location and visible character. Divide into meaningful ordered scenes; each must fit ${d.clipSeconds} seconds, allowing up to ${maxScenes} scenes. If the full story cannot fit this limit return {"error":"STORY_EXCEEDS_SCENE_LIMIT"}; never truncate it. Preserve all narration and dialogue in ${d.language}. Use English visual descriptions. Return only JSON {locations:[{name,description}],characters:[{name,description,gender:"Male"|"Female"|"Neutral"}],scenes:[{title,description,location:<zero-based location index>,characters:[<zero-based character indexes>],lines:[{speaker:<exact character name or Narrator>,text,emotion:"Calm"|"Happy"|"Sad"|"Angry"|"Scared"|"Suspense"}]}]}. Include complete full-body identity details (face,hair,age,clothing,colors). Visual style: ${d.style}.`,script);
  const start=raw.indexOf("{"), end=raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(start,end+1));
  if (parsed.error) throw new Error(String(parsed.error));
  const analysis = z.object({ locations: studioSchema.shape.locations, characters: studioSchema.shape.characters, scenes: z.array(studioSceneSchema).min(1).max(maxScenes) }).parse(parsed);
  for (const s of analysis.scenes) {
    if (!analysis.locations[s.location] || s.characters.some(i => !analysis.characters[i])) throw new Error("Analysis returned an invalid reference mapping");
  }
  return { ...d, ...analysis, analyzedRevision:d.revision };
}
export async function queueStudioTask(project: {id:string;user_id:string}, d: StudioData, kind: string, target: number, cost: number, input: Json, take=0) {
  const {data,error}=await db.rpc("s2v_queue_task",{_project:project.id,_user:project.user_id,_key:taskKey(d,kind,target,take),_kind:kind,_target:target,_cost:cost,_input:input});
  if(error) throw new Error(error.message); return data;
}
async function store(path:string, bytes:Uint8Array, contentType:string) {
  const {error}=await db.storage.from("generations").upload(path,bytes,{contentType,upsert:false});
  if(error) throw new Error(`Storage failed: ${error.message}`);
}
async function blob(path:string) { const {data,error}=await db.storage.from("generations").download(path);if(error||!data)throw new Error("Saved reference unavailable");return data; }
const remoteSchema=z.object({id:z.string(),status:z.enum(["queued","in_progress","completed","failed"]),error:z.object({message:z.string()}).optional()});
const taskInput=z.object({prompt:z.string().default(""),style:z.string().default(""),aspect:z.enum(["9:16","16:9"]).default("16:9"),seconds:z.union([z.literal(5),z.literal(10)]).default(5),refs:z.array(z.string()).default([]),voiceId:z.string().optional(),text:z.string().optional(),emotion:z.string().optional(),voiceOn:z.boolean().default(false)});

/** Independent tasks run in parallel; each keeps its atomic DB claim, persisted remote job and no automatic inference replay. */
export async function tickStudioTasks() {
  const {data: tasks,error}=await db.from("s2v_tasks").select("*").in("status",["queued","remote","running"]).neq("kind","render").order("updated_at").limit(16);
  if(error)throw error;
  await Promise.allSettled((tasks??[]).map(async t=>{
    const {data:p}=await db.from("s2v_projects").select("studio_data").eq("id",t.project_id).single();
    if(!p?.studio_data)return;
    const {data:pauses}=await db.from("s2v_tasks").select("id").eq("project_id",t.project_id).in("status",["paused","review"]).limit(1);
    if(pauses?.length)return;
    if(t.status==="running") { await db.rpc("s2v_claim_task",{_id:t.id}); return; }
    const input=taskInput.parse(t.input);
    const path=`${t.user_id}/s2v/${t.project_id}/${t.id}`;
    try {
      if(t.status==="remote") {
        if(!t.provider_job_id)throw new Error("Provider job ID missing");
        const remote=remoteSchema.parse(await getVideo(t.provider_job_id));
        if(remote.status==="failed") { await db.rpc("s2v_settle_task",{_id:t.id,_ok:false,_path:"",_error:remote.error?.message??"Animation failed"});return; }
        if(remote.status!=="completed")return;
        const content=await downloadVideo(t.provider_job_id);
        const videoBlob = await content.blob();
        const videoBuffer = await videoBlob.arrayBuffer();
        const b=new Uint8Array(videoBuffer);
        if(b.length<1000)throw new Error("Video output is empty");
        const existing=await db.storage.from("generations").list(`${t.user_id}/s2v/${t.project_id}`,{search:`${t.id}.mp4`});
        if(!existing.data?.some(f=>f.name===`${t.id}.mp4`))await store(`${path}.mp4`,b,"video/mp4");
        await db.rpc("s2v_settle_task",{_id:t.id,_ok:true,_path:`${path}.mp4`,_error:""});return;
      }
      const {data:claimed}=await db.rpc("s2v_claim_task",{_id:t.id});if(!claimed)return;
      if(t.kind==="animation") {
        const first=input.refs[0];if(!first)throw new Error("Scene image missing");
        const frame=new Uint8Array(await (await blob(first)).arrayBuffer());
        let encoded="";for(let i=0;i<frame.length;i++)encoded+=String.fromCharCode(frame[i]??0);
        const r=remoteSchema.parse(await generateVideo({model:"google/gemini-omni-1.1-flash",input:[{type:"text",text:`${input.style}. ${input.prompt}. Preserve the reference character identities. No generated speech; narration will be mixed separately.`},{type:"image",data:btoa(encoded),mime_type:"image/jpeg"}],response_format:{type:"video",resolution:"720p",duration:`${input.seconds}s`,aspect_ratio:input.aspect}}));
        await db.from("s2v_tasks").update({status:"remote",provider_job_id:r.id,lease_until:null,updated_at:new Date().toISOString()}).eq("id",t.id);
      } else if(t.kind==="voice") {
        if(!input.voiceOn) { await db.rpc("s2v_settle_task",{_id:t.id,_ok:false,_path:"",_error:"Voiceover OFF: no speech generated"});return; }
        const profile=findVoice(input.voiceId??"");if(!profile)throw new Error("Choose an available Voice Studio voice");
        if(!voiceAllowed(profile.voiceId,await userVoicePlan(t.user_id)))throw new Error("This voice is not included in your plan. Upgrade or choose another voice.");
        const r=await generateSpeech({profile,text:input.text??"",emotion:input.emotion??"Calm"});
        if(!r.ok) { const e=new Error(r.message);Object.assign(e,{httpStatus:r.status});throw e; }
        const b=new Uint8Array(await new Response(r.body).arrayBuffer());
        if(b.length<500)throw new Error("Voice output is empty");
        const ext=r.contentType.includes("mpeg")?"mp3":"wav";
        await store(`${path}.${ext}`,b,r.contentType);
        await db.rpc("s2v_settle_task",{_id:t.id,_ok:true,_path:`${path}.${ext}`,_error:""});
      } else if(["background","character","frame"].includes(t.kind)) {
        const prompt=`${input.style}. ${input.prompt}. No text or watermarks.`;
        const size=t.kind==="character"?"1024x1536":input.aspect==="9:16"?"1024x1536":"1536x1024";
        const images=[];for(const ref of input.refs)images.push(await blob(ref));
        const r=images.length?await editImage({model:"openai/gpt-image-2.5-sunburst",image:images,prompt,size,quality:"medium",output_format:"jpeg"}):await generateImage({model:"openai/gpt-image-2.5-sunburst",prompt,size,quality:"medium",output_format:"jpeg"});
        const encoded=r.data?.[0]?.b64_json;if(!encoded)throw new Error("Image engine returned no image");
        await store(`${path}.jpg`,Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),"image/jpeg");
        await db.rpc("s2v_settle_task",{_id:t.id,_ok:true,_path:`${path}.jpg`,_error:""});
      } else throw new Error("Renderer is not deployed; no final render was charged");
    } catch(e) {
      const message=e instanceof Error?e.message:"Generation failed";
      const status=e instanceof GatewayError?e.httpStatus:(e as {httpStatus?:number}).httpStatus;
      const uncertain=e instanceof GatewayError && (e.outcome==="unknown" || ["network_error","timeout"].includes(e.code));
      if(uncertain) await db.from("s2v_tasks").update({status:"review",error_message:message,updated_at:new Date().toISOString()}).eq("id",t.id);
      else { await db.rpc("s2v_settle_task",{_id:t.id,_ok:false,_path:"",_error:message});if(status===402||status===403||status===429)await db.from("s2v_tasks").update({status:"paused",error_message:message}).eq("id",t.id); }
    }
  }));
  return {processed:tasks?.length??0};
}