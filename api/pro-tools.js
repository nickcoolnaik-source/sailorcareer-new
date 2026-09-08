const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
 if(!['GET','PUT','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();if(!token)throw new Error('Sign in required');
  const user=await authUser(token);const id=encodeURIComponent(user.id);
  const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,role,is_active&limit=1`))[0];
  if(!p||p.role!=='seafarer'||!p.is_active)return res.status(403).json({error:'Seafarer access required'});
  const sub=(await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&status=eq.active&select=id&order=created_at.desc&limit=1`))[0];
  if(!sub)return res.status(403).json({error:'Seafarer Pro subscription required'});
  if(req.method==='POST'){
   const b=req.body||{};const service=String(b.service_type||'').trim(),name=String(b.full_name||'').trim(),mobile=String(b.mobile||'').trim(),rank=String(b.rank||'').trim(),message=String(b.message||'').trim();
   if(!service||!name||!mobile||!message)return res.status(400).json({error:'Service, name, mobile and request are required'});
   await sb('/rest/v1/service_requests',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:user.id,service_type:service,full_name:name,mobile,rank:rank||null,message})});
   return res.status(201).json({message:'Service request submitted'});
  }
  if(req.method==='GET'){
   const sp=(await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}&select=availability_status,sea_service_records,certificate_expiries,service_interests&limit=1`))[0];
   return res.status(200).json({tools:{availability_status:sp?.availability_status||'available_30',sea_service_records:Array.isArray(sp?.sea_service_records)?sp.sea_service_records:[],certificate_expiries:Array.isArray(sp?.certificate_expiries)?sp.certificate_expiries:[],service_interests:Array.isArray(sp?.service_interests)?sp.service_interests:[]}});
  }
  const b=req.body||{};const cleanArr=v=>Array.isArray(v)?v.slice(0,100):[];
  const tools={availability_status:['available_now','available_30','available_60','onboard'].includes(b.availability_status)?b.availability_status:'available_30',sea_service_records:cleanArr(b.sea_service_records),certificate_expiries:cleanArr(b.certificate_expiries),service_interests:cleanArr(b.service_interests).filter(x=>typeof x==='string').slice(0,30)};
  await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...tools,updated_at:new Date().toISOString()})});
  return res.status(200).json({message:'Pro tools saved',tools});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Unable to load Pro tools'});}
};
