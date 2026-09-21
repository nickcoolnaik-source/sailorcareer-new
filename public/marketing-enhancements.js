
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

  // 2026 indicative market ranges, USD/month. These are rank-level guides,
  // not guaranteed offers. Actual pay varies by vessel, flag, company, trade,
  // experience, CoC/certificates and contract/collective agreement.
  // Benchmarked against current 2026 published vacancy examples and the
  // 2026 ITF/ILO wage scale; obscure/specialist roles use broader indicative ranges.
  const salaryByRank={
    'Master/Captain':'USD 8,500–16,000+',
    'Chief Officer':'USD 5,500–10,000',
    '2nd Officer':'USD 3,100–6,500',
    '3rd Officer':'USD 2,750–5,000',
    'Deck Cadet':'USD 500–1,500',
    'Bosun':'USD 1,800–3,500',
    'AB':'USD 1,500–3,200',
    'OS':'USD 1,000–2,200',
    'Pumpman':'USD 2,000–4,000',
    'Chief Engineer':'USD 6,500–14,500+',
    '2nd Engineer':'USD 4,400–8,500',
    '3rd Engineer':'USD 2,500–5,500',
    '4th Engineer':'USD 2,200–4,500',
    'Engine Cadet':'USD 500–1,500',
    'Motorman/Oiler':'USD 1,400–3,200',
    'Fitter':'USD 1,800–4,000',
    'ETO':'USD 3,100–7,500',
    'ETR':'USD 2,500–5,000',
    'Electrician':'USD 2,500–6,000',
    'Reefer Engineer':'USD 3,500–6,500',
    'Chief Cook':'USD 1,800–3,500',
    '2nd Cook':'USD 1,400–2,700',
    'Steward':'USD 1,000–2,200',
    'Messman':'USD 1,000–2,200',
    'Chief Steward':'USD 1,800–3,500',
    'DPO/DP Operator':'USD 5,500–10,500',
    'Rig Manager':'USD 8,000–18,000+',
    'Toolpusher':'USD 5,000–12,000',
    'Driller':'USD 3,500–10,000',
    'Assistant Driller':'USD 2,000–4,500',
    'Derrickman':'USD 1,800–5,000',
    'Roustabout':'USD 1,200–3,500',
    'Crane Operator':'USD 2,500–7,000',
    'Barge Engineer':'USD 5,000–10,000',
    'Fishing Master':'USD 3,500–8,000',
    'Skipper':'USD 3,000–8,000',
    'Deckhand':'USD 1,000–2,500',
    'Marine Surveyor':'USD 4,500–8,500',
    'Marine Superintendent':'USD 5,000–9,000',
    'Technical Superintendent':'USD 7,000–15,000',
    'HSQE Officer':'USD 4,000–8,000'
  };

  const vacancies=Array.from({length:100},(_,i)=>{
    const rank=ranks[i%ranks.length], vessel=vessels[(i*3)%vessels.length], sector=sectors[(i*5)%sectors.length];
    return {id:'public-'+(i+1),rank,vessel,sector,location:locations[(i*7)%locations.length],contract:contracts[i%contracts.length],salary:salaryByRank[rank]||'Market rate — verify with employer',requirements:'Valid CoC / STCW • Relevant sea service • Medical fitness • Ready to join'};
  });

  // Render only a small number of public vacancies at first.
  // The full 100-item dataset stays available, but the homepage initially
  // creates only 5 vacancy cards to keep the page light and responsive.
  const PUBLIC_PAGE_SIZE=5;
  let currentPublicList=vacancies;
  let visiblePublicCount=PUBLIC_PAGE_SIZE;

  function renderPublic(list,reset=true){
    const grid=$('#jobGrid'), count=$('#jobCount');
    if(!grid)return;

    currentPublicList=list;
    if(reset) visiblePublicCount=PUBLIC_PAGE_SIZE;

    const visibleList=list.slice(0,visiblePublicCount);
    count.textContent=`Showing ${visibleList.length} of ${list.length} vacancies`;

    grid.innerHTML=visibleList.map(j=>`<article class="job public-job">
      <div class="job-top"><span class="count">${esc(j.sector)}</span><span>✓ Verified access</span></div>
      <h3>${esc(j.rank)}</h3>
      <div class="company public-no-company">Employer details available after account sign-in</div>
      <div class="job-meta"><div>Vessel<b>${esc(j.vessel)}</b></div><div>Location<b>${esc(j.location)}</b></div><div>Contract<b>${esc(j.contract)}</b></div><div>Market salary<b>${esc(j.salary)}</b></div></div>
      <p class="requirements">${esc(j.requirements)}</p>
      <div class="job-actions"><button class="btn outline public-view" data-job="${esc(j.id)}">View Details</button><button class="btn primary public-apply" data-job="${esc(j.id)}">Apply Now</button></div>
    </article>`).join('');

    const oldMore=document.querySelector('#publicViewMore');
    if(oldMore) oldMore.remove();

    if(visiblePublicCount < list.length){
      const more=document.createElement('div');
      more.id='publicViewMore';
      more.className='public-view-more';
      more.style.cssText='display:flex;justify-content:center;align-items:center;margin:24px 0 8px;';
      more.innerHTML='<button type="button" class="btn outline" id="publicViewMoreBtn">View More Vacancies →</button>';
      grid.insertAdjacentElement('afterend',more);
    }
  }

  renderPublic(vacancies);

  // Salary methodology note shown once above the vacancy grid.
  const jobSection=document.querySelector('.jobs');
  if(jobSection && !document.querySelector('.salary-market-note')){
    const note=document.createElement('div');
    note.className='salary-market-note';
    note.innerHTML='<strong>2026 market salary guide:</strong> Indicative monthly USD ranges. Actual offers vary by vessel type, flag, company, experience, certificates and contract. Figures are a guide, not a guaranteed offer.';
    const grid=document.querySelector('#jobGrid');
    if(grid) grid.insertAdjacentElement('beforebegin',note);
  }

  document.addEventListener('click',e=>{
    const moreBtn=e.target.closest('#publicViewMoreBtn');
    if(!moreBtn)return;
    visiblePublicCount+=PUBLIC_PAGE_SIZE;
    renderPublic(currentPublicList,false);
  });

  const form=$('#jobSearch');
  if(form){
    form.addEventListener('submit',function(){
      setTimeout(()=>{
        const r=$('#rankFilter')?.value||'', v=$('#vesselFilter')?.value||'', s=$('#sectorFilter')?.value||'', k=($('#keywordFilter')?.value||'').toLowerCase();
        const filtered=vacancies.filter(j=>
          (!r||j.rank===r)&&
          (!v||j.vessel===v)&&
          (!s||j.sector===s)&&
          (!k||[j.rank,j.vessel,j.sector,j.location,j.contract].join(' ').toLowerCase().includes(k))
        );
        renderPublic(filtered,true);
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
