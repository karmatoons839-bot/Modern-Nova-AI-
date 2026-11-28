import os, uuid, time
from pathlib import Path
from typing import Optional, Literal
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from .generator import generate_thumbnail

API_KEY=os.getenv("API_KEY","")
OUTPUT_DIR=Path(os.getenv("OUTPUT_DIR","outputs")); OUTPUT_DIR.mkdir(exist_ok=True)
app=FastAPI(title="Professional Text-to-Thumbnail API",version="1.0.0")

class Request(BaseModel):
    prompt:str=Field(min_length=3,max_length=5000)
    style:Literal["youtube","horror","story","moral-story","gaming","cinematic","kids","news","custom"]="youtube"
    width:int=Field(default=1280,ge=640,le=1536)
    height:int=Field(default=720,ge=360,le=1024)
    seed:Optional[int]=None

def auth(key):
    if not API_KEY or key!=API_KEY: raise HTTPException(401,"Invalid API key")

@app.get("/health")
def health(): return {"status":"ok","service":"Professional Text-to-Thumbnail API"}

@app.post("/v1/thumbnails/generations")
def generate(req:Request,x_api_key:Optional[str]=Header(None)):
    auth(x_api_key)
    started=time.time()
    path,seed=generate_thumbnail(req.prompt,req.style,req.width,req.height,req.seed,OUTPUT_DIR)
    return {"id":str(uuid.uuid4()),"object":"thumbnail.generation",
            "data":[{"url":f"/v1/thumbnails/{path.name}","width":req.width,"height":req.height,"seed":seed}],
            "usage":{"generation_time_seconds":round(time.time()-started,2)}}

@app.get("/v1/thumbnails/{filename}")
def image(filename:str,x_api_key:Optional[str]=Header(None)):
    auth(x_api_key)
    path=OUTPUT_DIR/Path(filename).name
    if not path.exists(): raise HTTPException(404,"Thumbnail not found")
    return FileResponse(path,media_type="image/png",filename=path.name)
