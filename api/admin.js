const {sb,authUser}=require('./_supabase');

async function adminAuth(req){
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token) throw Error('Admin authentication required.');
  const u=await authUser(token);
  if(!u?.id) throw Error('Invalid session.');
  const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,email,full_name,role,is_active`);
  const p=rows[0];
  if(!p||p.role!=='admin'||!p.is_active) throw Error('Admin access required.');
  return p;
}

const clean=(v)=>String(v??'').trim();
const table=(name,select='*',query='')=>sb(`/rest/v1/${name}?select=${encodeURIComponent(select)}${query}`);
const patch=(name,query,body)=>sb(`/rest/v1/${name}?${query}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});

async function overview(){
  const [profiles,companies,jobs,apps,subs,payments]=await Promise.all([
    table('profiles','id,role,is_active'), table('companies','id,verified,rpsl_status'), table('jobs','id,status,approved'),
    table('applications','id,status'), table('subscriptions','id,plan,status,amount,created_at'), table('payment_events','id,event_type,order_id,provider,created_at')
  ]);
  return {
    seafarers:profiles.filter(x=>x.role==='seafarer').length,
    employers:profiles.filter(x=>x.role==='employer').length,
    pendingEmployers:companies.filter(x=>!x.verified).length,
    jobs:jobs.length,pendingJobs:jobs.filter(x=>!x.approved).length,
    applications:apps.length,activeSubscriptions:subs.filter(x=>x.status==='active').length,
    payments:payments.length
  };
}

