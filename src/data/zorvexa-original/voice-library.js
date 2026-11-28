/** Zorvexa 400 Voice Library API. Catalog only; no fake audio. */
const fs=require('fs'); const path=require('path');
const catalog=JSON.parse(fs.readFileSync(path.join(process.cwd(),'api','voices.json'),'utf8'));
function send(res,status,body){res.status(status).setHeader('Content-Type','application/json');return res.end(JSON.stringify(body));}
module.exports=async function handler(req,res){
 try{
  if((req.method||'GET')!=='GET') return send(res,405,{success:false,error:'METHOD_NOT_ALLOWED'});
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  const voiceId=u.searchParams.get('voiceId'), search=(u.searchParams.get('search')||'').toLowerCase();
  const age=u.searchParams.get('age'), gender=u.searchParams.get('gender'), language=u.searchParams.get('language'), emotion=u.searchParams.get('emotion');
  let list=catalog.voices;
  if(voiceId){const v=list.find(x=>x.voiceId===voiceId);return v?send(res,200,{success:true,api:'Zorvexa Voice Library',voice:v}):send(res,404,{success:false,error:'VOICE_NOT_FOUND'});}
  if(search) list=list.filter(v=>Object.values(v).some(x=>String(x).toLowerCase().includes(search)));
  if(age){const n=Number(age);if(!Number.isInteger(n)||n<6||n>80)return send(res,400,{success:false,error:'AGE_MUST_BE_BETWEEN_6_AND_80'});list=list.filter(v=>v.age===n);}
  if(gender) list=list.filter(v=>v.gender.toLowerCase()===gender.toLowerCase());
  if(language) list=list.filter(v=>v.language.toLowerCase()===language.toLowerCase());
  if(emotion) list=list.filter(v=>v.emotion.toLowerCase()===emotion.toLowerCase());
  const limit=Math.min(Math.max(Number(u.searchParams.get('limit')||50),1),200), page=Math.max(Number(u.searchParams.get('page')||1),1), total=list.length;
  const items=list.slice((page-1)*limit,page*limit);
  return send(res,200,{success:true,api:'Zorvexa Voice Library',total,page,limit,totalPages:Math.ceil(total/limit),ageRange:{min:6,max:80},voices:items});
 }catch(e){return send(res,500,{success:false,error:'VOICE_LIBRARY_ERROR',message:e.message});}
};
