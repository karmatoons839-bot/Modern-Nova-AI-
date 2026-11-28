from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
from pathlib import Path
import os, uuid, time

from .generator import generate_image

APP_NAME = os.getenv("APP_NAME", "Professional Text-to-Image API")
API_KEY = os.getenv("API_KEY", "")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "outputs"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=APP_NAME,
    version="1.0.0",
    description="Production-oriented text-to-image API for 2D, 3D, horror, moral-story and cinematic artwork.",
)

Style = Literal[
    "2d-animation", "3d-animation", "anime", "cartoon", "comic",
    "horror", "moral-story", "cinematic", "realistic", "fantasy",
    "storybook", "watercolor", "pixel-art", "custom"
]

class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=5000)
    negative_prompt: Optional[str] = Field(default=None, max_length=3000)
    style: Style = "2d-animation"
    width: int = Field(default=1024, ge=512, le=1536)
    height: int = Field(default=1024, ge=512, le=1536)
    steps: int = Field(default=30, ge=10, le=60)
    guidance_scale: float = Field(default=7.0, ge=1, le=20)
    seed: Optional[int] = None

def auth(x_api_key: Optional[str]):
    if not API_KEY:
        raise HTTPException(500, "API_KEY is not configured")
    if x_api_key != API_KEY:
        raise HTTPException(401, "Invalid API key")

@app.get("/health")
def health():
    return {"status": "ok", "service": APP_NAME, "version": "1.0.0"}

@app.post("/v1/images/generations")
def create_image(req: GenerateRequest, x_api_key: Optional[str] = Header(default=None)):
    auth(x_api_key)
    request_id = str(uuid.uuid4())
    started = time.time()

    path = generate_image(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        style=req.style,
        width=req.width,
        height=req.height,
        steps=req.steps,
        guidance_scale=req.guidance_scale,
        seed=req.seed,
        output_dir=OUTPUT_DIR,
    )

    return {
        "id": request_id,
        "object": "image.generation",
        "created": int(time.time()),
        "model": os.getenv("MODEL_ID", "configured-model"),
        "data": [{
            "url": f"/v1/images/{path.name}",
            "width": req.width,
            "height": req.height,
            "seed": req.seed
        }],
        "usage": {
            "generation_time_seconds": round(time.time() - started, 2),
            "steps": req.steps
        }
    }

@app.get("/v1/images/{filename}")
def get_image(filename: str, x_api_key: Optional[str] = Header(default=None)):
    auth(x_api_key)
    safe = Path(filename).name
    path = OUTPUT_DIR / safe
    if not path.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/png", filename=safe)
