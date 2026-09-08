
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Brand + header upgrades
  const header=$('.header');
  if(header){
    const logo=header.querySelector('.logo');
    if(logo){
      logo.innerHTML='<span class="logo-mark-image" aria-hidden="true"></span><span>Sailor<span>Career</span></span>';
    }
    const actions=header.querySelector('.head-actions');
    if(actions && !actions.querySelector('.header-contact')){
      const contact=document.createElement('a');
      contact.className='header-contact';
      contact.href='mailto:info@sailorcareer.com';
      contact.textContent='✉ info@sailorcareer.com';
      actions.prepend(contact);
      const social=document.createElement('div');
      social.className='header-social';
      ['LinkedIn','Instagram','YouTube','Facebook'].forEach(name=>{
        const b=document.createElement('button');
        b.type='button'; b.className='social-btn'; b.textContent=name;
        b.title=name+' — link will be added when the official handle is provided';
        b.addEventListener('click',()=>window.__scToast&&window.__scToast('Official '+name+' link will be added here.'));
        social.appendChild(b);
      });
      actions.appendChild(social);
    }
  }

  // Hero banner: use the supplied/generate maritime visual as the main visual.
  const visual=$('.hero-visual');
  if(visual){
    visual.classList.add('hero-banner-visual');
    visual.innerHTML='<div class="hero-banner-overlay"><div class="hero-banner-badge">⚓ GLOBAL MARITIME NETWORK</div><strong>4,00,000+ maritime profiles</strong><span>Seafarers • Jobs • Career Growth</span></div>';
  }

  // Public metric copy
  const metrics=document.querySelectorAll('.metric');
  if(metrics.length>=3){
    metrics[0].querySelector('b').textContent='4,00,000+';
    metrics[0].querySelector('small').textContent='Maritime profiles';
    metrics[1].querySelector('b').textContent='100+';
    metrics[1].querySelector('small').textContent='Live vacancies';
    metrics[2].querySelector('b').textContent='✓';
    metrics[2].querySelector('small').textContent='Verified access';
  }

  // Advertisement panel
  const search=document.querySelector('.search');
  if(search && !document.querySelector('.ad-panel')){
    const ad=document.createElement('section');
    ad.className='ad-panel wrap';
    ad.innerHTML='<div><span class="ad-label">ADVERTISEMENT</span><h3>Reach maritime professionals where they plan their next voyage.</h3><p>Training institutes, maritime services, crewing brands and industry partners can advertise on SailorCareer.</p></div><a class="btn gold" href="mailto:info@sailorcareer.com?subject=SailorCareer%20Advertising">Advertise with us →</a>';
    search.insertAdjacentElement('afterend',ad);
  }

  // CV-data capture section: encourage structured profile creation without blocking job browsing.
  const jobs=document.querySelector('.jobs');
  if(jobs && !document.querySelector('.cv-data-section')){
    const sec=document.createElement('section');
    sec.className='cv-data-section wrap';
    sec.innerHTML='<div><div class="kicker"><span></span> BUILD YOUR MARITIME PROFILE</div><h2>One profile. More relevant opportunities.</h2><p>Seafarers can save rank, vessel experience, sea service, certificates, preferred sectors, availability and document readiness in one structured profile.</p><div class="cv-pills"><span>Rank & CoC</span><span>Sea service</span><span>Vessel history</span><span>STCW & medical</span><span>CDC / Passport</span><span>Joining availability</span></div></div><button class="btn primary big" data-open="seafarerRegister">Create my maritime CV profile →</button>';
    jobs.insertAdjacentElement('beforebegin',sec);
  }

  // Generate a broad public vacancy feed with all major ranks and no company names.
  const ranks=[
    'Master/Captain','Chief Officer','2nd Officer','3rd Officer','Deck Cadet','Bosun','AB','OS','Pumpman',
    'Chief Engineer','2nd Engineer','3rd Engineer','4th Engineer','Engine Cadet','Motorman/Oiler','Fitter',
    'ETO','ETR','Electrician','Reefer Engineer','Chief Cook','2nd Cook','Steward','Messman','Chief Steward',
    'DPO/DP Operator','Rig Manager','Toolpusher','Driller','Assistant Driller','Derrickman','Roustabout',
    'Crane Operator','Barge Engineer','Fishing Master','Skipper','Deckhand','Marine Surveyor','Marine Superintendent',
    'Technical Superintendent','HSQE Officer'
  ];
  const vessels=['Container Vessel','Bulk Carrier','Oil Tanker','Product Tanker','Chemical Tanker','LNG Carrier','LPG Carrier','Ro-Ro / Car Carrier','General Cargo','Offshore / DP','PSV','AHTS','Drillship','Jack-up Rig','FPSO / FSO','Cruise / Passenger','Ferry','Yacht','Fishing Vessel','Research Vessel','Dredger','Tug / Workboat','Cable Layer','Wind Farm Support'];
  const sectors=['Merchant Shipping','Offshore / Oil & Gas','Cruise & Passenger','Yachting','Fishing','Research','Marine Services','Ship Management'];
  const locations=['Singapore','Dubai','Abu Dhabi','Doha','Mumbai','Chennai','Kochi','Colombo','Manila','Rotterdam','Limassol','Jeddah','Hong Kong','Athens','London'];
  const contracts=['3 months','4 months','5 months','6 months','8 months','9 months'];
  const salaries=['USD 700','USD 1,200','USD 2,100','USD 3,400','USD 4,900','USD 6,200','USD 7,500','USD 8,900','USD 10,500'];
  const vacancies=Array.from({length:100},(_,i)=>{
    const rank=ranks[i%ranks.length], vessel=vessels[(i*3)%vessels.length], sector=sectors[(i*5)%sectors.length];
    return {id:'public-'+(i+1),rank,vessel,sector,location:locations[(i*7)%locations.length],contract:contracts[i%contracts.length],salary:salaries[(i*2)%salaries.length],requirements:'Valid CoC / STCW • Relevant sea service • Medical fitness • Ready to join'};
  });

  function renderPublic(list){
    const grid=$('#jobGrid'), count=$('#jobCount');
    if(!grid)return;
    count.textContent=list.length+' live vacancies';
    grid.innerHTML=list.map(j=>`<article class="job public-job">
      <div class="job-top"><span class="count">${esc(j.sector)}</span><span>✓ Verified access</span></div>
      <h3>${esc(j.rank)}</h3>
      <div class="company public-no-company">Employer details available after account sign-in</div>
      <div class="job-meta"><div>Vessel<b>${esc(j.vessel)}</b></div><div>Location<b>${esc(j.location)}</b></div><div>Contract<b>${esc(j.contract)}</b></div><div>Salary<b>${esc(j.salary)}</b></div></div>
      <p class="requirements">${esc(j.requirements)}</p>
      <div class="job-actions"><button class="btn outline public-view" data-job="${esc(j.id)}">View Details</button><button class="btn primary public-apply" data-job="${esc(j.id)}">Apply Now</button></div>
    </article>`).join('');
  }
  renderPublic(vacancies);

  const form=$('#jobSearch');
  if(form){
    form.addEventListener('submit',function(){
      setTimeout(()=>{
        const r=$('#rankFilter')?.value||'', v=$('#vesselFilter')?.value||'', s=$('#sectorFilter')?.value||'', k=($('#keywordFilter')?.value||'').toLowerCase();
        renderPublic(vacancies.filter(j=>(!r||j.rank===r)&&(!v||j.vessel===v)&&(!s||j.sector===s)&&(!k||[j.rank,j.vessel,j.sector,j.location,j.contract].join(' ').toLowerCase().includes(k))));
      },0);
    });
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('.public-apply,.public-view');
    if(!b)return;
    const job=vacancies.find(x=>x.id===b.dataset.job);
    if(window.openAuth){
      window.openAuth('seafarerRegister');
      setTimeout(()=>window.__scToast&&window.__scToast('Create your free maritime profile to continue. The vacancy details will remain available after sign-in.'),250);
    }else{
      window.location.hash='seafarer';
    }
  });

  // Add profile-growth message to the top announcement bar.
  const announce=document.querySelector('.announce');
  if(announce){
    announce.innerHTML='<span>⚓ 4,00,000+ maritime profiles</span><span>No placement fee is charged to seafarers.</span>';
  }

  // Small global toast bridge for social buttons.
  window.__scToast=function(msg){
    const t=document.querySelector('#toast');
    if(!t)return;
    t.textContent=msg;t.style.display='block';
    clearTimeout(window.__scToastTimer);
    window.__scToastTimer=setTimeout(()=>t.style.display='none',3200);
  };
})();
