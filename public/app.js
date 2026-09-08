const state={jobs:[
{id:'j1',rank:'Chief Officer',vessel:'Container Vessel',sector:'Merchant Shipping',company:'OceanBridge Ship Management',location:'Singapore',contract:'4 months',salary:'USD 8,500',requirements:'Valid CoC • STCW • 24 months rank experience'},
{id:'j2',rank:'ETO',vessel:'LNG Carrier',sector:'Merchant Shipping',company:'BlueHarbor Maritime',location:'UAE',contract:'5 months',salary:'USD 7,200',requirements:'ETO CoC • STCW • LNG experience'},
{id:'j3',rank:'DPO/DP Operator',vessel:'Offshore/DP',sector:'Offshore/Oil & Gas',company:'NorthSea Offshore Services',location:'Doha',contract:'3 months',salary:'USD 6,800',requirements:'DP Unlimited • STCW • Offshore medical'},
{id:'j4',rank:'3rd Engineer',vessel:'Product Tanker',sector:'Merchant Shipping',company:'HarborLine Ship Management',location:'Mumbai',contract:'6 months',salary:'USD 4,900',requirements:'CoC • STCW • Tanker endorsement'},
{id:'j5',rank:'Deck Cadet',vessel:'Bulk Carrier',sector:'Merchant Shipping',company:'Seaway Fleet',location:'Colombo',contract:'6 months',salary:'USD 700',requirements:'STCW • Passport • Medical'},
{id:'j6',rank:'Crane Operator',vessel:'Jack-up Rig',sector:'Offshore/Oil & Gas',company:'Gulf Marine Drilling',location:'Abu Dhabi',contract:'2 months',salary:'USD 5,400',requirements:'Offshore experience • Medical • Safety certs'}],
ranks:['Master/Captain','Chief Officer','2nd Officer','3rd Officer','Deck Cadet','Bosun','AB','OS','Pumpman','Chief Engineer','2nd Engineer','3rd Engineer','4th Engineer','Engine Cadet','Motorman/Oiler','Fitter','ETO','ETR','Electrician','Reefer Engineer','Chief Cook','2nd Cook','Steward','Messman','Chief Steward','DPO/DP Operator','Rig Manager','Toolpusher','Driller','Assistant Driller','Derrickman','Roustabout','Crane Operator','Barge Engineer','Fishing Master','Skipper','Deckhand','Marine Surveyor','Marine Superintendent','Technical Superintendent','HSQE Officer'],
vessels:['Container Vessel','Bulk Carrier','Tanker','Oil Tanker','Product Tanker','Chemical Tanker','LNG Carrier','LPG Carrier','Ro-Ro/Car Carrier','General Cargo','Multi-Purpose Vessel','Heavy Lift','Offshore/DP','PSV','AHTS','OSV','Drillship','Jack-up Rig','Semi-submersible Rig','FPSO/FSO','Cruise/Passenger','Ferry','Yacht','Fishing Vessel','Research Vessel','Dredger','Tug/Workboat','Cable Layer','Wind Farm Support','Government/Research'],
sectors:['Merchant Shipping','Offshore/Oil & Gas','Cruise & Passenger','Ferries','Yachting','Fishing','Research','Government/Public Sector','Marine Services','Ship Management']};

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.style.display='none',3600)};
const authStore={
get(){try{return JSON.parse(sessionStorage.getItem('sc_auth')||'null')}catch{return null}},
set(v){sessionStorage.setItem('sc_auth',JSON.stringify(v))},
clear(){sessionStorage.removeItem('sc_auth')}
};
let config=null;
let turnstileWidget=null;
let turnstileToken='';
let currentAuthForm=null;

