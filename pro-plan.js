(()=>{
 const $=s=>document.querySelector(s);
 const annual=()=>{
  document.querySelectorAll('#pro .amount').forEach(x=>{if(x.textContent.includes('₹499'))x.innerHTML='₹499 <small>/ year</small>'});
  document.querySelectorAll('#pro [data-plan="seafarer_pro"]').forEach(x=>x.textContent='Start Pro — ₹499/year');
  document.querySelectorAll('[data-upgrade],#upgradePro').forEach(x=>{if(x.textContent.toLowerCase().includes('₹499'))x.textContent=x.textContent.replace(/₹499\/month/gi,'₹499/year')});
  const t=$('#planStatus');if(t&&t.textContent.includes('₹499'))t.textContent='Active • ₹499/year';
 }
 annual();new MutationObserver(annual).observe(document.body,{childList:true,subtree:true,characterData:true});
 const original=window.applyJob;
 if(typeof original==='function')window.applyJob=async id=>{
  const auth=(()=>{try{return JSON.parse(sessionStorage.getItem('sc_auth')||'null')}catch{return null}})();
  if(!auth?.access_token||auth.role!=='seafarer')return original(id);
  try{
   const r=await fetch('/api/profile',{headers:{Authorization:`Bearer ${auth.access_token}`},cache:'no-store'}),d=await r.json();
   if(!r.ok)return original(id);
   const p=d.profile||{},s=d.seafarer||{};
   const fields=[p.full_name,p.mobile,s.dob,s.nationality,+s.total_sea_months>0,+s.rank_experience_months>0,s.joining_availability,s.professional_summary,s.preferred_vessels?.length,s.preferred_sectors?.length,s.certificates?.length,s.skills?.length];
   const c=Math.round(fields.filter(Boolean).length/fields.length*100);
   const sr=await fetch('/api/subscription-status',{headers:{Authorization:`Bearer ${auth.access_token}`},cache:'no-store'}),sd=await sr.json();
   if(sd.isPro&&c<80){
    const modal=$('#modal'),box=$('#modalContent');if(modal&&box){box.innerHTML=`<div class="kicker"><span></span> PROFILE CHECK</div><h2>Complete your profile before applying</h2><p>Your current profile is <b>${c}% complete</b>. Complete at least 80% so employers receive a stronger maritime CV.</p><div class="tool-result">Add rank, sea service, certificates, skills, preferences and availability.</div><button class="btn primary big" id="goComplete">Complete Profile</button>`;modal.classList.add('open');$('#goComplete').onclick=()=>{$('#modal').classList.remove('open');document.querySelector('.dash-nav')?.querySelector('[data-tab="profile"]')?.click();location.href='/dashboard#tab-profile'};return;}
   }
  }catch{}
  return original(id);
 };
})();
