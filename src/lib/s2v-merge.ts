/** Browser-only ordered joiner. Full voice requires enough distinct generated moving clips. */
import { requireMovingCoverage } from "./s2v-timing";
export type MergeScene = { clipUrl: string; clipUrls?: string[]; audioUrl: string | null; seconds: number };

const RECYCLE_EVERY = 6;
export async function mediaDuration(url: string, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind);
    el.preload = "metadata"; el.crossOrigin = "anonymous";
    const done = (v: number | null) => { clearTimeout(timer); el.onloadedmetadata=null;el.onerror=null;el.removeAttribute("src");el.load(); if(v===null)reject(new Error("Could not measure saved media duration"));else resolve(v); };
    const timer = setTimeout(() => done(null), 20000);
    el.onloadedmetadata=()=>done(Number.isFinite(el.duration)&&el.duration>0?el.duration:null);
    el.onerror=()=>done(null);el.src=url;
  });
}

export async function mergeClips(scenes: MergeScene[], onProgress?: (msg: string) => void): Promise<Blob> {
  if(!scenes.length)throw new Error("No scenes to join");
  const info: {clipDur:number;voiceDur:number;urls:string[]}[]=[];
  onProgress?.("Checking moving-video coverage…");
  for(const [i,s] of scenes.entries()) {
    const urls=s.clipUrls??[s.clipUrl];
    if(new Set(urls).size!==urls.length)throw new Error("Repeated clips cannot replace additional video");
    let clipDur=0;for(const url of urls)clipDur+=await mediaDuration(url,"video");
    const voiceDur=s.audioUrl?await mediaDuration(s.audioUrl,"audio"):0;
    requireMovingCoverage(clipDur,voiceDur,i);info.push({clipDur,voiceDur,urls});
  }
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
  onProgress?.("Loading video joiner…");
  const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
  let logBuf = "";
  const boot = async () => {
    const f = new FFmpeg();
    f.on("log", ({ message }) => { logBuf += message + "\n"; });
    await f.load({ coreURL, wasmURL });
    return f;
  };
  let ffmpeg = await boot();

  const normalise = info.some(s => s.urls.length > 1);
  const venc = ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-video_track_timescale", "12288"];
  let vf = "";

  const parts: Uint8Array[] = [];
  for (let i = 0; i < scenes.length; i++) {
    if (i > 0 && i % RECYCLE_EVERY === 0) { ffmpeg.terminate(); ffmpeg = await boot(); }
    const s = scenes[i];if(!s)throw new Error("Scene unavailable");
    const measured=info[i];if(!measured)throw new Error("Scene duration unavailable");const {clipDur,voiceDur,urls}=measured;
    const len = urls.length > 1 && s.audioUrl ? voiceDur : Math.max(clipDur,voiceDur);
    onProgress?.(`Adding moving clips and voice to scene ${i+1} of ${scenes.length}…`);
    if(urls.length===1)await ffmpeg.writeFile("c.mp4",await fetchFile(urls[0]??s.clipUrl));
    else {
      for(const [j,url] of urls.entries()) {
        await ffmpeg.writeFile(`raw${j}.mp4`,await fetchFile(url));
        if(j===0){logBuf="";await ffmpeg.exec(["-hide_banner","-i","raw0.mp4"]);const dimensions=/Video:.*?(\d{2,5})x(\d{2,5})/.exec(logBuf);if(!dimensions)throw new Error("Could not verify clip dimensions");vf=`scale=${Number(dimensions[1]) & ~1}:${Number(dimensions[2]) & ~1},setsar=1,fps=24`;}
        const code=await ffmpeg.exec(["-y","-i",`raw${j}.mp4`,"-an","-vf",vf,...venc,`part${j}.mp4`]);
        if(code!==0)throw new Error(`Could not prepare additional shot ${j+1}`);
      }
      await ffmpeg.writeFile("parts.txt",urls.map((_,j)=>`file 'part${j}.mp4'`).join("\n"));
      const joined=await ffmpeg.exec(["-y","-f","concat","-safe","0","-i","parts.txt","-an","-c:v","copy","c.mp4"]);
      if(joined!==0)throw new Error(`Could not join additional clips for scene ${i+1}`);
    }
    if (normalise && i === 0) {
      logBuf = "";
      await ffmpeg.exec(["-hide_banner", "-i", "c.mp4"]);
      const v = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(logBuf);
      const f = /(\d+(?:\.\d+)?) fps/.exec(logBuf);
      vf = `${v ? `scale=${Number(v[1]) & ~1}:${Number(v[2]) & ~1},setsar=1,` : ""}fps=${f ? Number(f[1]) || 24 : 24}`;
    }
    let audioIn = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
    if (s.audioUrl) {
      const ext = (s.audioUrl.split("?")[0]??"").split(".").pop() || "wav";
      await ffmpeg.writeFile(`a.${ext}`, await fetchFile(s.audioUrl));
      audioIn = ["-i", `a.${ext}`];
    }
    const video = normalise
      ? ["-vf", vf, ...venc]
      : ["-c:v", "copy"];
    // Automatic sound design: soft ambience bed plus a short transition whoosh, mixed under the voice.
    const fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
    const sfx = ["-f", "lavfi", "-i", "anoisesrc=r=48000:color=brown:amplitude=0.5", "-f", "lavfi", "-i", "anoisesrc=r=48000:color=pink:amplitude=0.8:d=0.7"];
    const mix = `[1:a]${fmt},apad[v];[2:a]lowpass=f=500,volume=0.06,${fmt}[amb];[3:a]highpass=f=900,afade=t=in:d=0.25,afade=t=out:st=0.3:d=0.4,volume=0.22,${fmt},apad[wh];[v][amb][wh]amix=inputs=3:duration=first:normalize=0[aout]`;
    const code = await ffmpeg.exec(["-y", "-i", "c.mp4", ...audioIn, ...sfx, "-filter_complex", mix, "-map", "0:v:0", "-map", "[aout]", ...video,
      "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", len.toFixed(3), "s.mp4"]);
    if (code !== 0) throw new Error(`Could not add audio to scene ${i + 1}.`);
    parts.push((await ffmpeg.readFile("s.mp4")) as Uint8Array);
    for (const f of await ffmpeg.listDir(".")) if (!f.isDir) await ffmpeg.deleteFile(f.name);
  }

  onProgress?.("Joining scenes…");
  ffmpeg.terminate();
  ffmpeg = await boot();
  for (let i = 0; i < parts.length; i++) await ffmpeg.writeFile(`s${i}.mp4`, parts[i]??new Uint8Array());
  parts.length = 0;
  await ffmpeg.writeFile("list.txt", scenes.map((_, i) => `file 's${i}.mp4'`).join("\n"));
  let code = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart", "out.mp4"]);
  if (code !== 0 && !normalise) {
    onProgress?.("Re-encoding scenes to match…");
    code = await ffmpeg.exec(["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", ...venc, "-c:a", "aac", "out.mp4"]);
  }
  if (code !== 0) throw new Error("Could not join the scenes on this device.");
  const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
  ffmpeg.terminate();
  if (data.byteLength < 1000) throw new Error("The joined video is empty.");
  return new Blob([data.slice().buffer], { type: "video/mp4" });
}
