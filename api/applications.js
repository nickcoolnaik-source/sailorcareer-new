const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
 if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token)throw Error('Unauthorized');
  const user=await authUser(token), id=encodeURIComponent(user.id);
  const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,email,full_name,mobile,role,is_active`))?.[0];
  if(!p||p.role!=='seafarer'||!p.is_active)return res.status(403).json({error:'Seafarer access required'});
  if(req.method==='GET'){
   const rows=await sb(`/rest/v1/applications?seafarer_id=eq.${id}&select=id,job_id,status,note,created_at,updated_at&order=created_at.desc`);
   return res.json({applications:rows||[]});
  }
  const b=req.body||{};
  if(req.method==='POST'){
   if(!b.job_id||!String(b.job_id).match(/^[0-9a-f-]{36}$/i))return res.status(400).json({error:'Valid job_id is required'});
   const exists=await sb(`/rest/v1/applications?job_id=eq.${encodeURIComponent(b.job_id)}&seafarer_id=eq.${id}&select=id`);
   if(exists?.length)return res.status(409).json({error:'You already applied for this job'});
   const out=await sb('/rest/v1/applications',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({job_id:b.job_id,seafarer_id:user.id,status:'Applied',note:typeof b.note==='string'?b.note.trim().slice(0,2000):null})});
   return res.status(201).json({application:out?.[0]||out});
  }
  const appId=String(b.id||''); if(!/^[0-9a-f-]{36}$/i.test(appId))return res.status(400).json({error:'Valid application id is required'});
  const rows=await sb(`/rest/v1/applications?id=eq.${appId}&seafarer_id=eq.${id}&select=id,status`); if(!rows?.length)return res.status(404).json({error:'Application not found'});
  if(b.status==='Withdrawn'){const out=await sb(`/rest/v1/applications?id=eq.${appId}&seafarer_id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'Withdrawn',updated_at:new Date().toISOString()})});return res.json({application:out?.[0]||out});}
  return res.status(400).json({error:'Only withdrawal is allowed from the seafarer dashboard'});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Application request failed'});}
};
