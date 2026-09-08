const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim(); if(!token)throw Error('Unauthorized');
  const user=await authUser(token), id=encodeURIComponent(user.id);
  const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,role,is_active`))?.[0];
  if(!p||p.role!=='seafarer'||!p.is_active)return res.status(403).json({error:'Seafarer access required'});
  const rows=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&select=id,status,amount,currency,started_at,renews_at,created_at&order=created_at.desc&limit=5`);
  const active=(rows||[]).find(x=>x.status==='active')||null;
  res.setHeader('Cache-Control','no-store');
  return res.json({plan:active?'pro':'free',isPro:!!active,subscription:active,subscriptions:rows||[]});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Unable to read subscription'});}
};
