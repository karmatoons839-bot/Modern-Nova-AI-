"""Project-owned FFmpeg service. Requires deployment; never imported by the web app."""
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import queue
import sqlite3
import subprocess
import threading
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 100 * 1024 * 1024

def safe_url(value, hosts):
    u = urllib.parse.urlsplit(value)
    if u.scheme != "https" or u.hostname not in hosts or u.username or u.password or u.port not in (None, 443):
        raise ValueError("Media source is not an approved HTTPS host")
    try:
        ipaddress.ip_address(u.hostname)
    except ValueError:
        return value
    raise ValueError("IP media sources are not allowed")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Media redirects are not allowed")

def download(url, path, hosts):
    safe_url(url, hosts)
    opener = urllib.request.build_opener(NoRedirect())
    total = 0
    with opener.open(url, timeout=30) as response, path.open("wb") as out:
        while True:
            chunk = response.read(65536)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_BYTES:
                raise ValueError("Media file exceeds the 100 MB limit")
            out.write(chunk)
    if total < 44:
        raise ValueError("Media file is empty")

def run(args):
    result = subprocess.run(args, capture_output=True, timeout=600, check=False)
    if result.returncode:
        raise ValueError("Media processing failed; verify input files and codecs")
    return result.stdout

def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)]))

def compose(clips, output, aspect, voice_on):
    if not clips:
        raise ValueError("No clips supplied")
    width, height = (720, 1280) if aspect == "9:16" else (1280, 720)
    rendered, spoken = [], []
    for i, clip in enumerate(clips):
        seconds = duration(clip["video"])
        audio_paths = clip.get("audio", []) if voice_on else []
        audio_seconds = sum(duration(a) for a in audio_paths)
        if audio_seconds > seconds + 0.1:
            raise ValueError("Dialogue exceeds scene duration; extend or split the scene before rendering")
        frame = output.parent / f"normalized-{i}.mp4"
        command = ["ffmpeg", "-y", "-v", "error", "-i", str(clip["video"])]
        if audio_paths:
            audio = output.parent / f"spoken-{i}.wav"
            inputs = []
            for a in audio_paths:
                inputs += ["-i", str(a)]
            labels = "".join(f"[{j}:a]" for j in range(len(audio_paths)))
            run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", f"{labels}concat=n={len(audio_paths)}:v=0:a=1[out]", "-map", "[out]", "-ar", "48000", "-ac", "2", str(audio)])
            command += ["-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad", "-c:a", "aac", "-ar", "48000", "-ac", "2"]
        else:
            command += ["-an"]
        command += ["-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "24", "-t", str(seconds), str(frame)]
        run(command)
        rendered.append(frame)
        spoken.append(audio_seconds)
    # In voice mode normalize silent scenes to the same audio layout before joining.
    if voice_on:
        for i, frame in enumerate(rendered):
            if not clips[i].get("audio"):
                silent = output.parent / f"silence-{i}.mp4"
                run(["ffmpeg", "-y", "-v", "error", "-i", str(frame), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-t", str(duration(frame)), str(silent)])
                rendered[i] = silent
    listing = output.parent / "concat.txt"
    listing.write_text("\n".join(f"file '{p.name}'" for p in rendered))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "1", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(output)])
    return {"seconds": duration(output), "voice_seconds": sum(spoken), "scene_voice_seconds": spoken}

def validate(body, hosts):
    uuid.UUID(body["id"])
    if body.get("aspect") not in ("9:16", "16:9") or not isinstance(body.get("voice_on"), bool):
        raise ValueError("Invalid video settings")
    clips = body.get("clips", [])
    if not 1 <= len(clips) <= 240:
        raise ValueError("Supply 1–240 clips")
    seconds = 0
    for clip in clips:
        safe_url(clip["video_url"], hosts)
        if clip.get("seconds") not in (5, 10):
            raise ValueError("Invalid clip duration")
        seconds += clip["seconds"]
        if len(clip.get("audio_urls", [])) > 40:
            raise ValueError("Too many dialogue files")
        for a in clip.get("audio_urls", []):
            safe_url(a, hosts)
    if seconds > int(os.environ.get("RENDERER_MAX_SECONDS", "1200")):
        raise ValueError("Duration exceeds render limit")
    return body

def serve():
    token = os.environ.get("RENDERER_TOKEN", "")
    hosts = set(filter(None, os.environ.get("RENDERER_MEDIA_HOSTS", "").split(",")))
    if len(token) < 32 or not hosts:
        raise RuntimeError("Configure a strong renderer token and exact media host allowlist")
    root = Path(os.environ.get("RENDERER_DATA", "/data"))
    root.mkdir(parents=True, exist_ok=True)
    database = root / "jobs.sqlite"
    def connect():
        con = sqlite3.connect(database, timeout=30)
        con.row_factory = sqlite3.Row
        return con
    with connect() as con:
        con.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, hash TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT)")
        con.execute("UPDATE jobs SET status='queued' WHERE status='running'")
    pending = queue.Queue()
    with connect() as con:
        for row in con.execute("SELECT id FROM jobs WHERE status='queued'"):
            pending.put(row["id"])
    def worker():
        while True:
            id = pending.get()
            try:
                with connect() as con:
                    row = con.execute("SELECT * FROM jobs WHERE id=? AND status='queued'", (id,)).fetchone()
                    if not row:
                        continue
                    con.execute("UPDATE jobs SET status='running' WHERE id=?", (id,))
                body = json.loads(row["body"])
                folder = root / id
                folder.mkdir(exist_ok=True)
                clips = []
                for i, c in enumerate(body["clips"]):
                    video = folder / f"source-{i}.mp4"
                    download(c["video_url"], video, hosts)
                    audio = []
                    if body["voice_on"]:
                        for j, url in enumerate(c.get("audio_urls", [])):
                            path = folder / f"audio-{i}-{j}.bin"
                            download(url, path, hosts)
                            audio.append(path)
                    clips.append({"video": video, "audio": audio})
                result = compose(clips, folder / "final.mp4", body["aspect"], body["voice_on"])
                with connect() as con:
                    con.execute("UPDATE jobs SET status='completed',result=? WHERE id=?", (json.dumps(result), id))
            except Exception as e:
                with connect() as con:
                    con.execute("UPDATE jobs SET status='failed',error=? WHERE id=?", (str(e)[:500], id))
            finally:
                pending.task_done()
    threading.Thread(target=worker, daemon=True).start()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass  # Signed media URLs and authorization must never appear in access logs.
        def reply(self, status, data):
            raw = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        def authorized(self):
            return hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token)
        def do_POST(self):
            if not self.authorized():
                return self.reply(401, {"error": "Unauthorized"})
            if self.path != "/jobs":
                return self.reply(404, {"error": "Not found"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size < 2 * 1024 * 1024:
                    raise ValueError("Invalid body size")
                body = validate(json.loads(self.rfile.read(size)), hosts)
                raw = json.dumps(body, sort_keys=True)
                digest = hashlib.sha256(raw.encode()).hexdigest()
                with connect() as con:
                    existing = con.execute("SELECT hash,status FROM jobs WHERE id=?", (body["id"],)).fetchone()
                    if existing:
                        if existing["hash"] != digest:
                            return self.reply(409, {"error": "Job payload changed"})
                        return self.reply(200, {"id": body["id"], "status": existing["status"]})
                    count = con.execute("SELECT count(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]
                    if count >= 20:
                        return self.reply(429, {"error": "Renderer queue is full"})
                    con.execute("INSERT INTO jobs(id,hash,body,status) VALUES(?,?,?,'queued')", (body["id"], digest, raw))
                pending.put(body["id"])
                self.reply(202, {"id": body["id"], "status": "queued"})
            except Exception:
                self.reply(400, {"error": "Invalid render request"})
        def do_GET(self):
            if not self.authorized():
                return self.reply(401, {"error": "Unauthorized"})
            parts = urllib.parse.urlsplit(self.path).path.strip("/").split("/")
            try:
                if len(parts) not in (2, 3) or parts[0] != "jobs":
                    raise ValueError()
                id = str(uuid.UUID(parts[1]))
                with connect() as con:
                    row = con.execute("SELECT status,result,error FROM jobs WHERE id=?", (id,)).fetchone()
                if not row:
                    return self.reply(404, {"error": "Not found"})
                if len(parts) == 2:
                    return self.reply(200, {"id": id, "status": row["status"], "result": json.loads(row["result"]) if row["result"] else None, "error": row["error"]})
                if parts[2] != "file" or row["status"] != "completed":
                    return self.reply(409, {"error": "Video not ready"})
                path = root / id / "final.mp4"
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(path.stat().st_size))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with path.open("rb") as f:
                    while chunk := f.read(65536):
                        self.wfile.write(chunk)
            except Exception:
                self.reply(404, {"error": "Not found"})
    ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()

if __name__ == "__main__":
    serve()