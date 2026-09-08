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
      if(!p.is_active) throw new Error('Your account is pending verification or has been suspended.');

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
