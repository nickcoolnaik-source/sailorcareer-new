const {sb}=require('./_supabase');

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function sendMasterclassConfirmation(reg,{paid=false,orderId=''}={}){
  if(!process.env.RESEND_API_KEY) return {sent:false,reason:'RESEND_API_KEY is not configured'};
  const from=process.env.RESEND_FROM_EMAIL||'SailorCareer <info@sailorcareer.com>';
  const name=escapeHtml(reg.name||'Participant');
  const batch=escapeHtml(reg.batch||'Selected batch');
  const paymentLine=paid
    ? `<p><strong>Payment status:</strong> Successfully received${orderId?` (Order reference: ${escapeHtml(orderId)})`:''}.</p>`
    : `<p><strong>Registration status:</strong> Confirmed under your active SailorCareer Pro membership. No payment is due.</p>`;
  const payload={
    from,to:[reg.email],
    subject:'Registration Confirmed – SailorCareer Maritime Masterclass',
    html:`<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#183047"><div style="max-width:620px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#06182e;color:#fff;padding:24px 30px"><div style="font-size:13px;letter-spacing:2px;color:#f3bd59;font-weight:bold">SAILORCAREER</div><h1 style="font-size:24px;margin:12px 0 0">Registration confirmed</h1></div><div style="padding:28px 30px;line-height:1.65"><p>Dear ${name},</p><p>Thank you for registering for the <strong>SailorCareer 2-Day Maritime Career &amp; Professional Development Masterclass</strong>. Your registration is confirmed.</p><p><strong>Selected batch:</strong> ${batch}</p>${paymentLine}<div style="background:#eef7fb;border-left:4px solid #078c9b;padding:16px;margin:22px 0"><strong>Online session access</strong><p style="margin:8px 0 0">Your Microsoft Teams meeting link and access credentials (Meeting ID and Passcode) will be sent to your registered email address before the Masterclass begins. Please check your inbox and spam/junk folder.</p></div><p>Please retain this email for your records. We look forward to welcoming you.</p><p>Regards,<br><strong>SailorCareer Team</strong><br><a href="mailto:info@sailorcareer.com">info@sailorcareer.com</a><br><a href="https://www.sailorcareer.com">www.sailorcareer.com</a></p><hr style="border:0;border-top:1px solid #e5eaf0;margin:24px 0"><p style="font-size:12px;color:#66788a">This is a professional learning programme. It does not guarantee employment, cadet sponsorship, vessel joining, promotion or statutory maritime certification.</p></div></div></body></html>`,
    text:`Dear ${reg.name||'Participant'},\n\nYour registration for the SailorCareer 2-Day Maritime Career & Professional Development Masterclass is confirmed.\nSelected batch: ${reg.batch||'Selected batch'}\n${paid?'Payment status: Successfully received.'+(orderId?' Order reference: '+orderId:''):'Registration status: Confirmed under your active SailorCareer Pro membership. No payment is due.'}\n\nYour Microsoft Teams meeting link, Meeting ID and Passcode will be sent to your registered email address before the Masterclass begins. Please check your inbox and spam/junk folder.\n\nRegards,\nSailorCareer Team\ninfo@sailorcareer.com`
  };
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||`Resend email failed (${response.status})`);
  return {sent:true,id:data.id||null};
}

async function verifyTurnstile(token, req){
  if(!token) throw new Error('Please complete the security verification.');
  if(!process.env.TURNSTILE_SECRET_KEY) throw new Error('Turnstile is not configured on the server.');
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      secret:process.env.TURNSTILE_SECRET_KEY,
      response:token,
      remoteip:req.headers['x-forwarded-for']||''
    })
  });
  const d=await r.json();
  if(!d.success) throw new Error('Security verification failed. Please try again.');
  return d;
}

function env(){
  const url=process.env.SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!secret) throw new Error('Supabase server environment is incomplete.');
  return {url,anon,secret};
}