async function loadConfig(){
  try{
    const r=await fetch('/api/config',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok)throw Error(d.error||'Authentication configuration unavailable');
    config=d;
  }catch(e){
    console.warn(e);
    config=null;
  }
}
function waitForTurnstile(){
  return new Promise(resolve=>{
    const start=Date.now();
    const tick=()=>{
      if(window.turnstile)return resolve(true);
      if(Date.now()-start>8000)return resolve(false);
      setTimeout(tick,100);
    };
    tick();
  });
}
async function renderTurnstile(){
  const box=$('#turnstileWidget');
  if(!box||!config?.turnstileSiteKey)return false;
  const ready=await waitForTurnstile();
  if(!ready)return false;
  try{
    turnstileToken='';
    turnstileWidget=turnstile.render(box,{
      sitekey:config.turnstileSiteKey,
      theme:'light',
      size:'flexible',
      callback:token=>{turnstileToken=token},
      'expired-callback':()=>{turnstileToken=''},
      'error-callback':()=>{turnstileToken=''}
    });
    return true;
  }catch(e){
    console.error(e);
    return false;
  }
}
function resetTurnstile(){
  turnstileToken='';
  if(window.turnstile&&turnstileWidget!==null){try{turnstile.reset(turnstileWidget)}catch{}}
}
function fill(id,arr){const e=$(id);if(!e)return;arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;e.appendChild(o)})}
fill('#rankFilter',state.ranks);fill('#vesselFilter',state.vessels);fill('#sectorFilter',state.sectors);

function renderJobs(list=state.jobs){
  $('#jobCount').textContent=`${list.length} job${list.length===1?'':'s'}`;
  $('#jobGrid').innerHTML=list.map(j=>`<article class="job"><div class="job-top"><span class="count">${j.sector}</span><span>✓ Verified</span></div><h3>${j.rank}</h3><div class="company">${j.company}</div><div class="job-meta"><div>Vessel<b>${j.vessel}</b></div><div>Location<b>${j.location}</b></div><div>Contract<b>${j.contract}</b></div><div>Salary<b>${j.salary}</b></div></div><p class="requirements">${j.requirements}</p><div class="job-actions"><button class="btn outline" onclick="viewJob('${j.id}')">View Details</button><button class="btn primary" onclick="applyJob('${j.id}')">Apply Now</button></div></article>`).join('')
}
renderJobs();

$('#jobSearch').addEventListener('submit',e=>{
  e.preventDefault();
  const r=$('#rankFilter').value,v=$('#vesselFilter').value,s=$('#sectorFilter').value,k=$('#keywordFilter').value.toLowerCase();
  renderJobs(state.jobs.filter(j=>(!r||j.rank===r)&&(!v||j.vessel===v)&&(!s||j.sector===s)&&(!k||Object.values(j).join(' ').toLowerCase().includes(k))));
});

function openModal(html){
  resetTurnstile();
  $('#modalContent').innerHTML=html;
  $('#modal').classList.add('open');
}
function closeModal(){
  resetTurnstile();
  $('#modal').classList.remove('open');
  currentAuthForm=null;
}
$('#closeModal').onclick=closeModal;
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};