module.exports=async function(req,res){
  try{
    const me=await adminAuth(req);
    const action=clean(req.query?.action||req.body?.action||'overview');

    if(action==='overview') return res.json({success:true,admin:me,stats:await overview()});

    if(action==='employers'){
      const companies=await table('companies','*','&order=created_at.desc');
      const ids=companies.map(x=>x.user_id).filter(Boolean);
      const profiles=ids.length?await table('profiles','id,email,full_name,mobile,is_active,created_at',`&id=in.(${ids.join(',')})`):[];
      const subs=ids.length?await table('subscriptions','user_id,plan,status,provider_event,created_at',`&user_id=in.(${ids.join(',')})&plan=eq.employer_pro&order=created_at.desc`):[];
      const map=new Map(profiles.map(x=>[x.id,x])); const paid=new Set(subs.filter(x=>x.status==='active'||(x.status==='pending'&&/(SUCCESS|PAID)/i.test(String(x.provider_event||'')))).map(x=>x.user_id));
      return res.json({success:true,employers:companies.map(c=>({...c,payment_received:paid.has(c.user_id),profile:map.get(c.user_id)||null}))});
    }
    if(action==='verifyEmployer'||action==='rejectEmployer'){
      const id=clean(req.body?.company_id);
      if(!id) throw Error('Company id required.');
      const company=(await table('companies','*',`&id=eq.${encodeURIComponent(id)}&limit=1`))[0];
      if(!company) throw Error('Company not found.');
      const approved=action==='verifyEmployer';
      if(approved){const paid=(await table('subscriptions','id,plan,status,provider_event',`&user_id=eq.${encodeURIComponent(company.user_id)}&plan=eq.employer_pro&status=eq.pending&order=created_at.desc&limit=1`))[0];if(!paid||!/(SUCCESS|PAID)/i.test(String(paid.provider_event||'')))throw Error('Employer must complete the ₹49,999 payment before admin approval.');await patch('subscriptions',`id=eq.${encodeURIComponent(paid.id)}`,{status:'active',started_at:new Date().toISOString(),updated_at:new Date().toISOString()});}
      await patch('companies',`id=eq.${encodeURIComponent(id)}`,{verified:approved,verified_at:approved?new Date().toISOString():null,rpsl_status:approved?'verified':'rejected'});
      if(company.user_id){await patch('profiles',`id=eq.${encodeURIComponent(company.user_id)}`,{is_active:approved});if(!approved){const paid=(await table('subscriptions','id,plan,status',`&user_id=eq.${encodeURIComponent(company.user_id)}&plan=eq.employer_pro&status=in.(pending,active)&order=created_at.desc&limit=1`))[0];if(paid)await patch('subscriptions',`id=eq.${encodeURIComponent(paid.id)}`,{status:'suspended',updated_at:new Date().toISOString()});}}
      return res.json({success:true,verified:approved});
    }
    if(action==='suspendEmployer'||action==='activateEmployer'){
      const id=clean(req.body?.user_id); if(!id) throw Error('User id required.');
      await patch('profiles',`id=eq.${encodeURIComponent(id)}`,{is_active:action==='activateEmployer'});if(action==='suspendEmployer'){const paid=(await table('subscriptions','id,status',`&user_id=eq.${encodeURIComponent(id)}&plan=eq.employer_pro&status=eq.active&order=created_at.desc&limit=1`))[0];if(paid)await patch('subscriptions',`id=eq.${encodeURIComponent(paid.id)}`,{status:'suspended',updated_at:new Date().toISOString()});}
      return res.json({success:true,is_active:action==='activateEmployer'});
    }

    if(action==='seafarers'){
      const profiles=await table('profiles','id,email,full_name,mobile,is_active,created_at','&role=eq.seafarer&order=created_at.desc');
      const ids=profiles.map(x=>x.id); const seaf=ids.length?await table('seafarer_profiles','user_id,nationality,total_sea_months,rank_experience_months,professional_summary,visibility,resume_url',`&user_id=in.(${ids.join(',')})`):[];
      const subs=ids.length?await table('subscriptions','user_id,plan,status,amount,currency,provider_order_id,provider_event,started_at,created_at',`&user_id=in.(${ids.join(',')})&plan=eq.seafarer_pro&order=created_at.desc`):[];
      const map=new Map(seaf.map(x=>[x.user_id,x]));
      const subMap=new Map();
      for(const x of subs){if(!subMap.has(x.user_id))subMap.set(x.user_id,x);}
      return res.json({success:true,seafarers:profiles.map(p=>({...p,seafarer:map.get(p.id)||null,subscription:subMap.get(p.id)||null}))});
    }

    if(action==='jobs'){
      const jobs=await table('jobs','*,rank:ranks(name),vessel_type:vessel_types(name),sector:sectors(name)','&order=created_at.desc');
      return res.json({success:true,jobs});
    }
    if(action==='jobStatus'){
      const id=clean(req.body?.job_id); const status=clean(req.body?.status);
      const allowed=['draft','published','closed','rejected'];
      if(!id||!allowed.includes(status)) throw Error('Invalid job status.');
      const updated=await patch('jobs',`id=eq.${encodeURIComponent(id)}`,{status,approved:status==='published',updated_at:new Date().toISOString()});
      return res.json({success:true,job:updated[0]});
    }

    if(action==='applications'){
      const apps=await table('applications','*','&order=created_at.desc');
      return res.json({success:true,applications:apps});
    }
    if(action==='applicationStatus'){
      const id=clean(req.body?.application_id); const status=clean(req.body?.status);
      const allowed=['Applied','Under Review','Shortlisted','Interview','Selected','Rejected','Withdrawn','Joining Process'];
      if(!id||!allowed.includes(status)) throw Error('Invalid application status.');
      const updated=await patch('applications',`id=eq.${encodeURIComponent(id)}`,{status,updated_at:new Date().toISOString()});
      return res.json({success:true,application:updated[0]});
    }

    if(action==='subscriptions'){
      const subs=await table('subscriptions','*','&order=created_at.desc');
      const ids=[...new Set(subs.map(x=>x.user_id).filter(Boolean))];
      const profiles=ids.length?await table('profiles','id,email,full_name,mobile,is_active,created_at',`&id=in.(${ids.join(',')})`):[];
      const pMap=new Map(profiles.map(x=>[x.id,x]));
      return res.json({success:true,subscriptions:subs.map(x=>({...x,profile:pMap.get(x.user_id)||null}))});
    }
    if(action==='reconcileSubscription'){
      const id=clean(req.body?.subscription_id);
      if(!id) throw Error('Subscription id required.');
      const sub=(await table('subscriptions','id,user_id,plan,status,amount,currency,provider_order_id,provider_event,started_at,renews_at,created_at',`&id=eq.${encodeURIComponent(id)}&limit=1`))[0];
      if(!sub) throw Error('Subscription not found.');
      if(sub.plan!=='seafarer_pro') throw Error('Only Seafarer Pro payments can be verified here.');
      if(!sub.provider_order_id) throw Error('Cashfree order ID is missing.');
      const base=process.env.CASHFREE_ENV==='PRODUCTION'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
      const headers={'Content-Type':'application/json','x-api-version':process.env.CASHFREE_API_VERSION||'2025-01-01','x-client-id':process.env.CASHFREE_APP_ID,'x-client-secret':process.env.CASHFREE_SECRET_KEY};
      const r=await fetch(`${base}/orders/${encodeURIComponent(sub.provider_order_id)}/payments`,{headers});
      const payments=await r.json().catch(()=>[]);
      if(!r.ok) throw Error(`Cashfree verification failed (${r.status}).`);
      const paid=Array.isArray(payments)&&payments.some(x=>String(x.payment_status||x.status||'').toUpperCase()==='SUCCESS');
      if(!paid) return res.json({success:true,verified:false,status:sub.status,payments:Array.isArray(payments)?payments:[]});
      const now=new Date().toISOString();
      const updated=(await patch('subscriptions',`id=eq.${encodeURIComponent(id)}`,{status:'active',started_at:sub.started_at||now,updated_at:now,provider_event:'PAYMENT_SUCCESS_ADMIN_RECONCILED'}))[0];
      return res.json({success:true,verified:true,subscription:updated,payments});
    }
    if(action==='subscriptionStatus'){
      const id=clean(req.body?.subscription_id); const status=clean(req.body?.status);
      const allowed=['pending','active','suspended','expired','cancelled'];
      if(!id||!allowed.includes(status)) throw Error('Invalid subscription status.');
      const updated=await patch('subscriptions',`id=eq.${encodeURIComponent(id)}`,{status,updated_at:new Date().toISOString()});
      return res.json({success:true,subscription:updated[0]});
    }

    if(action==='proCampaignRecipients'){
      const profiles=await table('profiles','id,email,full_name,is_active','&role=eq.seafarer&is_active=eq.true&order=created_at.asc');
      const ids=profiles.map(x=>x.id).filter(Boolean);
      const subs=ids.length?await table('subscriptions','user_id,status','&user_id=in.('+ids.join(',')+')&plan=eq.seafarer_pro'):[];
      const pro=new Set(subs.filter(x=>x.status==='active').map(x=>x.user_id));
      const logs=ids.length?await table('pro_campaign_sends','user_id,status,sent_at,resend_id','&user_id=in.('+ids.join(',')+')&order=sent_at.desc'):[];
      const latest=new Map(); for(const x of logs){if(!latest.has(x.user_id))latest.set(x.user_id,x);}
      const recipients=profiles.filter(x=>x.email&&!pro.has(x.id)).map(x=>{const l=latest.get(x.id);return {id:x.id,email:x.email,full_name:x.full_name||'Seafarer',sent:!!l&&l.status==='sent',sent_at:l?.sent_at||null};});
      return res.json({success:true,count:recipients.filter(x=>!x.sent).length,totalEligible:recipients.length,recipients});
    }

    if(action==='proCampaignLog'){
      const logs=await table('pro_campaign_sends','id,user_id,email,full_name,status,sent_at,resend_id,error_message','&order=sent_at.desc&limit=100');
      return res.json({success:true,logs});
    }

    if(action==='sendProCampaignTest'){
      if(!process.env.RESEND_API_KEY) throw Error('RESEND_API_KEY is not configured in Vercel.');
      const uid=clean(req.body?.user_id); if(!uid) throw Error('Seafarer user id is required.');
      const profile=(await table('profiles','id,email,full_name,is_active',`&id=eq.${encodeURIComponent(uid)}&role=eq.seafarer&is_active=eq.true&limit=1`))[0];
      if(!profile?.email) throw Error('Eligible seafarer not found.');
      const sub=(await table('subscriptions','status',`&user_id=eq.${encodeURIComponent(uid)}&plan=eq.seafarer_pro&status=eq.active&limit=1`))[0];
      if(sub) throw Error('This seafarer already has an active Seafarer Pro subscription.');
      const from=process.env.RESEND_FROM_EMAIL||'SailorCareer <info@sailorcareer.com>';
      const name=String(profile.full_name||'Seafarer').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const payload={from,to:[profile.email],subject:`${profile.full_name||'Seafarer'}, manage your maritime career more effectively ⚓`,html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#142033;max-width:680px;margin:auto"><h2>⚓ SailorCareer Pro</h2><p>Dear <b>${name}</b>,</p><p>You have already taken the first step by creating your Free Seafarer Profile on SailorCareer.</p><p>Your SailorCareer account can do more than store a basic profile. <b>SailorCareer Pro — ₹499/year</b> adds tools to help you manage your maritime job search.</p><div style="background:#eef7f4;border-left:4px solid #087443;padding:14px 16px;margin:18px 0;border-radius:6px"><p style="margin:0 0 8px"><b>🚢 Explore 10+ ongoing vacancies for your current rank</b></p><p style="margin:0">Discover current opportunities on SailorCareer and, where direct applications are enabled, apply to participating companies through the portal.</p></div><ul><li><b>⚡ Single-Click Applications</b> — apply quickly using your completed profile where enabled</li><li><b>🟢 Availability Status</b> — show Available Now, 30 Days, 60 Days or Currently Onboard</li><li><b>🔔 Recent Vacancy Notifications</b> — stay updated when new opportunities matching your profile become available</li><li><b>📊 Application Tracking</b> — manage your applications from one dashboard</li><li><b>📄 Professional Maritime CV</b></li><li><b>⚓ Sea Service Calculator</b></li><li><b>🔔 Certificate Expiry Tracker</b></li><li><b>📁 Private Document Management</b></li><li><b>📚 Maritime Career Guidance</b></li><li><b>🎓 Course Booking &amp; Support</b></li></ul><p><b>Explore your account:</b> <a href="https://www.sailorcareer.com/dashboard">https://www.sailorcareer.com/dashboard</a></p><p>If you choose to upgrade, select <b>Upgrade to Pro — ₹499/year</b> after logging in.</p><p><b>Your Career. Your Next Voyage. 🚢</b></p><hr><small>This is an optional SailorCareer service update about Pro features. If you do not want promotional messages from SailorCareer, contact info@sailorcareer.com to opt out.</small></div>`};
      const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        await sb('/rest/v1/pro_campaign_sends',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:profile.id,email:profile.email,full_name:profile.full_name||'Seafarer',status:'failed',sent_at:new Date().toISOString(),error_message:d?.message||`Resend HTTP ${r.status}`})});
        throw Error(d?.message||`Resend HTTP ${r.status}`);
      }
      await sb('/rest/v1/pro_campaign_sends',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:profile.id,email:profile.email,full_name:profile.full_name||'Seafarer',status:'sent',sent_at:new Date().toISOString(),resend_id:d?.id||null})});
      return res.json({success:true,message:`Test email sent to ${profile.email}.`,resend:d});
    }
    if(action==='sendProCampaign'){
      if(!process.env.RESEND_API_KEY) throw Error('RESEND_API_KEY is not configured in Vercel.');
      const profiles=await table('profiles','id,email,full_name,is_active','&role=eq.seafarer&is_active=eq.true&order=created_at.asc');
      const ids=profiles.map(x=>x.id).filter(Boolean);
      const subs=ids.length?await table('subscriptions','user_id,status','&user_id=in.('+ids.join(',')+')&plan=eq.seafarer_pro'):[];
      const pro=new Set(subs.filter(x=>x.status==='active').map(x=>x.user_id));
      const recipients=profiles.filter(x=>x.email&&!pro.has(x.id)).map(x=>({id:x.id,email:x.email,full_name:x.full_name||'Seafarer'}));
      if(!recipients.length) return res.json({success:true,sent:0,failed:0,total:0,message:'No eligible Free Seafarers found.'});

      const from=process.env.RESEND_FROM_EMAIL||'SailorCareer <info@sailorcareer.com>';
      const escHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
      const emails=recipients.map(x=>{
        const name=escHtml(x.full_name);
        return {
          from,
          to:[x.email],
          subject:`${x.full_name}, manage your maritime career more effectively ⚓`,
          html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#142033;max-width:680px;margin:auto">
            <h2>⚓ SailorCareer Pro</h2>
            <p>Dear <b>${name}</b>,</p>
            <p>You have already taken the first step by creating your Free Seafarer Profile on SailorCareer.</p>
            <p>Now take the next step towards managing your maritime career more professionally with <b>SailorCareer Pro — ₹499/year</b>.</p>
            <div style="background:#eef7f4;border-left:4px solid #087443;padding:14px 16px;margin:18px 0;border-radius:6px">
              <p style="margin:0 0 8px"><b>🚢 Explore 10+ ongoing vacancies for your current rank</b></p>
              <p style="margin:0">Discover current opportunities on SailorCareer and, where direct applications are enabled, apply to participating companies through the portal.</p>
            </div>
            <ul>
              <li><b>⚡ Single-Click Applications</b> — apply quickly using your completed professional profile where enabled</li>
              <li><b>🟢 Availability Status</b> — show Available Now, 30 Days, 60 Days or Currently Onboard</li>
              <li><b>🔔 Recent Vacancy Notifications</b> — stay updated when new opportunities matching your profile become available</li>
              <li><b>📊 Application Tracking</b> — manage your applications from one dashboard</li>
              <li><b>📄 Professional Maritime CV</b> — maintain a structured profile and CV</li>
              <li><b>⚓ Sea Service Calculator</b> — organise vessel, rank and service dates</li>
              <li><b>🔔 Certificate Expiry Tracker</b> — keep important expiry dates organised</li>
              <li><b>📁 Private Document Management</b> — organise career documents and certificates</li>
              <li><b>📚 Maritime Career Guidance</b> — access Watchkeeping, CoC, DC/CDC and fresher guidance</li>
              <li><b>🎓 Course Booking &amp; Support</b> — submit course and career support requests</li>
            </ul>
            <p><b>Upgrade:</b> <a href="https://www.sailorcareer.com/dashboard">https://www.sailorcareer.com/dashboard</a></p>
            <p>Log in and select <b>Upgrade to Pro — ₹499/year</b>.</p>
            <p><b>Your Career. Your Next Voyage. 🚢</b></p>
            <hr>
            <small>This is an optional SailorCareer service update about Pro features. If you do not want promotional messages from SailorCareer, contact info@sailorcareer.com to opt out.</small>
          </div>`
        };
      });

      let sent=0,failed=0,errors=[];
      for(let i=0;i<emails.length;i+=100){
        const batch=emails.slice(i,i+100);
        const r=await fetch('https://api.resend.com/emails/batch',{
          method:'POST',
          headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify(batch)
        });
        const d=await r.json().catch(()=>({}));
        if(!r.ok){failed+=batch.length;errors.push(d?.message||`Resend HTTP ${r.status}`);}
        else sent+=batch.length;
      }
      return res.json({success:true,total:recipients.length,sent,failed,errors});
    }

    if(action==='payments') return res.json({success:true,payments:await table('payment_events','*','&order=created_at.desc')});

    if(action==='masters'){
      const [r,v,s]=await Promise.all([table('ranks','*','&order=sort_order.asc,name.asc'),table('vessel_types','*','&order=sort_order.asc,name.asc'),table('sectors','*','&order=sort_order.asc,name.asc')]);
      return res.json({success:true,ranks:r,vessel_types:v,sectors:s});
    }
    if(action==='masterSave'){
      const type=clean(req.body?.type); const name=clean(req.body?.name); const id=clean(req.body?.id);
      const map={rank:'ranks',vessel_type:'vessel_types',sector:'sectors'}; const tableName=map[type];
      if(!tableName||!name) throw Error('Master type and name are required.');
      if(id){const updated=await patch(tableName,`id=eq.${encodeURIComponent(id)}`,{name,active:req.body?.active!==false,sort_order:Number(req.body?.sort_order||0)});return res.json({success:true,item:updated[0]});}
      const created=await sb(`/rest/v1/${tableName}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,active:true,sort_order:Number(req.body?.sort_order||0)})});
      return res.status(201).json({success:true,item:created[0]});
    }
    if(action==='masterToggle'){
      const type=clean(req.body?.type),id=clean(req.body?.id); const map={rank:'ranks',vessel_type:'vessel_types',sector:'sectors'}; const tableName=map[type];
      if(!tableName||!id) throw Error('Master type and id are required.');
      const updated=await patch(tableName,`id=eq.${encodeURIComponent(id)}`,{active:req.body?.active===true});
      return res.json({success:true,item:updated[0]});
    }
    throw Error('Unknown admin action.');
  }catch(e){return res.status(/authentication|access required|invalid session/i.test(String(e.message))?401:400).json({error:e.message||'Admin request failed.'});}
};