async function authRequest(url,anon,path,body){
  const r=await fetch(`${url}${path}`,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:anon},
    body:JSON.stringify(body)
  });
  const d=await r.json();
  if(!r.ok) throw new Error(d?.msg||d?.message||d?.error_description||d?.error||'Authentication request failed.');
  return d;
}

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {url,anon,secret}=env();
    const body=req.body||{};

    if(body.action==='masterclass_register_member'){
      const bearer=String(req.headers.authorization||''); const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
      if(!token)return res.status(401).json({error:'Please log in to your SailorCareer account first.'});
      const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
      const user=await ur.json().catch(()=>({})); if(!ur.ok||!user.id||!user.email_confirmed_at)return res.status(401).json({error:'Your account session is invalid. Please log in again.'});
      const uid=encodeURIComponent(user.id); const profile=(await sb(`/rest/v1/profiles?id=eq.${uid}&select=id,email,full_name,mobile,role,is_active`))[0];
      if(!profile||profile.role!=='seafarer'||!profile.is_active)return res.status(403).json({error:'An active Seafarer account is required.'});
      const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
      const batch=clean(body.batch,80),rank=clean(body.rank,100),department=clean(body.department,80);
      const qualification=clean(body.qualification,150),experience=clean(body.experience,150),questions=clean(body.questions,1000);
      if(!['Batch A — 17–18 October 2026','Batch B — 24–25 October 2026'].includes(batch)||!rank||!department||!(body.consent===true||body.consent==='true'))return res.status(400).json({error:'Complete required fields, select a valid batch and accept the consent.'});
      const allowed=['Deck','Engine','Electrical / ETO','Catering / Galley','Other maritime department','Aspiring seafarer / Not yet assigned'];
      if(!allowed.includes(department))return res.status(400).json({error:'Select a valid department.'});
      const subs=await sb(`/rest/v1/subscriptions?user_id=eq.${uid}&plan=eq.seafarer_pro&status=eq.active&select=id,status,renews_at,created_at&order=created_at.desc&limit=5`);
      const now=Date.now(); const isPro=(subs||[]).some(x=>!x.renews_at||new Date(x.renews_at).getTime()>now);
      const fee=isPro?0:299;
      const email=String(user.email).trim().toLowerCase();
      // The database's unique key is email + batch (not user_id + batch).
      // Reuse an earlier public/email registration when the participant later logs in.
      const existing=(await sb(`/rest/v1/masterclass_registrations?email=eq.${encodeURIComponent(email)}&batch=eq.${encodeURIComponent(batch)}&select=id,user_id,status,payment_status,fee_amount,membership_plan,payment_order_id,confirmation_email_sent_at&limit=1`))[0];
      const alreadySettled=existing&&(['confirmed','completed'].includes(existing.status)||['paid','free'].includes(existing.payment_status));
      const registration={user_id:user.id,name:profile.full_name||user.user_metadata?.full_name||user.email,email,mobile:profile.mobile||'',batch,rank,department,qualification,experience,questions,status:alreadySettled?existing.status:(isPro?'confirmed':'payment_pending'),payment_status:alreadySettled?existing.payment_status:(isPro?'free':'unpaid'),membership_plan:alreadySettled?existing.membership_plan:(isPro?'seafarer_pro':'free'),fee_amount:alreadySettled?Number(existing.fee_amount||0):fee,currency:'INR',consent_at:new Date().toISOString(),email_verified_at:user.email_confirmed_at};
      const saved=await sb('/rest/v1/masterclass_registrations?on_conflict=email,batch&select=id,status,payment_status,fee_amount,membership_plan,batch,confirmation_email_sent_at',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(registration)});
      const row=saved?.[0]; if(!row)return res.status(500).json({error:'Registration could not be saved.'});
      let confirmationEmailSent=false;
      if(Number(row.fee_amount)===0&&!row.confirmation_email_sent_at){
        try{
          const sent=await sendMasterclassConfirmation({name:registration.name,email:registration.email,batch:registration.batch},{paid:false});
          confirmationEmailSent=sent.sent;
          if(sent.sent) await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(row.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({confirmation_email_sent_at:new Date().toISOString()})});
        }catch(emailError){console.error('Masterclass Pro confirmation email failed:',emailError.message);}
      }
      return res.status(200).json({success:true,registrationId:row.id,isPro,fee:row.fee_amount,free:row.fee_amount===0,status:row.status,confirmationEmailSent,message:row.fee_amount===0?'Your free Pro-member registration is confirmed.':'Registration saved. Review the ₹299 fee and terms before payment.'});
    }
    if(body.action==='masterclass_create_member_payment'){
      const bearer=String(req.headers.authorization||''); const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
      if(!token)return res.status(401).json({error:'Please log in to continue.'});
      const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}}); const user=await ur.json().catch(()=>({}));
      if(!ur.ok||!user.id||!user.email_confirmed_at)return res.status(401).json({error:'Please log in with your verified SailorCareer account.'});
      const id=String(body.registrationId||''); if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid registration reference.'});
      const rows=await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,name,email,mobile,batch,status,fee_amount,payment_status`);
      const reg=rows?.[0]; if(!reg)return res.status(404).json({error:'Registration not found for this account.'});
      if(Number(reg.fee_amount)===0)return res.status(200).json({success:true,free:true,message:'Your Pro-member registration is already confirmed.'});
      if(!body.acceptTerms)return res.status(400).json({error:'Please accept the displayed fee and refund terms.'});
      if(!['awaiting_payment','payment_pending'].includes(reg.status))return res.status(400).json({error:'This registration is not eligible for payment.'});
      const appId=process.env.CASHFREE_APP_ID,secretKey=process.env.CASHFREE_SECRET_KEY;if(!appId||!secretKey)return res.status(500).json({error:'Cashfree payment is not configured.'});
      const mode=process.env.CASHFREE_ENV==='PRODUCTION'?'production':'sandbox'; const base=mode==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
      const orderId=`SCMC_${Date.now()}_${require('crypto').randomBytes(5).toString('hex')}`; const phone=String(reg.mobile||'').replace(/\D/g,'').slice(-10);
      if(phone.length!==10)return res.status(400).json({error:'Add a valid 10-digit mobile number to your SailorCareer profile before paying.'});
      const response=await fetch(`${base}/orders`,{method:'POST',headers:{'Content-Type':'application/json','x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01','x-client-id':appId,'x-client-secret':secretKey,'x-request-id':require('crypto').randomUUID(),'x-idempotency-key':require('crypto').randomUUID()},body:JSON.stringify({order_id:orderId,order_amount:299,order_currency:'INR',customer_details:{customer_id:reg.user_id,customer_name:reg.name,customer_email:reg.email,customer_phone:phone},order_meta:{return_url:`${(process.env.SITE_URL||'https://sailorcareer.com').replace(/\/$/,'')}/masterclass/?mc_payment=return&order_id={order_id}`},order_note:'SailorCareer Maritime Career Masterclass'})});
      const order=await response.json().catch(()=>({}));if(!response.ok||!order.payment_session_id)throw new Error(order.message||'Cashfree could not create checkout.');
      await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(reg.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'payment_pending',payment_status:'pending',payment_order_id:orderId,payment_amount:299,payment_currency:'INR',payment_created_at:new Date().toISOString()})});
      return res.status(200).json({success:true,orderId,paymentSessionId:order.payment_session_id,mode,amount:299,currency:'INR'});
    }
    // Masterclass registration and email verification share this existing
    // endpoint so the Hobby deployment does not add more serverless functions.
    if(body.action==='masterclass_register'){
      await verifyTurnstile(body.turnstileToken,req);
      const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
      const name=clean(body.name,100),email=clean(body.email,150).toLowerCase();
      const mobile=clean(body.mobile,25),batch=clean(body.batch,80);
      const rank=clean(body.rank,100),department=clean(body.department,80);
      const qualification=clean(body.qualification,150),experience=clean(body.experience,150);
      const questions=clean(body.questions,1000);
      if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!mobile||!batch||!rank||!department||!(body.consent===true||body.consent==='true')){
        return res.status(400).json({error:'Please complete all required fields and accept the consent.'});
      }
      if(!['Batch A — 17–18 October 2026','Batch B — 24–25 October 2026'].includes(batch)){
        return res.status(400).json({error:'Please select a valid batch.'});
      }
      const allowed=['Deck','Engine','Electrical / ETO','Catering / Galley','Other maritime department','Aspiring seafarer / Not yet assigned'];
      if(!allowed.includes(department))return res.status(400).json({error:'Please select a valid department.'});
      await sb('/rest/v1/masterclass_registrations?on_conflict=email,batch',{
        method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({name,email,mobile,batch,rank,department,qualification,experience,questions,status:'pending_email',consent_at:new Date().toISOString()})
      });
      const site=(process.env.SITE_URL||'https://sailorcareer.com').replace(/\/$/,'');
      const redirectTo=`${site}/masterclass/`;
      const r=await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,{
        method:'POST',headers:{'Content-Type':'application/json',apikey:anon},
        body:JSON.stringify({email,create_user:true})
      });
      const result=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(result.msg||result.message||result.error_description||'Unable to send verification email. Please try again later.');
      return res.status(200).json({success:true,message:'Registration details saved. A verification link was sent to '+email+'. Check your inbox and spam folder, then open the link to verify your email.'});
    }

    if(body.action==='masterclass_verify'){
      const auth=String(req.headers.authorization||'');
      const token=auth.startsWith('Bearer ')?auth.slice(7):'';
      if(!token)return res.status(401).json({error:'Verification token is missing. Please open the latest email link.'});
      const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
      const user=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error('Unable to verify email. Please open the latest confirmation link.');
      const email=String(user.email||'').toLowerCase();
      if(!email||(!user.email_confirmed_at&&!user.confirmed_at))return res.status(401).json({error:'Email is not verified yet. Please open the confirmation link from your email.'});
      const rows=await sb(`/rest/v1/masterclass_registrations?email=eq.${encodeURIComponent(email)}&status=eq.pending_email`,{
        method:'PATCH',headers:{Prefer:'return=representation'},
        body:JSON.stringify({status:'email_verified',email_verified_at:new Date().toISOString()})
      });
      if(!Array.isArray(rows)||!rows.length)return res.status(404).json({error:'No pending masterclass registration was found for this email. Please submit the form again or contact info@sailorcareer.com.'});
      const registration=rows[0];
      return res.status(200).json({success:true,email,registrationId:registration.id,batch:registration.batch,message:'Email verified. Review the participation fee and terms below to continue to secure payment.'});
    }

    if(body.action==='masterclass_create_payment'){
      const auth=String(req.headers.authorization||'');
      const token=auth.startsWith('Bearer ')?auth.slice(7):'';
      if(!token) return res.status(401).json({error:'Please verify your email using the link sent to you first.'});
      const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
      const verifiedUser=await ur.json().catch(()=>({}));
      if(!ur.ok||!verifiedUser.email_confirmed_at) return res.status(401).json({error:'Email verification is required before payment.'});
      const registrationId=String(body.registrationId||'');
      if(!/^[0-9a-f-]{36}$/i.test(registrationId)) return res.status(400).json({error:'Invalid registration reference. Please verify your email again.'});
      const rows=await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(registrationId)}&email=eq.${encodeURIComponent(String(verifiedUser.email).toLowerCase())}&select=id,email,name,mobile,batch,status`,{});
      const registration=rows?.[0];
      if(!registration||!['email_verified','payment_pending'].includes(registration.status)) return res.status(400).json({error:'This registration is not eligible for payment. Please contact info@sailorcareer.com.'});
      if(!body.acceptTerms) return res.status(400).json({error:'Please acknowledge the fee and non-refundable payment terms.'});
      const appId=process.env.CASHFREE_APP_ID,secretKey=process.env.CASHFREE_SECRET_KEY;
      if(!appId||!secretKey) return res.status(500).json({error:'Secure payment is temporarily unavailable. Please contact info@sailorcareer.com.'});
      const mode=process.env.CASHFREE_ENV==='PRODUCTION'?'production':'sandbox';
      const apiBase=mode==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
      const orderId=`SCMC_${Date.now()}_${require('crypto').randomBytes(5).toString('hex')}`;
      const phone=String(registration.mobile||'').replace(/\D/g,'').slice(-10);
      if(phone.length!==10) return res.status(400).json({error:'Please provide a valid 10-digit mobile number with country code in your registration.'});
      const orderResponse=await fetch(`${apiBase}/orders`,{method:'POST',headers:{'Content-Type':'application/json','x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01','x-client-id':appId,'x-client-secret':secretKey,'x-request-id':require('crypto').randomUUID(),'x-idempotency-key':require('crypto').randomUUID()},body:JSON.stringify({order_id:orderId,order_amount:299,order_currency:'INR',customer_details:{customer_id:registration.id,customer_name:registration.name,customer_email:registration.email,customer_phone:phone},order_meta:{return_url:`${(process.env.SITE_URL||'https://sailorcareer.com').replace(/\/$/,'')}/masterclass/?mc_payment=return&order_id={order_id}`},order_note:'SailorCareer 2-Day Maritime Career Masterclass participation fee'})});
      const order=await orderResponse.json().catch(()=>({}));
      if(!orderResponse.ok||!order.payment_session_id) throw new Error(order.message||'Cashfree could not create the payment session. Please try again.');
      await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(registration.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'payment_pending',payment_order_id:orderId,payment_amount:299,payment_currency:'INR',payment_created_at:new Date().toISOString()})});
      return res.status(200).json({success:true,orderId,paymentSessionId:order.payment_session_id,mode,amount:299,currency:'INR'});
    }

    if(body.action==='masterclass_verify_payment'){
      const orderId=String(body.orderId||'');
      if(!/^SCMC_[A-Za-z0-9_]+$/.test(orderId)) return res.status(400).json({error:'Invalid payment reference.'});
      const appId=process.env.CASHFREE_APP_ID,secretKey=process.env.CASHFREE_SECRET_KEY;
      if(!appId||!secretKey) return res.status(500).json({error:'Payment verification is temporarily unavailable.'});
      const apiBase=process.env.CASHFREE_ENV==='PRODUCTION'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
      const verifyResponse=await fetch(`${apiBase}/orders/${encodeURIComponent(orderId)}`,{headers:{'x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01','x-client-id':appId,'x-client-secret':secretKey}});
      const order=await verifyResponse.json().catch(()=>({}));
      if(!verifyResponse.ok) throw new Error(order.message||'Unable to verify payment status.');
      if(order.order_status!=='PAID'||Number(order.order_amount)!==299||order.order_currency!=='INR') return res.status(202).json({success:false,pending:true,message:'Payment is not confirmed yet. If your account was debited, wait briefly and refresh this page.'});
      const rows=await sb(`/rest/v1/masterclass_registrations?payment_order_id=eq.${encodeURIComponent(orderId)}&select=id,name,email,batch,confirmation_email_sent_at`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'confirmed',paid_at:new Date().toISOString(),payment_status:'paid'})});
      if(!Array.isArray(rows)||!rows.length) return res.status(404).json({error:'Payment was received but the registration record was not found. Contact info@sailorcareer.com with order ID '+orderId+'.'});
      const registration=rows[0]; let confirmationEmailSent=Boolean(registration.confirmation_email_sent_at);
      if(!confirmationEmailSent){
        try{
          const sent=await sendMasterclassConfirmation(registration,{paid:true,orderId});
          confirmationEmailSent=sent.sent;
          if(sent.sent) await sb(`/rest/v1/masterclass_registrations?id=eq.${encodeURIComponent(registration.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({confirmation_email_sent_at:new Date().toISOString()})});
        }catch(emailError){console.error('Masterclass payment confirmation email failed:',emailError.message);}
      }
      return res.status(200).json({success:true,confirmationEmailSent,message:'Payment verified and your masterclass registration is confirmed. '+(confirmationEmailSent?'A confirmation email has been sent to your registered email address.':'Your confirmation is saved; email delivery could not be confirmed. Please contact info@sailorcareer.com if you do not receive it.'),orderId});
    }

    await verifyTurnstile(body.turnstileToken,req);

    if(body.action==='signup'){
      const email=String(body.email||'').trim().toLowerCase();
      const password=String(body.password||'');
      const role=body.role==='employer'?'employer':'seafarer';
      if(!email||!password||password.length<8) throw new Error('Enter a valid email and a password of at least 8 characters.');

      const metadata={
        full_name:String(body.fullName||'').trim(),
        mobile:String(body.mobile||'').trim(),
        nationality:String(body.nationality||'').trim(),
        rank:String(body.rank||'').trim()
      };

      // Prevent repeated signup attempts for an email that already has a SailorCareer profile.
      // This avoids unnecessarily triggering Supabase confirmation-email rate limits.
      const existing=await sb(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role,is_active&limit=1`,{
        headers:{apikey:secret,Authorization:`Bearer ${secret}`}
      });
      if(Array.isArray(existing)&&existing[0]){
        const ep=existing[0];
        if(ep.role!==role) throw new Error('This email is already registered for a different portal. Please use another email.');
        throw new Error('This email is already registered. Please use Login instead of creating another account.');
      }

      const signup=await authRequest(url,anon,'/auth/v1/signup',{
        email,password,
        data:metadata,
        options:{email_redirect_to:`${process.env.SITE_URL||'https://www.sailorcareer.com'}/?auth=verified`}
      });

      // Supabase normally returns { user, session }. In some Auth responses the
      // user object can be represented directly, so accept both shapes. If the
      // confirmation email was sent but the response omitted the user id, recover
      // the id from the SailorCareer profile created by the database trigger.
      let user=signup?.user || (signup?.id ? signup : null);
      if(!user?.id){
        for(let i=0;i<5;i++){
          const rows=await sb(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role,is_active&limit=1`,{
            headers:{apikey:secret,Authorization:`Bearer ${secret}`}
          });
          if(Array.isArray(rows)&&rows[0]?.id){
            user={id:rows[0].id,email:rows[0].email||email};
            break;
          }
          await new Promise(r=>setTimeout(r,400));
        }
      }
      if(!user?.id){
        // The signup request has already sent the verification email. Do not
        // report a generic failure if Auth succeeded but its response was unusual.
        return res.status(200).json({
          success:true,email,requiresEmailConfirmation:true,
          message:'Account created. Please verify your email before signing in.'
        });
      }

      // The database trigger creates the base profile automatically. Upsert here only to
      // enrich it with the submitted role/contact data, while keeping signup idempotent.
      await sb('/rest/v1/profiles?on_conflict=id',{
        method:'POST',
        headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({
          id:user.id,email,full_name:metadata.full_name,mobile:metadata.mobile,
          role,is_active:role==='seafarer'
        })
      });

      if(role==='seafarer'){
        await sb('/rest/v1/seafarer_profiles?on_conflict=user_id',{
          method:'POST',
          headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({
            user_id:user.id,
            dob:body.dob||null,
            nationality:metadata.nationality||null,
            total_sea_months:Number(body.experienceMonths||0)||0
          })
        });
      }else{
        await sb('/rest/v1/companies?on_conflict=user_id',{
          method:'POST',
          headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify({
            user_id:user.id,
            company_name:String(body.companyName||'').trim(),
            company_type:String(body.companyType||'').trim()||null,
            contact_person:String(body.contactPerson||'').trim(),
            email,
            mobile:metadata.mobile,
            country:String(body.country||'').trim()||null,
            rpsl_number:String(body.rpsl||'').trim()||null,
            rpsl_status:'pending',
            verified:false
          })
        });
      }

      return res.status(200).json({
        success:true,
        email,
        requiresEmailConfirmation:!signup.session,
        message:signup.session?'Account created successfully.':'Account created. Please verify your email before signing in.'
      });
    }

    if(body.action==='login'){
      const email=String(body.email||'').trim().toLowerCase();
      const password=String(body.password||'');
      const expectedRole=body.role==='employer'?'employer':body.role==='admin'?'admin':'seafarer';
      if(!email||!password) throw new Error('Enter email and password.');

      const session=await authRequest(url,anon,'/auth/v1/token?grant_type=password',{email,password});
      if(!session.access_token||!session.user?.id) throw new Error('Login failed.');

      const profile=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=role,is_active,full_name,email`,{
        headers:{apikey:secret,Authorization:`Bearer ${secret}`}
      });
      const p=profile?.[0];
      if(!p||p.role!==expectedRole) throw new Error('This account is not registered for this portal.');
      if(!p.is_active && expectedRole!=='employer') throw new Error('Your account is pending verification or has been suspended.');

      return res.status(200).json({
        success:true,
        access_token:session.access_token,
        refresh_token:session.refresh_token,
        expires_in:session.expires_in,
        user:{id:session.user.id,email:session.user.email,role:p.role,full_name:p.full_name}
      });
    }

    if(body.action==='recover'){
      const email=String(body.email||'').trim().toLowerCase();
      if(!email) throw new Error('Enter your email address.');
      const r=await fetch(`${url}/auth/v1/recover`,{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:anon},
        body:JSON.stringify({
          email,
          redirect_to:`${process.env.SITE_URL||'https://www.sailorcareer.com'}/?auth=recovery`
        })
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d?.msg||d?.message||d?.error_description||'Unable to send password reset email.');
      return res.status(200).json({success:true,message:'If the email exists, a password reset link has been sent.'});
    }

    return res.status(400).json({error:'Invalid authentication action.'});
  }catch(e){
    const raw=String(e.message||'');
    if(/rate limit exceeded|rate_limit|too many requests/i.test(raw)){
      return res.status(429).json({error:'Email sending limit reached. Please wait a few minutes before trying again.'});
    }
    return res.status(400).json({error:raw||'Authentication failed.'});
  }
};
