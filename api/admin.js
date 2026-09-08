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
      const map=new Map(profiles.map(x=>[x.id,x]));
      return res.json({success:true,employers:companies.map(c=>({...c,profile:map.get(c.user_id)||null}))});
    }
    if(action==='verifyEmployer'||action==='rejectEmployer'){
      const id=clean(req.body?.company_id);
      if(!id) throw Error('Company id required.');
      const company=(await table('companies','*',`&id=eq.${encodeURIComponent(id)}&limit=1`))[0];
      if(!company) throw Error('Company not found.');
      const approved=action==='verifyEmployer';
      if(approved){const paid=(await table('subscriptions','id,plan,status',`&user_id=eq.${encodeURIComponent(company.user_id)}&plan=eq.employer_pro&status=eq.active&limit=1`))[0];if(!paid)throw Error('Employer must complete subscription payment before admin approval.');}
      await patch('companies',`id=eq.${encodeURIComponent(id)}`,{verified:approved,verified_at:approved?new Date().toISOString():null,rpsl_status:approved?'verified':'rejected'});
      if(company.user_id) await patch('profiles',`id=eq.${encodeURIComponent(company.user_id)}`,{is_active:approved});
      return res.json({success:true,verified:approved});
    }
    if(action==='suspendEmployer'||action==='activateEmployer'){
      const id=clean(req.body?.user_id); if(!id) throw Error('User id required.');
      await patch('profiles',`id=eq.${encodeURIComponent(id)}`,{is_active:action==='activateEmployer'});
      return res.json({success:true,is_active:action==='activateEmployer'});
    }

    if(action==='seafarers'){
      const profiles=await table('profiles','id,email,full_name,mobile,is_active,created_at','&role=eq.seafarer&order=created_at.desc');
      const ids=profiles.map(x=>x.id); const seaf=ids.length?await table('seafarer_profiles','user_id,nationality,total_sea_months,rank_experience_months,professional_summary,visibility,resume_url',`&user_id=in.(${ids.join(',')})`):[];
      const map=new Map(seaf.map(x=>[x.user_id,x]));
      return res.json({success:true,seafarers:profiles.map(p=>({...p,seafarer:map.get(p.id)||null}))});
    }

    if(action==='jobs'){
      const jobs=await table('jobs','*','&order=created_at.desc');
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
      return res.json({success:true,subscriptions:subs});
    }
    if(action==='subscriptionStatus'){
      const id=clean(req.body?.subscription_id); const status=clean(req.body?.status);
      const allowed=['pending','active','suspended','expired','cancelled'];
      if(!id||!allowed.includes(status)) throw Error('Invalid subscription status.');
      const updated=await patch('subscriptions',`id=eq.${encodeURIComponent(id)}`,{status,updated_at:new Date().toISOString()});
      return res.json({success:true,subscription:updated[0]});
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
