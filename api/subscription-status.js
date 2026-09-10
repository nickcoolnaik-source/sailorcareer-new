const {sb,authUser}=require('./_supabase');

function cashfreeBase(){
  return process.env.CASHFREE_ENV==='PRODUCTION'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
}

async function reconcilePending(userId){
  const id=encodeURIComponent(userId);
  const rows=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&status=eq.pending&select=id,user_id,plan,status,amount,currency,provider_order_id,provider_event,started_at,renews_at,created_at&order=created_at.desc&limit=3`);
  if(!rows?.length)return {reconciled:false,reason:'no_pending_subscription'};
  const headers={
    'Content-Type':'application/json',
    'x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01',
    'x-client-id':process.env.CASHFREE_APP_ID,
    'x-client-secret':process.env.CASHFREE_SECRET_KEY
  };
  for(const sub of rows){
    if(!sub.provider_order_id)continue;
    const r=await fetch(`${cashfreeBase()}/orders/${encodeURIComponent(sub.provider_order_id)}/payments`,{headers});
    const payments=await r.json().catch(()=>[]);
    if(!r.ok)continue;
    const paid=Array.isArray(payments)&&payments.some(x=>String(x.payment_status||'').toUpperCase()==='SUCCESS');
    if(paid){
      const now=new Date().toISOString();
      await sb(`/rest/v1/subscriptions?id=eq.${encodeURIComponent(sub.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'active',started_at:sub.started_at||now,updated_at:now,provider_event:'PAYMENT_SUCCESS_RECONCILED'})});
      return {reconciled:true,subscriptionId:sub.id};
    }
  }
  return {reconciled:false,reason:'payment_not_successful'};
}

module.exports=async function(req,res){
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)throw Error('Unauthorized');
  const user=await authUser(token);
  const id=encodeURIComponent(user.id);
  const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,role,is_active`))?.[0];
  if(!p||p.role!=='seafarer'||!p.is_active)return res.status(403).json({error:'Seafarer access required'});

  if(req.method==='POST'){
    const result=await reconcilePending(user.id);
    const rows=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&select=id,status,amount,currency,started_at,renews_at,created_at,provider_order_id,provider_event&order=created_at.desc&limit=5`);
    const active=(rows||[]).find(x=>x.status==='active')||null;
    res.setHeader('Cache-Control','no-store');
    return res.json({plan:active?'pro':'free',isPro:!!active,subscription:active,subscriptions:rows||[],reconciliation:result});
  }
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const rows=await sb(`/rest/v1/subscriptions?user_id=eq.${id}&plan=eq.seafarer_pro&select=id,status,amount,currency,started_at,renews_at,created_at,provider_order_id,provider_event&order=created_at.desc&limit=5`);
  const active=(rows||[]).find(x=>x.status==='active')||null;
  res.setHeader('Cache-Control','no-store');
  return res.json({plan:active?'pro':'free',isPro:!!active,subscription:active,subscriptions:rows||[]});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Unable to read subscription'});}
};
