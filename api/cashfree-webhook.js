const crypto=require('crypto');
const {sb}=require('./_supabase');
function valid(ts,raw,sig){
 const expected=crypto.createHmac('sha256',process.env.CASHFREE_SECRET_KEY).update(ts+raw).digest('base64');
 const a=Buffer.from(expected),b=Buffer.from(sig||'');
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).send('Method not allowed');
 try{
  const raw=typeof req.body==='string'?req.body:(req.rawBody?Buffer.from(req.rawBody).toString('utf8'):JSON.stringify(req.body||{}));
  const ts=req.headers['x-webhook-timestamp'];const sig=req.headers['x-webhook-signature'];
  if(!ts||!sig||!valid(ts,raw,sig))return res.status(400).send('Invalid signature');
  const body=JSON.parse(raw);
  const orderId=body?.data?.order?.order_id||body?.data?.payment?.order_id||body?.data?.payment?.payment_group;
  const type=String(body?.type||body?.event_type||'').toUpperCase();
  const paymentStatus=String(body?.data?.payment?.payment_status||body?.data?.payment?.status||'').toUpperCase();
  const eventId=body?.data?.payment?.cf_payment_id||body?.data?.payment?.payment_id||body?.event_id||`${type}:${orderId||''}:${body?.event_time||''}`;
  if(eventId){
    try{await sb('/rest/v1/payment_events',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({provider:'cashfree',event_id:String(eventId),order_id:orderId||null,event_type:type,payload:body})});}catch(e){console.error('payment event log failed',e.message)}
  }
  const success=type.includes('SUCCESS')||type.includes('PAID')||paymentStatus==='SUCCESS';
  const failed=type.includes('FAILED')||type.includes('USER_DROPPED')||paymentStatus==='FAILED';
  const status=success?'active':failed?'suspended':null;
  if(orderId&&status){
   const rows=await sb(`/rest/v1/subscriptions?provider_order_id=eq.${encodeURIComponent(orderId)}&select=id,user_id,plan,status&limit=1`);
   const sub=rows[0];
   if(sub){
    const nextStatus=sub.plan==='employer_pro'&&status==='active'?'pending':status;
    const now=new Date().toISOString();
    await sb(`/rest/v1/subscriptions?id=eq.${encodeURIComponent(sub.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:nextStatus,updated_at:now,provider_event:type||paymentStatus})});
   }
  }
  return res.status(200).json({received:true});
 }catch(e){console.error(e);return res.status(400).json({error:e.message})}
};
