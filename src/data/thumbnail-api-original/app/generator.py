import os,random,torch
from pathlib import Path
from diffusers import StableDiffusionXLPipeline

PIPE=None
STYLES={
"youtube":"professional YouTube thumbnail, extremely strong visual hierarchy, cinematic composition, dramatic lighting, expressive subject, high contrast, clear focal point, polished creator thumbnail",
"horror":"professional horror YouTube thumbnail, terrifying atmosphere, dramatic cinematic lighting, suspense, expressive face, dark environment, strong focal point",
"story":"professional animated story thumbnail, expressive characters, cinematic scene, colorful polished environment, strong storytelling composition",
"moral-story":"professional family-friendly moral story thumbnail, expressive characters, colorful cinematic environment, clear storytelling",
"gaming":"professional gaming thumbnail, dynamic action, dramatic lighting, energetic composition, polished high-impact creator design",
"cinematic":"professional cinematic thumbnail, dramatic lighting, depth, premium composition, striking focal subject",
"kids":"professional colorful kids animation thumbnail, friendly expressive characters, bright polished environment, clear focal point",
"news":"professional editorial news thumbnail, clean composition, strong subject separation, dramatic but credible visual treatment",
"custom":"professional high-impact YouTube thumbnail, strong composition, cinematic lighting, clear focal point"
}

def pipe():
 global PIPE
 if PIPE is None:
  model=os.getenv("MODEL_ID","stabilityai/stable-diffusion-xl-base-1.0")
  dtype=torch.float16 if torch.cuda.is_available() else torch.float32
  PIPE=StableDiffusionXLPipeline.from_pretrained(model,torch_dtype=dtype,use_safetensors=True)
  device=os.getenv("DEVICE","cuda")
  if device=="cuda" and not torch.cuda.is_available(): device="cpu"
  PIPE=PIPE.to(device)
 return PIPE

def generate_thumbnail(prompt,style,w,h,seed,out):
 p=pipe()
 seed=seed if seed is not None else random.randint(0,2**32-1)
 enhanced=f"{STYLES.get(style,STYLES['custom'])}. Subject/story: {prompt}. No watermark, no logo, no random text, no distorted anatomy, no clutter."
 g=torch.Generator(device=p.device).manual_seed(seed)
 img=p(prompt=enhanced,negative_prompt="blurry, low quality, cluttered composition, duplicate subjects, distorted face, bad hands, watermark, logo, unreadable text, cropped subject",width=w,height=h,num_inference_steps=30,guidance_scale=7,generator=g).images[0]
 name=f"thumbnail_{seed}_{os.urandom(4).hex()}.png"; path=Path(out)/name
 img.save(path,"PNG",optimize=True)
 return path,seed
