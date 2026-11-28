import os, random
from pathlib import Path
from PIL import Image
import torch
from diffusers import StableDiffusionXLPipeline

_PIPE = None

STYLE_PROMPTS = {
    "2d-animation": "high-quality 2D animation illustration, clean line art, expressive characters, polished background",
    "3d-animation": "high-quality 3D animated film render, stylized characters, detailed materials, cinematic lighting",
    "anime": "premium anime illustration, detailed character design, cinematic composition",
    "cartoon": "professional cartoon illustration, clean shapes, expressive characters, polished colors",
    "comic": "cinematic comic-book illustration, strong composition, detailed ink and shading",
    "horror": "atmospheric horror animation art, eerie environment, suspenseful cinematic lighting, unsettling mood",
    "moral-story": "warm Indian moral-story animation illustration, expressive characters, storybook composition",
    "cinematic": "cinematic concept art, dramatic lighting, depth, highly detailed environment",
    "realistic": "photorealistic cinematic image, natural lighting, realistic materials",
    "fantasy": "epic fantasy illustration, cinematic environment, magical atmosphere",
    "storybook": "beautiful children's storybook illustration, polished hand-painted look",
    "watercolor": "detailed watercolor illustration, soft paper texture, artistic composition",
    "pixel-art": "high-quality pixel art, carefully composed scene, crisp pixels",
    "custom": ""
}

def get_pipe():
    global _PIPE
    if _PIPE is None:
        model_id = os.getenv("MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0")
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        _PIPE = StableDiffusionXLPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            use_safetensors=True
        )
        device = os.getenv("DEVICE", "cuda")
        if device == "cuda" and not torch.cuda.is_available():
            device = "cpu"
        _PIPE = _PIPE.to(device)
        if device == "cuda":
            _PIPE.enable_attention_slicing()
    return _PIPE

def generate_image(prompt, negative_prompt, style, width, height, steps, guidance_scale, seed, output_dir):
    pipe = get_pipe()
    style_prefix = STYLE_PROMPTS.get(style, "")
    full_prompt = f"{style_prefix}. {prompt}".strip()
    neg = negative_prompt or (
        "low quality, blurry, distorted anatomy, duplicate characters, bad hands, "
        "text, watermark, logo, cropped, oversaturated"
    )

    if seed is None:
        seed = random.randint(0, 2**32 - 1)

    device = pipe.device
    generator = torch.Generator(device=device).manual_seed(seed)
    image = pipe(
        prompt=full_prompt,
        negative_prompt=neg,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator
    ).images[0]

    name = f"{seed}_{os.urandom(4).hex()}.png"
    path = Path(output_dir) / name
    image.save(path, "PNG", optimize=True)
    return path
