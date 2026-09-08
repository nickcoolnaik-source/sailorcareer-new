const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
 if(!['GET','PUT'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token)throw new Error('Unauthorized');
  const user=await authUser(token); const id=encodeURIComponent(user.id);
  const profiles=await sb(`/rest/v1/profiles?id=eq.${id}&select=id,email,full_name,mobile,role,is_active,created_at,updated_at`); const profile=profiles?.[0];
  if(!profile||profile.role!=='seafarer'||!profile.is_active)return res.status(403).json({error:'Seafarer access required'});
  if(req.method==='GET'){
   const sp=await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}&select=*`);
   const subs=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&select=plan,status,amount,currency,started_at,renews_at,created_at&order=created_at.desc&limit=5`);
   return res.status(200).json({profile,seafarer:sp?.[0]||null,subscriptions:subs||[]});
  }
  const b=req.body||{}, clean=v=>typeof v==='string'?v.trim():v;
  if(!clean(b.full_name))return res.status(400).json({error:'Full name is required'});
  await sb(`/rest/v1/profiles?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({full_name:clean(b.full_name),mobile:clean(b.mobile)||null,updated_at:new Date().toISOString()})});
  const arr=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean):[];
  const spPatch={dob:b.dob||null,nationality:clean(b.nationality)||null,total_sea_months:Math.max(0,Number(b.total_sea_months)||0),rank_experience_months:Math.max(0,Number(b.rank_experience_months)||0),joining_availability:b.joining_availability||null,preferred_vessels:arr(b.preferred_vessels),preferred_sectors:arr(b.preferred_sectors),preferred_locations:arr(b.preferred_locations),certificates:arr(b.certificates),skills:arr(b.skills),professional_summary:clean(b.professional_summary)||null,visibility:clean(b.visibility)||'employer_limited',updated_at:new Date().toISOString()};
  const existing=await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}&select=user_id`);
  if(existing?.length)await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(spPatch)});
  else await sb('/rest/v1/seafarer_profiles',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:user.id,...spPatch})});
  const sp=await sb(`/rest/v1/seafarer_profiles?user_id=eq.${id}&select=*`), fresh=await sb(`/rest/v1/profiles?id=eq.${id}&select=id,email,full_name,mobile,role,is_active,created_at,updated_at`);
  return res.status(200).json({message:'Profile updated',profile:fresh?.[0],seafarer:sp?.[0]||null});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Unable to load profile'});}
};
