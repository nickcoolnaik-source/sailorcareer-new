const {sb}=require('./_supabase');

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
      const rows=await sb(`/rest/v1/masterclass_registrations?payment_order_id=eq.${encodeURIComponent(orderId)}&select=id,status`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'confirmed',paid_at:new Date().toISOString(),payment_status:'paid'})});
      if(!Array.isArray(rows)||!rows.length) return res.status(404).json({error:'Payment was received but the registration record was not found. Contact info@sailorcareer.com with order ID '+orderId+'.'});
      return res.status(200).json({success:true,message:'Payment verified. Your masterclass registration is confirmed. Keep your order reference: '+orderId,orderId});
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
