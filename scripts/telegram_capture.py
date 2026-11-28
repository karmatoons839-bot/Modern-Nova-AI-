"""Real signed-out website captures. Run after a release; never accepts auth or arbitrary URLs."""
import argparse, asyncio, hashlib, json, re, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILES = ["src/lib/telegram-knowledge.ts", "src/lib/plans.ts", "src/lib/script-config.ts", "src/lib/help-faq.ts", "src/routes/story.tsx", "src/routes/studio.tsx", "src/components/ImageTool.tsx", "src/components/ThumbnailTool.tsx", "src/routes/tools.tsx", "src/lib/image-engine.server.ts", "src/lib/credits.server.ts", "src/components/VoiceBrowser.tsx", "src/routes/projects.tsx"]
PAGES = {"tools":"/tools", "story":"/story", "studio":"/studio", "image":"/image", "thumbnail":"/thumbnail", "auth":"/auth", "pricing":"/pricing", "help":"/help"}
def revision():
    return hashlib.sha256("".join(f + "\n" + (ROOT/f).read_text() for f in sorted(SOURCE_FILES)).encode()).hexdigest()

async def capture(args):
    manifest_path = ROOT/"src/data/telegram-captures.json"
    old = json.loads(manifest_path.read_text())
    version = re.search(r'KNOWLEDGE_VERSION = "([^"]+)"', (ROOT/"src/lib/telegram-knowledge.ts").read_text()).group(1)
    fingerprint = revision()
    if args.check:
        fresh = old.get("sourceRevision") == fingerprint and old.get("knowledgeVersion") == version
        print("Knowledge/capture revision current" if fresh else "ADMIN REVIEW REQUIRED: website source changed; inspect knowledge and recapture after deployment.")
        return 0 if fresh else 1
    from playwright.async_api import async_playwright
    out = Path(args.output or tempfile.mkdtemp(prefix="nova-capture-"))
    out.mkdir(parents=True, exist_ok=True)
    current = {"version":1,"knowledgeVersion":version,"sourceRevision":fingerprint,"capturedAt":datetime.now(timezone.utc).isoformat(),"pages":[],"review":[],"history":old.get("history", [])[-9:]}
    if old.get("capturedAt"):
        current["history"].append({"capturedAt":old["capturedAt"],"knowledgeVersion":old.get("knowledgeVersion"),"sourceRevision":old.get("sourceRevision"),"pages":old.get("pages",[])})
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width":1280,"height":1800}, reduced_motion="reduce")
        page = await context.new_page()
        for id, path in PAGES.items():
            try:
                response = await page.goto("https://modernnova.in"+path, wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(2000)
                await page.locator("h1").first.wait_for(timeout=15000)
                if not response or response.status != 200 or page.url.rstrip("/") != ("https://modernnova.in"+path).rstrip("/"):
                    raise ValueError("PAGE_REDIRECTED_OR_UNAVAILABLE")
                text = await page.locator("body").inner_text()
                if re.search(r"mnva_live_|sb_secret_|[\w.+-]+@[\w.-]+\.[a-z]{2,}", text, re.I) and id != "help":
                    raise ValueError("POTENTIAL_PRIVATE_CONTENT_REVIEW")
                # Public support contact is allowed; no authenticated cookie/storage is ever installed.
                file = out/f"{id}.jpg"
                await page.screenshot(path=str(file), type="jpeg", quality=82)
                asset = None
                if args.upload:
                    result = subprocess.run(["lovable-assets","create","--file",str(file),"--filename",f"telegram-help-{id}.jpg"],capture_output=True,text=True,check=True)
                    asset = json.loads(result.stdout)
                    pointer = ROOT/f"src/assets/telegram-help-{id}.jpg.asset.json"
                    pointer.write_text(json.dumps(asset,indent=2)+"\n")
                current["pages"].append({"id":id,"path":path,"sourceUrl":"https://modernnova.in"+path,"status":"captured" if asset else "review","assetPath":asset.get("url") if asset else None,"sha256":hashlib.sha256(file.read_bytes()).hexdigest(),"heading":await page.locator("h1").first.inner_text(),"capturedAt":current["capturedAt"]})
                print(id, "captured" if asset else "captured locally; publication/review required")
            except Exception:
                current["review"].append({"id":id,"reason":"CAPTURE_UNAVAILABLE_REVIEW_REQUIRED"})
                print(id,"ADMIN REVIEW REQUIRED")
        await browser.close()
    for id in ["settings","history","developer","telegram"]:
        current["review"].append({"id":id,"reason":"PRIVATE_OR_OWNER_PAGE_NOT_PUBLICLY_CAPTURED"})
    current["review"].append({"id":"voices","reason":"CATALOG_INSPECTED_SEPARATELY_SCREENSHOT_NOT_CAPTURED"})
    current["knowledgeSnapshot"] = {f: (ROOT/f).read_text() for f in ["src/lib/telegram-knowledge.ts","src/lib/plans.ts","src/lib/script-config.ts"]}
    (out/"manifest.json").write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n")
    if args.upload:
        manifest_path.write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n")
    print("Public screenshots only; no tool generation, payment or account changes.")
    return 0

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true")
    parser.add_argument("--upload",action="store_true",help="Upload real captures via the project asset CLI and replace capture manifest")
    parser.add_argument("--output",help="Temporary output directory, outside the project")
    args=parser.parse_args()
    if args.output and (Path(args.output).resolve() == ROOT or ROOT in Path(args.output).resolve().parents):
        parser.error("Capture output must be outside the repository")
    raise SystemExit(asyncio.run(capture(args)))