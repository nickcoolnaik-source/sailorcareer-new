const {sb,authUser}=require('./_supabase');
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=String(req.headers.authorization||'');
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!token)return res.status(401).json({error:'Verification token is missing. Please open the latest email link.'});
    const user=await authUser(token);
    const email=String(user.email||'').toLowerCase();
    if(!email||!user.email_confirmed_at&&!user.confirmed_at)return res.status(401).json({error:'Email is not verified yet. Please open the confirmation link from your email.'});
    const rows=await sb(`/rest/v1/masterclass_registrations?email=eq.${encodeURIComponent(email)}&status=eq.pending_email`,{
      method:'PATCH',headers:{Prefer:'return=representation'},
      body:JSON.stringify({status:'email_verified',email_verified_at:new Date().toISOString()})
    });
    if(!Array.isArray(rows)||!rows.length)return res.status(404).json({error:'No pending masterclass registration was found for this email. Please submit the form again or contact info@sailorcareer.com.'});
    return res.status(200).json({success:true,message:'Email verified successfully. Your masterclass registration is confirmed as email-verified. Batch/seat and payment details will be confirmed separately.'});
  }catch(e){return res.status(401).json({error:e.message||'Unable to verify email.'});}
};