window.viewJob=id=>{
  const j=state.jobs.find(x=>x.id===id);
  openModal(`<div class="kicker"><span></span> VERIFIED VACANCY</div><h2>${j.rank}</h2><p><b>${j.company}</b> • ${j.location}</p><div class="dash-grid"><div class="dash-card">Vessel<strong>${j.vessel}</strong></div><div class="dash-card">Contract<strong>${j.contract}</strong></div><div class="dash-card">Salary<strong>${j.salary}</strong></div></div><h3>Requirements</h3><p>${j.requirements}</p><button class="btn primary big" onclick="applyJob('${j.id}')">Apply Now</button>`);
};
window.applyJob=async id=>{
  const j=state.jobs.find(x=>x.id===id);
  const auth=authStore.get();
  if(!auth){
    openModal(`<div class="kicker"><span></span> SIGN IN REQUIRED</div><h2>Apply for ${j.rank}</h2><p>${j.company} • ${j.location}</p><p>Please sign in as a seafarer to submit an application. Your profile will be used for structured applications and tracking.</p><button class="btn primary big" data-open-inline="seafarerLogin">Seafarer Login</button>`);
    $('[data-open-inline]').onclick=()=>{closeModal();openAuth('seafarerLogin')};
    return;
  }
  if(auth.role!=='seafarer'){toast('Only seafarer accounts can apply for jobs.');return}
  try{
    const sr=await fetch('/api/subscription-status',{headers:{Authorization:`Bearer ${auth.access_token}`},cache:'no-store'});
    const sd=await sr.json();
    if(!sr.ok)throw Error(sd.error||'Unable to verify subscription');
    if(!sd.isPro){
      openModal(`<div class="kicker"><span></span> SEAFARER PRO</div><h2>Apply with Seafarer Pro</h2><p>One-click applications and application tracking are included with Seafarer Pro.</p><div class="dash-grid"><div class="dash-card">Plan<strong>₹499/month</strong></div><div class="dash-card">Tracking<strong>8 application statuses</strong></div></div><button class="btn gold big" id="applyUpgrade">Upgrade to Pro — ₹499/month</button>`);
      $('#applyUpgrade').onclick=async()=>{try{const r=await fetch('/api/cashfree-create-order',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:JSON.stringify({plan:'seafarer_pro'})});const d=await r.json();if(!r.ok)throw Error(d.error||'Payment setup unavailable');if(window.Cashfree&&d.payment_session_id)Cashfree({mode:d.mode==='production'?'production':'sandbox'}).checkout({paymentSessionId:d.payment_session_id,redirectTarget:'_self'});else toast('Payment session created.');}catch(e){toast(e.message)}};
      return;
    }
  }catch(e){toast(e.message);return}
  openModal(`<div class="kicker"><span></span> APPLICATION</div><h2>Apply for ${j.rank}</h2><p>${j.company} • ${j.location}</p><div class="form-grid"><input id="applyName" placeholder="Full name" value="${auth.full_name||''}" required><input id="applyEmail" type="email" placeholder="Email" value="${auth.email||''}" required><input id="applyPhone" placeholder="Mobile" required><textarea id="applyNote" class="full" placeholder="Short note (optional)"></textarea><button class="btn primary full" onclick="submitApplication('${j.id}')">Submit application</button></div><p class="form-note">Your Seafarer Pro application will be tracked from your dashboard.</p>`);
};
window.submitApplication=async id=>{
  const n=$('#applyName')?.value.trim(),e=$('#applyEmail')?.value.trim(),p=$('#applyPhone')?.value.trim();
  if(!n||!e||!p){toast('Please complete name, email and mobile.');return}
  const a=authStore.get();
  try{const r=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${a.access_token}`},body:JSON.stringify({job_id:id,note:$('#applyNote')?.value||''})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to submit application');toast('Application submitted successfully.');closeModal()}catch(err){toast(err.message)}};

const forms={
  seafarerLogin:{title:'Seafarer Login',role:'seafarer',fields:`<input class="full" id="authEmail" type="email" autocomplete="email" placeholder="Email" required><input class="full" id="authPassword" type="password" autocomplete="current-password" placeholder="Password" required>`},
  employerLogin:{title:'Employer Login',role:'employer',fields:`<input class="full" id="authEmail" type="email" autocomplete="email" placeholder="Work email" required><input class="full" id="authPassword" type="password" autocomplete="current-password" placeholder="Password" required>`},
  seafarerRegister:{title:'Create Seafarer Account',role:'seafarer',fields:`<input id="regName" placeholder="Full name" autocomplete="name" required><input id="regEmail" type="email" placeholder="Email" autocomplete="email" required><input id="regMobile" placeholder="Mobile" autocomplete="tel" required><input id="regDob" type="date"><input id="regNationality" placeholder="Nationality"><select id="regRank">${state.ranks.map(x=>`<option>${x}</option>`).join('')}</select><input id="regExperience" placeholder="Total sea experience (months)"><input class="full" id="regPassword" type="password" autocomplete="new-password" placeholder="Password (min 8 chars)" minlength="8" required>`},
  employerRegister:{title:'Employer Portal Registration',role:'employer',fields:`<input id="coName" placeholder="Company name" required><input id="coType" placeholder="Company type"><input id="coContact" placeholder="Contact person" required><input id="coEmail" type="email" placeholder="Work email" required><input id="coMobile" placeholder="Mobile" required><input id="coCountry" placeholder="Country"><input id="coRpsl" placeholder="RPSL number / status"><input id="coPassword" type="password" autocomplete="new-password" placeholder="Password (min 8 chars)" minlength="8" required><p class="form-note full">Employer accounts are created as pending verification. Recruitment access remains disabled until admin approval.</p>`}
};

function authModalHtml(key){
  const f=forms[key];
  const login=key.includes('Login');
  return `<div class="kicker"><span></span> SAILORCAREER</div><h2>${f.title}</h2><form id="authForm" class="form-grid" data-auth-key="${key}">${f.fields}<div class="full" id="turnstileWidget"></div><button class="btn primary full" type="submit">${f.role==='employer'&&!login?'Create employer account':login?'Sign in':'Create account'}</button>${login?'<button type="button" class="btn outline full" id="forgotPassword">Forgot password?</button>':''}</form><p class="form-note">Security verification is required before authentication. Email confirmation follows your Supabase Auth settings.</p>`;
}
window.openAuth=async function openAuth(key){
  currentAuthForm=key;
  openModal(authModalHtml(key));
  const ok=await renderTurnstile();
  if(!ok)toast('Security verification could not load. Please refresh and try again.');
  $('#authForm').onsubmit=handleAuthSubmit;
  $('#forgotPassword')?.addEventListener('click',handleRecovery);
}
window.openAuth=openAuth;

async function handleAuthSubmit(e){
  e.preventDefault();
  const key=e.currentTarget.dataset.authKey;
  const f=forms[key];
  if(!turnstileToken){toast('Please complete the security verification.');return}
  const payload={action:key.includes('Register')?'signup':'login',role:f.role,turnstileToken};
  if(payload.action==='login'){
    payload.email=$('#authEmail').value.trim();
    payload.password=$('#authPassword').value;
  }else if(key==='seafarerRegister'){
    payload.fullName=$('#regName').value.trim();
    payload.email=$('#regEmail').value.trim();
    payload.mobile=$('#regMobile').value.trim();
    payload.dob=$('#regDob').value||null;
    payload.nationality=$('#regNationality').value.trim();
    payload.rank=$('#regRank').value;
    payload.experienceMonths=$('#regExperience').value.replace(/[^0-9]/g,'')||0;
    payload.password=$('#regPassword').value;
  }else{
    payload.companyName=$('#coName').value.trim();
    payload.companyType=$('#coType').value.trim();
    payload.contactPerson=$('#coContact').value.trim();
    payload.email=$('#coEmail').value.trim();
    payload.mobile=$('#coMobile').value.trim();
    payload.country=$('#coCountry').value.trim();
    payload.rpsl=$('#coRpsl').value.trim();
    payload.password=$('#coPassword').value;
  }
  const button=e.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;button.textContent='Please wait…';
  try{
    const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d.error||'Authentication failed.');
    if(payload.action==='login'){
      authStore.set({access_token:d.access_token,refresh_token:d.refresh_token,expires_in:d.expires_in,id:d.user.id,email:d.user.email,role:d.user.role,full_name:d.user.full_name});
      closeModal();
      toast(`Welcome ${d.user.full_name||d.user.email}. Login successful.`);
      updateHeader();
    }else{
      const email=d.email||payload.email||'';
      const roleLabel=f.role==='employer'?'Employer':'Seafarer';
      openModal(`<div class="kicker"><span></span> EMAIL VERIFICATION</div><h2>Verify your email to continue</h2><p class="form-note">Your ${roleLabel} account has been created successfully and your verification email has been sent.</p><div class="dash-card" style="margin:16px 0;"><strong>Verification email sent to</strong><br><span>${email}</span></div><p><strong>Next step:</strong> Open your inbox and click the <strong>Verify Email</strong> link. After verification, return to SailorCareer and use <strong>${f.role==='employer'?'Employer Login':'Seafarer Login'}</strong>.</p><p class="form-note">If you do not see the email, check your Spam/Junk folder.</p><button class="btn primary full" type="button" onclick="closeModal()">OK, I will verify my email</button>`);
    }
  }catch(err){
    toast(err.message);
    resetTurnstile();
    button.disabled=false;
    button.textContent=payload.action==='login'?'Sign in':(f.role==='employer'?'Create employer account':'Create account');
  }
}
async function handleRecovery(){
  const email=$('#authEmail')?.value.trim();
  if(!email){toast('Enter your email first.');return}
  if(!turnstileToken){toast('Please complete the security verification first.');return}
  try{
    const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover',email,turnstileToken,role:'seafarer'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d.error||'Unable to send reset email.');
    toast(d.message||'Password reset email sent.');
    closeModal();
  }catch(err){toast(err.message);resetTurnstile()}
}
function updateHeader(){
  const auth=authStore.get();
  $$('.head-actions').forEach(x=>{
    if(!x.dataset.original)x.dataset.original=x.innerHTML;
    const destination = auth?.role === 'employer' ? '/employer' : auth?.role === 'admin' ? '/admin' : '/dashboard';
    const label = auth?.role === 'employer' ? 'Employer Dashboard' : auth?.role === 'admin' ? 'Admin Portal' : 'Dashboard';
    x.innerHTML=auth?`<button class="btn ghost" id="dashboardBtn" title="Open ${label}">${label}</button><button class="btn primary" id="logoutBtn">Logout</button>`:x.dataset.original;
    $('#dashboardBtn')?.addEventListener('click',()=>{location.href=destination});
  });
  $('#logoutBtn')?.addEventListener('click',()=>{authStore.clear();updateHeader();toast('You are logged out.')});
}
document.addEventListener('click',e=>{
  const trigger=e.target.closest?.('[data-open]');
  if(trigger){e.preventDefault();openAuth(trigger.dataset.open)}
});
updateHeader();

$$('[data-plan]').forEach(b=>b.addEventListener('click',async()=>{
  const auth=authStore.get();
  if(!auth){toast('Please sign in before starting a subscription.');openAuth('seafarerLogin');return}
  toast('Opening secure payment setup…');
  try{
    const r=await fetch('/api/cashfree-create-order',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.access_token}`},body:JSON.stringify({plan:b.dataset.plan})});
    const d=await r.json();
    if(!r.ok)throw Error(d.error||'Payment setup unavailable');
    if(window.Cashfree&&d.payment_session_id){
      Cashfree({mode:d.mode==='production'?'production':'sandbox'}).checkout({paymentSessionId:d.payment_session_id,redirectTarget:'_self'});
    }else toast('Cashfree order created; checkout session returned.');
  }catch(err){toast(err.message)}
}));

$('#supportForm').onsubmit=e=>{e.preventDefault();toast('Support request received.');e.target.reset()};
$('#hamb').onclick=()=>$('#nav').classList.toggle('open');
$$('#nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));

loadConfig().then(()=>{
  const auth=authStore.get();
  if(location.search.includes('auth=verified'))toast('Email verified. You can now sign in.');
  if(location.search.includes('auth=recovery'))toast('Password recovery link opened. Set your new password in the Supabase recovery flow.');
  if(auth)updateHeader();
});
