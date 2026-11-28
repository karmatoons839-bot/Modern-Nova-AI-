import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ownedImagePath, renderOperationKey } from "./s2v-render-safety";
import { studioSchema, studioQuote } from "./s2v-studio";
import { continuationKey } from "./s2v-timing";

const user="11111111-1111-4111-8111-111111111111",project="22222222-2222-4222-8222-222222222222";
const path=`${user}/s2v/${project}/final-r0-test.mp4`;
async function database(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage;
  CREATE TABLE public.profiles(id uuid PRIMARY KEY,credits integer);
  CREATE TABLE public.s2v_settings(id integer,price_render integer,enabled boolean,max_scenes integer DEFAULT 40);
  CREATE TABLE public.s2v_projects(id uuid PRIMARY KEY,user_id uuid,title text,studio_data jsonb,final_video_path text,generation_id uuid,status text,stage text,updated_at timestamptz);
  CREATE TABLE public.generations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,cost integer,output_path text,status text DEFAULT 'pending');
  CREATE TABLE public.s2v_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,user_id uuid,operation_key text,kind text,target integer,cost integer,input jsonb,generation_id uuid,status text,output_path text,UNIQUE(project_id,operation_key));
  CREATE TABLE storage.objects(bucket_id text,name text,metadata jsonb);
  CREATE FUNCTION public.spend_credits(u uuid,tool text,c integer,title text,kind text) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE g uuid; BEGIN UPDATE public.profiles SET credits=credits-c WHERE id=u; INSERT INTO public.generations(user_id,cost) VALUES(u,c) RETURNING id INTO g; RETURN g; END $$;
  CREATE FUNCTION public.finish_generation(g uuid,ok boolean,e text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF e='fail-settlement' THEN RAISE EXCEPTION 'failure'; END IF; UPDATE public.generations SET status='done' WHERE id=g; END $$;
  INSERT INTO public.profiles VALUES('${user}',27951);
  INSERT INTO public.s2v_settings(id,price_render,enabled) VALUES(1,75,true);
  INSERT INTO public.s2v_projects(id,user_id,title,studio_data) VALUES('${project}','${user}','Test','{"revision":0,"scenes":[{}]}');`);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0028_s2v_atomic_render_and_owned_reuse.sql",import.meta.url),"utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0026_s2v_studio_open_and_scenes.sql",import.meta.url),"utf8"));
  return db;
}
async function finish(db:PGlite,key="key",file=path,cost=75){return db.query("select public.s2v_finalize_render($1,$2,$3,0,$4,$5,$6::jsonb,$7::jsonb) as result",[project,user,key,cost,file,JSON.stringify([`${user}/clip.mp4`]),JSON.stringify([null])]);}
async function balance(db:PGlite){return (await db.query<{credits:number}>("select credits from public.profiles")).rows[0]?.credits;}
describe("Controlled studio safety without real credits",()=>{
  it("20 duplicate additional-video confirmations deduct 1500 only once",async()=>{const db=await database();try{const key=continuationKey(studioSchema.parse({}),0,1,"clip","voice");const results=await Promise.all(Array.from({length:20},()=>db.query("select s2v_queue_task($1,$2,$3,'animation',1000,1500,'{\"seconds\":10}') as id",[project,user,key])));assert.equal(new Set(results.map(r=>JSON.stringify(r.rows))).size,1);assert.equal(await balance(db),26451);}finally{await db.close();}});
  it("grouped moving clips retain one scene and charge render once",async()=>{const db=await database();try{await db.query("insert into storage.objects values('generations',$1,'{\"size\":2000}')",[path]);const run=()=>db.query("select s2v_finalize_render($1,$2,'grouped',0,75,$3,$4::jsonb,$5::jsonb)",[project,user,path,JSON.stringify([[`${user}/clip.mp4`,`${user}/extra.mp4`]]),JSON.stringify([`${user}/voice.wav`])]);await run();await run();assert.equal(await balance(db),27876);}finally{await db.close();}});
  it("one 5s clip + voice + render costs exactly 857",()=>assert.equal(studioQuote({backgrounds:0,characters:0,frames:0,clips:1,clipSeconds:5,voiceOn:true,voiceSeconds:5,render:true}).total,857));
  it("same sources have stable render key; new clip has different key",async()=>{const d=studioSchema.parse({});assert.equal(await renderOperationKey(d,["a"],["v"]),await renderOperationKey(d,["a"],["v"]));assert.notEqual(await renderOperationKey(d,["a"],["v"]),await renderOperationKey(d,["b"],["v"]));});
  it("wrong owner image is refused",()=>{assert.equal(ownedImagePath(user,`${user}/scene.jpg`),true);assert.equal(ownedImagePath(user,"another/scene.jpg"),false);assert.equal(ownedImagePath(user,`${user}/../scene.jpg`),false);});
  it("duplicate finalized render deducts 75 only once",async()=>{const db=await database();try{await db.query("insert into storage.objects values('generations',$1,'{\"size\":2000}')",[path]);await finish(db);await finish(db);assert.equal(await balance(db),27876);assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.generations")).rows[0]?.count,1);}finally{await db.close();}});
  it("missing upload never deducts 75",async()=>{const db=await database();try{await assert.rejects(finish(db),/UPLOAD_MISSING_NO_CHARGE/);assert.equal(await balance(db),27951);}finally{await db.close();}});
  it("failed settlement rolls back render deduction",async()=>{const db=await database();try{await db.query("insert into storage.objects values('generations',$1,'{\"size\":2000}')",[path]);await db.exec("CREATE OR REPLACE FUNCTION public.finish_generation(g uuid,ok boolean,e text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test settlement failed'; END $$;");await assert.rejects(finish(db),/test settlement failed/);assert.equal(await balance(db),27951);assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.s2v_tasks")).rows[0]?.count,0);}finally{await db.close();}});
  it("changed confirmed price cannot deduct credits",async()=>{const db=await database();try{await assert.rejects(finish(db,"key",path,74),/PRICE_CHANGED/);assert.equal(await balance(db),27951);}finally{await db.close();}});
  it("reuse own stored image is zero-cost and deduplicated",async()=>{const db=await database();try{const image=`${user}/scene.jpg`;await db.query("insert into storage.objects values('generations',$1,'{\"mimetype\":\"image/jpeg\"}')",[image]);const call=()=>db.query("select public.s2v_reuse_frame($1,$2,'frame-key',0,0,$3) as id",[project,user,image]);const first=await call(),second=await call();assert.deepEqual(first.rows,second.rows);assert.equal(await balance(db),27951);assert.equal((await db.query<{cost:number}>("select cost from public.s2v_tasks")).rows[0]?.cost,0);}finally{await db.close();}});
  it("another owner's stored image cannot be reused",async()=>{const db=await database();try{await assert.rejects(db.query("select public.s2v_reuse_frame($1,$2,'frame-key',0,0,'other/scene.jpg')",[project,user]),/SAVED_IMAGE_UNAVAILABLE/);assert.equal(await balance(db),27951);}finally{await db.close();}});
});