import { createFileRoute } from '@tanstack/react-router';
import { CreditError, creditErrorResponse, requireUser } from '@/lib/credits.server';
import { MAX_STORY_CHARS } from '@/lib/story-processing';

// Ordered full-track export. No debit: dialogue requests were already charged.
export const Route = createFileRoute('/api/voice-full')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    let user;
    try { user = await requireUser(request); }
    catch (e) { if (e instanceof CreditError) return creditErrorResponse(e); throw e; }
    const form = await request.formData().catch(() => null);
    const file = form?.get('audio');
    const script = String(form?.get('script') ?? '');
    if (script.length > MAX_STORY_CHARS * 2) return Response.json({success:false,message:'Export script processing limit reached. Your audio has not been changed.'},{status:413});
    const title = String(form?.get('title') ?? 'Voice Studio').slice(0, 200);
    const existingId = String(form?.get('generationId') ?? '');
    if (!(file instanceof Blob) || file.size < 100 || file.size > 60 * 1024 * 1024) return Response.json({success:false,message:'Invalid audio.'},{status:400});
    const bytes = new Uint8Array(await file.arrayBuffer());
    const wav = String.fromCharCode(...bytes.slice(0,4)) === 'RIFF';
    const mp3 = String.fromCharCode(...bytes.slice(0,3)) === 'ID3' || (bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224);
    if (!wav && !mp3) return Response.json({success:false,message:'Only real WAV or MP3 audio is accepted.'},{status:400});
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const exportHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    let id = existingId;
    if (id) {
      const {data:row} = await supabaseAdmin.from('generations').select('id,output_path').eq('id',id).eq('user_id',user.id).eq('tool','voice_full').maybeSingle();
      if (!row) return Response.json({success:false,message:'Export not found.'},{status:404});
      if (row.output_path) return Response.json({success:true,id:row.id});
    } else {
      const {data:row,error} = await supabaseAdmin.from('generations').insert({user_id:user.id,tool:'voice_full',prompt:script,style:title,status:'pending',cost:0,voice_export_hash:exportHash}).select('id').single();
      if (error?.code === '23505') {
        const { data: prior } = await supabaseAdmin.from('generations').select('id,output_path,status').eq('user_id',user.id).eq('tool','voice_full').eq('voice_export_hash',exportHash).maybeSingle();
        if (!prior) return Response.json({success:false,message:'Could not recover the existing export.'},{status:500});
        if (prior.output_path && prior.status === 'done') return Response.json({success:true,id:prior.id});
        id = prior.id;
      } else {
        if (error || !row) return Response.json({success:false,message:'Could not save to History.'},{status:500});
        id = row.id;
      }
    }
    const path = `${user.id}/${id}.${mp3 ? 'mp3' : 'wav'}`;
    const upload = await supabaseAdmin.storage.from('generations').upload(path,bytes,{contentType:mp3 ? 'audio/mpeg' : 'audio/wav',upsert:true});
    if (upload.error) {
      await supabaseAdmin.from('generations').update({status:'failed',error:'Audio upload failed.'}).eq('id',id).eq('user_id',user.id);
      return Response.json({success:false,id,message:'Audio is ready, but saving to History failed. Retry saving without regenerating dialogue.'},{status:500});
    }
    const {error} = await supabaseAdmin.from('generations').update({output_path:path,status:'done',completed_at:new Date().toISOString(),error:null}).eq('id',id).eq('user_id',user.id);
    if (error) return Response.json({success:false,id,message:'Audio uploaded but History could not be updated. Retry saving.'},{status:500});
    try {
      const { notifyUserById } = await import('@/lib/email-notify.server');
      await notifyUserById(user.id, 'generation-ready', { toolName: 'Voice Studio voiceover', title, url: 'https://modernnova.in/history' }, `voice-full-${id}`, 'generation');
    } catch (e) { console.error('Generation-ready email failed', e); }
    return Response.json({success:true,id});
  } } },
});
