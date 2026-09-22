const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
 if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token)throw Error('Unauthorized');
  const user=await authUser(token), id=encodeURIComponent(user.id);
  const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,email,full_name,mobile,role,is_active`))?.[0];
  if(!p||p.role!=='seafarer'||!p.is_active)return res.status(403).json({error:'Seafarer access required'});
  const subs=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&status=eq.active&select=id,status,amount,renews_at&order=created_at.desc&limit=1`);
  const isPro=Array.isArray(subs)&&subs.length>0;

  if(req.method==='GET'){
   const preview=new URL(req.url,`https://${req.headers.host||'sailorcareer.com'}`).searchParams.get('preview')==='1';
   if(!isPro&&!preview)return res.status(403).json({error:'Seafarer Pro subscription required for full application tracking.'});
   const rows=await sb(`/rest/v1/applications?seafarer_id=eq.${id}&select=id,job_id,job_reference,job_rank,job_vessel,job_company,job_location,job_contract,job_salary,status,created_at,updated_at&order=created_at.desc&limit=${preview?3:100}`);
   if(preview){
    return res.json({applications:(rows||[]).map(a=>({id:a.id,job_reference:a.job_reference,job_rank:a.job_rank,job_vessel:a.job_vessel,job_company:a.job_company,job_location:a.job_location,status:a.status,created_at:a.created_at,updated_at:a.updated_at}))});
   }
   return res.json({applications:rows||[]});
  }

  const b=req.body||{};
  if(req.method==='POST'){
   const jobId=b.job_id&&/^[0-9a-f-]{36}$/i.test(String(b.job_id))?String(b.job_id):null;
   const jobRef=String(b.job_reference||'').trim().slice(0,100);
   if(!jobId&&!jobRef)return res.status(400).json({error:'A valid job reference is required'});
   if(jobId){
    const exists=await sb(`/rest/v1/applications?job_id=eq.${encodeURIComponent(jobId)}&seafarer_id=eq.${id}&select=id`);
    if(exists?.length)return res.status(409).json({error:'You already applied for this job'});
   }else{
    const exists=await sb(`/rest/v1/applications?job_reference=eq.${encodeURIComponent(jobRef)}&seafarer_id=eq.${id}&select=id`);
    if(exists?.length)return res.status(409).json({error:'You already applied for this vacancy'});
   }
   const out=await sb('/rest/v1/applications',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({job_id:jobId,seafarer_id:user.id,job_reference:jobRef||null,job_rank:String(b.job_rank||'').slice(0,120),job_vessel:String(b.job_vessel||'').slice(0,120),job_company:String(b.job_company||'Participating Employer').slice(0,180),job_location:String(b.job_location||'').slice(0,120),job_contract:String(b.job_contract||'').slice(0,80),job_salary:String(b.job_salary||'').slice(0,120),status:'Applied',note:typeof b.note==='string'?b.note.trim().slice(0,2000):null})});
   return res.status(201).json({application:out?.[0]||out,isPro});
  }

  if(!isPro)return res.status(403).json({error:'Seafarer Pro subscription required for application management.'});
  const appId=String(b.id||''); if(!/^[0-9a-f-]{36}$/i.test(appId))return res.status(400).json({error:'Valid application id is required'});
  const rows=await sb(`/rest/v1/applications?id=eq.${appId}&seafarer_id=eq.${id}&select=id,status`); if(!rows?.length)return res.status(404).json({error:'Application not found'});
  if(b.status==='Withdrawn'){const out=await sb(`/rest/v1/applications?id=eq.${appId}&seafarer_id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'Withdrawn',updated_at:new Date().toISOString()})});return res.json({application:out?.[0]||out});}
  return res.status(400).json({error:'Only withdrawal is allowed from the seafarer dashboard'});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Application request failed'});}
};
