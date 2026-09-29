const {sb}=require('./_supabase');

function env(){
  const url=process.env.SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!anon) throw new Error('Supabase URL and publishable/anon key must be configured.');
  return {url,anon};
}
function clean(v,max=200){return String(v??'').trim().slice(0,max)}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const {url,anon}=env(), b=req.body||{};
    const name=clean(b.name,100),email=clean(b.email,150).toLowerCase(),mobile=clean(b.mobile,25),batch=clean(b.batch,80),rank=clean(b.rank,100),department=clean(b.department,80);
    const qualification=clean(b.qualification,150),experience=clean(b.experience,150),questions=clean(b.questions,1000);
    if(!name||!/^\S+@\S+\.\S+$/.test(email)||!mobile||!batch||!rank||!department||b.consent!==true&&b.consent!=='true')return res.status(400).json({error:'Please complete all required fields and accept the consent.'});
    if(!['Batch A — 17–18 October 2026','Batch B — 24–25 October 2026'].includes(batch))return res.status(400).json({error:'Please select a valid batch.'});
    const allowed=['Deck','Engine','Electrical / ETO','Catering / Galley','Other maritime department','Aspiring seafarer / Not yet assigned'];
    if(!allowed.includes(department))return res.status(400).json({error:'Please select a valid department.'});
    const rows=await sb('/rest/v1/masterclass_registrations?on_conflict=email,batch',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({name,email,mobile,batch,rank,department,qualification,experience,questions,status:'pending_email',consent_at:new Date().toISOString()})
    });
    const site=(process.env.SITE_URL||'https://sailorcareer.com').replace(/\/$/,'');
    const redirectTo=`${site}/masterclass/?email-confirmed=1`;
    const r=await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,{
      method:'POST',headers:{'Content-Type':'application/json',apikey:anon},
      body:JSON.stringify({email,create_user:true})
    });
    const result=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(result.msg||result.message||result.error_description||'Unable to send verification email. Please try again later.');
    return res.status(200).json({success:true,message:'Your registration details have been saved. We sent a verification link to '+email+'. Please check your inbox and spam folder; open the link to verify your email and confirm registration.'});
  }catch(e){
    const msg=String(e.message||'Registration failed.');
    if(/duplicate key|unique constraint|already exists/i.test(msg))return res.status(409).json({error:'A registration already exists for this email and batch. Please check your email for the verification link or contact info@sailorcareer.com.'});
    if(/rate limit|too many requests/i.test(msg))return res.status(429).json({error:'Email verification limit reached. Please wait before trying again.'});
    return res.status(400).json({error:msg});
  }
};
