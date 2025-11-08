// Clean rebuilt main.js without duplicated / misplaced blocks
// Helper to safely inject text into HTML (prevents breaking markup)
function escapeHtml(str){
  if(str==null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ---- Admin demo (local only) ----
function initializeAdmin() {
  const grid = document.getElementById('reservations-grid');
  if (!grid) return;
  let bookings = JSON.parse(localStorage.getItem('brocode_bookings') || '[]');
  if (!bookings.length) {
    bookings = Array.from({ length: 5 }).map((_, i) => ({
      name: 'User '+(i+1), datetime: '2025-11-'+String(10+i).padStart(2,'0'), time: '10:0'+i,
      verified: i%2===0
    }));
    localStorage.setItem('brocode_bookings', JSON.stringify(bookings));
  }
  function render(){
    grid.innerHTML='';
    if (!bookings.length){ grid.innerHTML='<p class="empty">Belum ada reservasi</p>'; return; }
    bookings.forEach((b,i)=>{
      const card=document.createElement('div');
      card.className='reservation-card'+(b.verified?' verified':'');
      card.innerHTML=`<h3>${b.datetime} ${b.time}</h3><p><strong>Nama:</strong> ${b.name}</p>`;
      grid.appendChild(card);
    });
  }
  render();
}

// Splash helpers
function safeHideLoader(){ try { const el=document.getElementById('page-loader'); if (el) el.classList.add('hidden'); } catch(_){} }
function hideSplashScreen(){ try { const s=document.getElementById('splash-screen'); if (!s) return; if (!s.classList.contains('hide')) s.classList.add('hide'); setTimeout(()=>{ try{s.remove();}catch(_){}} ,1200); } catch(_){} }
let __splashStartAt = Date.now();

function setupCustomSelect(sel){
  const wrapper = document.querySelector(sel); if (!wrapper) return;
  const trigger = wrapper.querySelector('.custom-select-trigger');
  const options = wrapper.querySelector('.custom-select-options');
  // Hidden input could be placed outside wrapper; search nearby as fallback
  let hidden = wrapper.querySelector('input[type="hidden"]');
  if (!hidden){
    const group = wrapper.closest('.form-group');
    if (group) hidden = group.querySelector('input[type="hidden"]');
    if (!hidden){
      if (wrapper.classList.contains('service-select-wrapper')) hidden = document.getElementById('service-type');
      if (wrapper.classList.contains('capster-select-wrapper')) hidden = document.getElementById('capster-select-input');
    }
  }
  if (!trigger||!options) return;
  trigger.dataset.placeholder = trigger.innerHTML;
  trigger.addEventListener('click', e=>{ e.stopPropagation(); document.querySelectorAll('.custom-select-wrapper.open').forEach(w=>{ if(w!==wrapper) w.classList.remove('open'); }); wrapper.classList.toggle('open'); });
  options.addEventListener('click', e=>{ const li=e.target.closest('li'); if(!li||li.classList.contains('option-category')) return; if (hidden) hidden.value=li.dataset.value; const name=li.querySelector('.option-name')?.textContent||li.textContent; const price=li.querySelector('.option-price')?.textContent||''; trigger.innerHTML=`<span class="trigger-name">${name}</span>${price?`<span class=\"trigger-price\">${price}</span>`:''}`; trigger.classList.remove('placeholder'); wrapper.classList.remove('open'); });
}

function updateBookingLockState(){
  const isAdmin = localStorage.getItem('brocode_admin_logged')==='true';
  const isUser = localStorage.getItem('brocode_user_logged')==='true';
  const wrapper = document.querySelector('.book-form-wrapper');
  const lock = document.getElementById('booking-locked');
  const msg = document.getElementById('booking-locked-message');
  if (!wrapper||!lock) return;
  if (!isUser || isAdmin){
    wrapper.classList.add('locked'); lock.hidden=false; if (msg) msg.textContent = isAdmin? 'Admin tidak dapat melakukan reservasi.' : 'Silakan login sebagai pengguna untuk melakukan reservasi.';
  } else {
    wrapper.classList.remove('locked'); lock.hidden=true;
  }
}
try { window.updateBookingLockState = updateBookingLockState; } catch(_){}

document.addEventListener('DOMContentLoaded', () => {
  __splashStartAt = Date.now();
  window.addEventListener('load', ()=>{ safeHideLoader(); const elapsed=Date.now()-__splashStartAt; const remain=Math.max(0,4000-elapsed); setTimeout(hideSplashScreen, remain); });
  setTimeout(hideSplashScreen, 5000);

  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu){
    const toggle=()=>{ const exp = mobileMenuBtn.getAttribute('aria-expanded')==='true'; mobileMenuBtn.setAttribute('aria-expanded', String(!exp)); mobileMenu.classList.toggle('active'); };
    mobileMenuBtn.addEventListener('click', toggle);
    mobileMenu.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{ if(mobileMenu.classList.contains('active')) toggle(); }));
  }

  // Modals
  const loginModal = document.getElementById('login-modal-overlay');
  const registerModal = document.getElementById('register-modal-overlay');
  const loginBtn = document.getElementById('login-btn');
  // We'll dynamically replace login button with profile + logout if user logged in
  function applyAuthButtons(){
    const isUser = localStorage.getItem('brocode_user_logged')==='true' && localStorage.getItem('brocode_admin_logged')!=='true';
    const isAdmin = localStorage.getItem('brocode_admin_logged')==='true';
    const desktopContainer = loginBtn?.parentElement; // nav-wrapper
    if (!desktopContainer) return;
    // Remove existing dynamic buttons first
    desktopContainer.querySelectorAll('.nav-profile-btn, .nav-logout-btn').forEach(el=>el.remove());
    if (isUser){
      if (loginBtn) loginBtn.style.display='none';
  const profileA = document.createElement('a');
      profileA.href='/components/profile.html';
      profileA.textContent='PROFILE';
  profileA.className='btn btn-outline nav-profile-btn';
  profileA.style.marginRight = '8px';
      const logoutA = document.createElement('a');
      logoutA.href='#';
      logoutA.textContent='LOGOUT';
      logoutA.className='btn btn-outline nav-logout-btn';
      logoutA.addEventListener('click', (e)=>{ e.preventDefault(); if(confirm('Yakin ingin keluar?')){ localStorage.removeItem('brocode_user_logged'); localStorage.removeItem('brocode_user_email'); applyAuthButtons(); updateBookingLockState(); } });
      desktopContainer.insertBefore(profileA, loginBtn); // place before hidden login
      desktopContainer.insertBefore(logoutA, loginBtn);
    } else {
      // Show MASUK when not logged in (visitor)
      if (!isAdmin && loginBtn) loginBtn.style.display='inline-flex';
      if (isAdmin && loginBtn) loginBtn.style.display='none';
    }

    // Mobile menu version
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu){
      // Remove prior
      mobileMenu.querySelectorAll('.mobile-profile-btn, .mobile-logout-btn').forEach(el=>el.remove());
      const mobileLoginLink = mobileMenu.querySelector('.nav-login');
      if (isUser){
        if (mobileLoginLink) mobileLoginLink.style.display='none';
  const profileM = document.createElement('a');
        profileM.href='/components/profile.html';
        profileM.textContent='PROFILE';
  profileM.className='btn btn-outline mobile-profile-btn';
  profileM.style.marginTop = '10px';
        const logoutM = document.createElement('a');
        logoutM.href='#';
        logoutM.textContent='LOGOUT';
  logoutM.className='btn btn-outline mobile-logout-btn';
  logoutM.style.marginTop = '8px';
        logoutM.addEventListener('click', (e)=>{ e.preventDefault(); if(confirm('Yakin ingin keluar?')){ localStorage.removeItem('brocode_user_logged'); localStorage.removeItem('brocode_user_email'); applyAuthButtons(); updateBookingLockState(); const mmBtn=document.getElementById('mobile-menu-btn'); if(mmBtn && mobileMenu.classList.contains('active')) mmBtn.click(); } });
        mobileMenu.appendChild(profileM);
        mobileMenu.appendChild(logoutM);
      } else {
        // Visitor keeps login visible in mobile menu
        if (mobileLoginLink && !isAdmin) mobileLoginLink.style.display='inline-flex';
        if (isAdmin && mobileLoginLink) mobileLoginLink.style.display='none';
      }
    }
  }
  const signupLink = document.getElementById('signup-link');
  const loginLink = document.getElementById('login-link');
  const closeLoginBtn = document.getElementById('close-modal-btn');
  const closeRegisterBtn = document.querySelector('#register-modal-container .modal-close-btn');
  const showModal = (m)=>{ if(!m)return; loginModal?.classList.remove('active'); registerModal?.classList.remove('active'); m.classList.add('active'); };
  const hideModals = ()=>{ loginModal?.classList.remove('active'); registerModal?.classList.remove('active'); };
  loginBtn?.addEventListener('click', e=>{ e.preventDefault(); showModal(loginModal); });
  signupLink?.addEventListener('click', e=>{ e.preventDefault(); showModal(registerModal); });
  loginLink?.addEventListener('click', e=>{ e.preventDefault(); showModal(loginModal); });
  closeLoginBtn?.addEventListener('click', hideModals);
  closeRegisterBtn?.addEventListener('click', hideModals);
  loginModal?.addEventListener('click', e=>{ if(e.target===loginModal) hideModals(); });
  registerModal?.addEventListener('click', e=>{ if(e.target===registerModal) hideModals(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') hideModals(); });

  // Allow login from the booking restricted overlay
  const openLoginFromBook = document.getElementById('open-login-from-book');
  if (openLoginFromBook){
    openLoginFromBook.addEventListener('click', (e)=>{
      e.preventDefault();
      showModal(loginModal);
    });
  }

  // Custom selects
  setupCustomSelect('.service-select-wrapper');
  setupCustomSelect('.capster-select-wrapper');

  // Populate service and capster from API (Supabase-backed)
  const formatPrice = (v) => (v!=null && v!=='') ? `Rp${String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}` : '';
  async function loadServices(){
    const ul = document.querySelector('.service-select-wrapper .custom-select-options');
    const trigger = document.querySelector('.service-select-wrapper .custom-select-trigger');
    const hidden = document.getElementById('service-type');
    if (!ul || !hidden || !trigger) return;
    try {
  const resp = await fetch('/api/service'); // singular per Supabase table name requirement
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal memuat layanan');
      const items = Array.isArray(body.data)? body.data : [];
      // Normalisasi tipe layanan dari Supabase (regular / special / lainnya)
      const groups = items.reduce((acc,s)=>{
        const raw = String(s.type||'').toLowerCase();
        let key;
        if (raw.includes('regular')) key = 'REGULAR TREATMENT';
        else if (raw.includes('special')) key = 'SPECIAL TREATMENT';
        else key = 'LAINNYA';
        (acc[key] = acc[key] || []).push(s);
        return acc;
      },{});
      const order = ['REGULAR TREATMENT','SPECIAL TREATMENT','LAINNYA'];
      const parts = [];
      order.forEach(g=>{
        if (!groups[g] || !groups[g].length) return;
        parts.push(`<li class="option-category">— ${g} —</li>`);
        groups[g].forEach(s=>{
          const price = formatPrice(s.price);
          parts.push(`<li data-value="${escapeHtml(s.name)}"><span class="option-name">${escapeHtml(s.name)}</span> ${price?`<span class=\"option-price\">${price}</span>`:''}</li>`);
        });
      });
      if (!parts.length) parts.push('<li class="option-category">Tidak ada layanan</li>');
      ul.innerHTML = parts.join('');
      // Reset trigger to placeholder
      trigger.innerHTML = trigger.dataset.placeholder || 'Pilih Jenis Layanan';
      trigger.classList.add('placeholder');
      hidden.value = '';
    } catch(err){ console.error('loadServices', err); }
  }

  async function loadCapsters(){
    const ul = document.querySelector('.capster-select-wrapper .custom-select-options');
    const trigger = document.querySelector('.capster-select-wrapper .custom-select-trigger');
    const hidden = document.getElementById('capster-select-input');
    if (!ul || !hidden || !trigger) return;
    try {
  const resp = await fetch('/api/capster'); // singular per Supabase table name requirement
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal memuat capster');
      const items = Array.isArray(body.data)? body.data : [];
      const li = items.map(c=>{
        const id = c.id;
        const name = c.name || '-';
        const alias = c.alias ? `<em class=\"aka-name\">a.k.a ${escapeHtml(c.alias)}</em>` : '';
        // Store id as value for FK, keep readable name in text
        return `<li data-value="${String(id)}" data-name="${escapeHtml(name)}"><span class="option-name">${escapeHtml(name)} ${alias}</span></li>`;
      });
      if (!li.length) li.push('<li class="option-category">Tidak ada capster</li>');
      ul.innerHTML = li.join('');
      trigger.innerHTML = trigger.dataset.placeholder || 'Pilih Capster (Opsional)';
      trigger.classList.add('placeholder');
      hidden.value = '';
    } catch(err){ console.error('loadCapsters', err); }
  }

  // Kick off loading lists from server
  loadServices();
  loadCapsters();

  // Render Services section cards from Supabase
  async function renderServicesSection(){
    const hairGrid = document.getElementById('hair-services-grid');
    const specialGrid = document.getElementById('special-services-grid');
    if (!hairGrid && !specialGrid) return; // no services section on this page
    try {
      // Helper: fallback fetch direct to Supabase if backend returns kosong/err
      const fetchDirectSupabase = async () => {
        try {
          const url = (window.__SUPABASE_URL || '').replace(/\/$/, '')
          const key = window.__SUPABASE_ANON_KEY
          if (!url || !key) return []
          const r = await fetch(`${url}/rest/v1/service?select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
          })
          if (!r.ok) throw new Error('Supabase REST error')
          const rows = await r.json()
          return Array.isArray(rows) ? rows : []
        } catch (e) {
          console.warn('Fallback Supabase direct fetch failed:', e && e.message)
          return []
        }
      }

      // Primary: via backend API
      let items = []
      try {
        const resp = await fetch('/api/service')
        const body = await resp.json()
        if(!resp.ok) throw new Error(body.error||'Gagal memuat layanan')
        items = Array.isArray(body.data)? body.data : []
      } catch (apiErr) {
        console.warn('API /api/service gagal, mencoba fallback Supabase langsung...', apiErr && apiErr.message)
        items = await fetchDirectSupabase()
      }

      if (!items.length) {
        // Last resort: try direct even if API succeeded but kosong
        const maybe = await fetchDirectSupabase()
        if (maybe.length) items = maybe
      }
      // Normalisasi tipe agar lebih toleran terhadap variasi penulisan
      const regular = [];
      const special = [];
      items.forEach(s => {
        const raw = String(s.type||'').toLowerCase();
        if (raw.includes('regular')) regular.push(s);
        else if (raw.includes('special')) special.push(s);
      });

  // Debug log (bisa dihapus nanti jika sudah stabil)
  console.log('[Services] Total:', items.length, 'Regular:', regular.length, 'Special:', special.length);

      function toCard(s, idx){
        const price = formatPrice(s.price);
        const delay = ((idx % 5) + 1) * 0.1;
        const imgIdx = (idx % 3) + 1; // gunakan aset yang ada untuk placeholder visual
        const imgSrc = `/assets/capster-${imgIdx}.png`;
        return `<article class="capster-card fade-in-up" style="animation-delay: ${delay}s" data-service-id="${escapeHtml(String(s.id||''))}">
          <figure>
            <img src="${imgSrc}" alt="Ilustrasi Layanan: ${escapeHtml(s.name)}">
          </figure>
          <div class="capster-info">
            <h4>${escapeHtml(s.name)}</h4>
            <p>${escapeHtml(s.description||'')}</p>
            <div class="capster-social">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>
              <span>${price || 'Hubungi kami'}</span>
            </div>
          </div>
        </article>`;
      }

      if (hairGrid) {
        hairGrid.innerHTML = regular.length ? regular.slice(0,2).map((s,i)=>toCard(s,i)).join('') : '<p class="muted">Belum ada layanan Regular Treatment.</p>';
      }
      if (specialGrid) {
        specialGrid.innerHTML = special.length ? special.slice(0,2).map((s,i)=>toCard(s,i)).join('') : '<p class="muted">Belum ada layanan Special Treatment.</p>';
      }
    } catch(err){ console.error('renderServicesSection', err); if (hairGrid) hairGrid.innerHTML = '<p class="muted">Gagal memuat Regular Treatment.</p>'; if (specialGrid) specialGrid.innerHTML = '<p class="muted">Gagal memuat Special Treatment.</p>'; }
  }
  renderServicesSection();

  // Min date today
  const dateInput=document.getElementById('booking-date');
  if (dateInput){ const d=new Date(); const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); dateInput.min=`${yyyy}-${mm}-${dd}`; }

  // Click-to-book service shortcut (updates hidden input + visible trigger)
  document.body.addEventListener('click', e=>{
    const item = e.target.closest('.js-book-service');
    if(!item) return;
    const name = item.dataset.serviceName;
    if(!name) return;
    const input = document.getElementById('service-type');
    const trigger = document.querySelector('.service-select-wrapper .custom-select-trigger');
    if (input) input.value = name;
    if (trigger) {
      // Try to find the corresponding option to copy price too
      const opt = document.querySelector(`.service-select-wrapper li[data-value="${CSS.escape(name)}"]`);
      if (opt) {
        const optionText = opt.querySelector('.option-name')?.textContent || name;
        const optionPrice = opt.querySelector('.option-price')?.textContent || '';
        trigger.innerHTML = `<span class="trigger-name">${escapeHtml(optionText)}</span>${optionPrice ? ` <span class=\"trigger-price\">${escapeHtml(optionPrice)}</span>` : ''}`;
      } else {
        trigger.textContent = name;
      }
      trigger.classList.remove('placeholder');
    }
    try { typeof hideAllModals==='function' && hideAllModals(); } catch(_){}
    document.getElementById('book')?.scrollIntoView({behavior:'smooth'});
  });

  // Admin init
  if (document.body.classList.contains('admin-page')) initializeAdmin();

  // Booking lock
  updateBookingLockState();

  // Login/Register forms calling backend (simple role logic)
  const loginForm=document.getElementById('login-form');
  const registerForm=document.getElementById('register-form');
  if (loginForm){
    loginForm.addEventListener('submit', async e=>{
      e.preventDefault();
      const email=document.getElementById('login-email')?.value.trim();
      const password=document.getElementById('login-password')?.value;
      if(!email||!password){ alert('Email & password harus diisi!'); return; }
      try{
        const resp=await fetch('/api/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
        const data=await resp.json(); if(!resp.ok) throw new Error(data.error||'Login gagal');
        const role=data?.data?.role||'user';
        localStorage.setItem('brocode_user_email', email);
        if(role==='admin'){ 
          localStorage.setItem('brocode_admin_logged','true'); 
          localStorage.removeItem('brocode_user_logged'); 
          loginModal?.classList.remove('active'); 
          alert('Login berhasil sebagai admin. Mengalihkan ke halaman admin...');
          window.location.href='/admin.html'; 
          return; 
        }
        localStorage.setItem('brocode_user_logged','true'); 
        localStorage.removeItem('brocode_admin_logged');
        loginModal?.classList.remove('active'); 
        updateBookingLockState();
        applyAuthButtons();
        alert('Login berhasil! Selamat datang kembali.');
      } catch(err){ 
        if (err.message && err.message.toLowerCase().includes('invalid')) {
          alert('Email atau password tidak cocok. Silakan periksa kembali.');
        } else {
          alert(err.message || 'Terjadi kesalahan saat login. Coba lagi nanti.');
        }
      }
    });
  }
  if (registerForm){
    registerForm.addEventListener('submit', async e=>{
      e.preventDefault();
      const name=document.getElementById('register-name')?.value.trim();
      const email=document.getElementById('register-email')?.value.trim();
      const password=document.getElementById('register-password')?.value;
      const confirm=document.getElementById('register-confirm-password')?.value;
      if(!name||!email||!password){ alert('Semua field wajib diisi.'); return; }
      if(password!==confirm){ alert('Konfirmasi password tidak cocok.'); return; }
      try{
        const resp=await fetch('/api/register',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
        const data=await resp.json(); if(!resp.ok) throw new Error(data.error||'Registrasi gagal');
        localStorage.setItem('brocode_user_logged','true'); localStorage.setItem('brocode_user_email', email); localStorage.removeItem('brocode_admin_logged');
        registerModal?.classList.remove('active'); 
        updateBookingLockState(); 
        applyAuthButtons();
        alert('Registrasi berhasil! Anda sudah otomatis login. Selamat datang.');
      } catch(err){ 
        if (err.message && err.message.toLowerCase().includes('exists')) {
          alert('Email sudah terdaftar. Silakan gunakan email lain atau login.');
        } else {
          alert(err.message || 'Gagal registrasi. Coba beberapa saat lagi.');
        }
      }
    });
  }

  // Initial render of auth buttons when page loads
  applyAuthButtons();

  // Pricelist modals (static content, no fetch)
  const hairModal=document.getElementById('hair-modal-overlay');
  const specialModal=document.getElementById('special-modal-overlay');
  const showHairBtn=document.getElementById('show-hair-pricelist-btn');
  const closeHairBtn=document.getElementById('close-hair-modal-btn');
  const showSpecialBtn=document.getElementById('show-special-pricelist-btn');
  const closeSpecialBtn=document.getElementById('close-special-modal-btn');
  async function populatePricelist(modEl, type){
    if(!modEl) return;
    try {
  const resp = await fetch('/api/service'); // singular per Supabase table name requirement
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal memuat layanan');
      const items = (body.data||[]).filter(s => String(s.type||'').toLowerCase().includes(type));
      const cols = modEl.querySelectorAll('.pricelist-items');
      if(!cols.length) return;
      const chunk = Math.ceil(items.length/2) || 1;
      const col1 = items.slice(0,chunk);
      const col2 = items.slice(chunk);
      function toLi(s){ const price = (s.price!=null && s.price!=='') ? `Rp${String(s.price).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}` : ''; return `<div class="service-item js-book-service" data-service-name="${escapeHtml(s.name)}"><div class="service-info"><h4>${escapeHtml(s.name)}</h4><p>${escapeHtml(s.description||'')}</p></div><div class="price">${price}</div></div>`; }
      cols[0].innerHTML = col1.length? col1.map(toLi).join('') : '<div class="service-item"><div class="service-info"><h4>Tidak ada layanan</h4></div></div>';
      if(cols[1]) cols[1].innerHTML = col2.length? col2.map(toLi).join('') : '';
    } catch(err){ console.error('populatePricelist', err); }
  }
  function hideAllModals(){ hairModal?.classList.remove('active'); specialModal?.classList.remove('active'); }
  if(showHairBtn&&hairModal&&closeHairBtn){ 
  showHairBtn.addEventListener('click',()=>{ populatePricelist(hairModal,'regular'); hairModal.classList.add('active'); }); 
    closeHairBtn.addEventListener('click',()=>hairModal.classList.remove('active')); 
    hairModal.addEventListener('click',e=>{ if(e.target===hairModal) hairModal.classList.remove('active'); }); 
  }
  if(showSpecialBtn&&specialModal&&closeSpecialBtn){ 
  showSpecialBtn.addEventListener('click',()=>{ populatePricelist(specialModal,'special'); specialModal.classList.add('active'); }); 
    closeSpecialBtn.addEventListener('click',()=>specialModal.classList.remove('active')); 
    specialModal.addEventListener('click',e=>{ if(e.target===specialModal) specialModal.classList.remove('active'); }); 
  }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') hideAllModals(); });
  window.addEventListener('click', e=>{ document.querySelectorAll('.custom-select-wrapper.open').forEach(w=>{ if(!w.contains(e.target)) w.classList.remove('open'); }); });

  // Service quick book (already handled above) ensures no duplicate logic

  // Navbar scroll effect
  const navbar=document.querySelector('.navbar');
  if (navbar){ window.addEventListener('scroll', ()=>{ if(window.scrollY>50) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled'); }); }

  // Active nav links
  const sections=document.querySelectorAll('section[id]');
  const navLinks=document.querySelectorAll('.nav-menu .nav-link, .mobile-menu .nav-link');
  if (sections.length && navLinks.length){
    const sectionObserver=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{ if(entry.isIntersecting){ const id=entry.target.id; navLinks.forEach(l=>{ l.classList.remove('active'); if(l.getAttribute('data-section')===id) l.classList.add('active'); }); } });
    },{threshold:0.4});
    sections.forEach(sec=>sectionObserver.observe(sec));
  }

  // Scroll animations
  const animatedEls=document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right');
  if (animatedEls.length){
    const animObs=new IntersectionObserver((entries,obs)=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('animated'); obs.unobserve(en.target); } }); },{threshold:0.1});
    animatedEls.forEach(el=>animObs.observe(el));
  }

  // Back to top
  const backBtn=document.getElementById('back-to-top');
  if (backBtn){ window.addEventListener('scroll',()=>{ if(window.scrollY>300) backBtn.classList.add('show'); else backBtn.classList.remove('show'); }); backBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'})); }

  // Form validation (contact/book form simplified)
  const contactForm=document.getElementById('contact-form');
  const successNotification=document.getElementById('success-notification');
  function validateForm(){ let ok=true; const req=['name','phone','service-type','booking-date','booking-time']; req.forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.classList.remove('error'); const val=el.value.trim(); if(!val){ ok=false; el.classList.add('error'); } }); return ok; }
  contactForm?.addEventListener('submit', async e=>{ 
    e.preventDefault(); 
    if(!validateForm()) return; 
    // Build payload for backend
    const name = document.getElementById('name')?.value.trim();
    const phoneRaw = document.getElementById('phone')?.value.trim();
    const date = document.getElementById('booking-date')?.value;
    const time = document.getElementById('booking-time')?.value;
    const service = document.getElementById('service-type')?.value;
    const capsterIdStr = document.getElementById('capster-select-input')?.value || '';
  const message = document.getElementById('message')?.value.trim();
    const email = localStorage.getItem('brocode_user_email') || null;
    // Sanitize phone to digits only to satisfy int8 column
    const phoneDigits = (phoneRaw || '').replace(/[^0-9]/g, '');
    const phone = phoneDigits ? Number(phoneDigits) : null;
    const capsterId = capsterIdStr ? Number(capsterIdStr) : null;
    // Send capster name separately as `capster`; backend will store in appointment and auxiliary tables.
  const payload = { name, email, phone, date, time, service, capsterId, status: 'pending', notes: message, timestamp: new Date().toISOString() };
    try {
  const resp = await fetch('/api/appointment', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) }); // singular per Supabase table name requirement
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error || 'Gagal membuat reservasi');
      // Success notification + local cache for profile mirror (optional)
      const stored = JSON.parse(localStorage.getItem('brocode_bookings')||'[]');
  stored.push({ ...payload, datetime: date, time, id: body.data?.id, status:'pending' });
      localStorage.setItem('brocode_bookings', JSON.stringify(stored));
      successNotification?.classList.add('show');
      setTimeout(()=>successNotification?.classList.remove('show'),3000);
      alert('Permintaan reservasi berhasil dikirim. Menunggu konfirmasi admin.');
      contactForm.reset();
      document.querySelectorAll('.custom-select-trigger').forEach(t=>{ t.innerHTML=t.dataset.placeholder||t.innerHTML; t.classList.add('placeholder'); });
    } catch(err){
      alert(err.message || 'Gagal mengirim reservasi. Coba lagi.');
    }
  });

  // Counter animation
  const counters=document.querySelectorAll('.counter');
  if (counters.length){ const counterObs=new IntersectionObserver((entries,obs)=>{ entries.forEach(en=>{ if(en.isIntersecting){ const target=+en.target.getAttribute('data-target'); let cur=0; const step=Math.max(1,Math.floor(2000/target)); const timer=setInterval(()=>{ cur++; en.target.textContent=cur; if(cur>=target){ clearInterval(timer); en.target.textContent=target; } },step); obs.unobserve(en.target); } }); },{threshold:0.8}); counters.forEach(c=>counterObs.observe(c)); }

  // Ripple effect for service cards
  document.body.addEventListener('click', e=>{ const card=e.target.closest('.service-card'); if(!card) return; const ripple=document.createElement('span'); ripple.className='card-ripple'; const r=card.getBoundingClientRect(); const size=Math.max(r.width,r.height); const x=e.clientX-r.left-size/2; const y=e.clientY-r.top-size/2; ripple.style.width=ripple.style.height=size+'px'; ripple.style.left=x+'px'; ripple.style.top=y+'px'; card.appendChild(ripple); ripple.addEventListener('animationend',()=>ripple.remove()); });

  // Accessibility focus outline toggle
  document.body.addEventListener('mousedown',()=>document.body.classList.remove('keyboard-nav'));
  document.body.addEventListener('keydown',e=>{ if(e.key==='Tab') document.body.classList.add('keyboard-nav'); });
});

if(false){

  const navbar = document.querySelector('.navbar');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-confirm-password').value;
      if (!name || !email || !password) { alert('Semua field wajib diisi.'); return; }
      if (password !== confirm) { alert('Konfirmasi password tidak cocok.'); return; }

      try {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error || 'Gagal registrasi');

        // Default role user setelah register
        localStorage.setItem('brocode_user_logged', 'true');
        localStorage.setItem('brocode_user_email', email);
        localStorage.removeItem('brocode_admin_logged');

        const rm = document.getElementById('register-modal-overlay'); if (rm) rm.classList.remove('active');
        try { (typeof updateBookingLockState==='function') && updateBookingLockState(); } catch(_){ }
        alert('Registrasi berhasil. Akun Anda sudah login.');
      } catch (err) {
        alert(err.message || 'Registrasi gagal');
      }
    });
  }
  if (animatedElements.length > 0) {
  const animationObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
  }, { threshold: 0.1 });
  animatedElements.forEach(el => {
      animationObserver.observe(el);
  });
  }

  // --- 6. Back to Top Button ---
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
  window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('show');
      } else {
        backToTopBtn.classList.remove('show');
      }
  });
  backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  }

  // --- 7. Form Validation ---
  const contactForm = document.getElementById('contact-form');
  const successNotification = document.getElementById('success-notification');
  const getErrorMessage = (id) => {
    switch (id) {
      case 'name': return 'Nama Lengkap tidak boleh kosong.';
      case 'phone': return 'Nomor telepon tidak valid.';
      case 'service-type': return 'Silakan pilih jenis pesanan.';
      case 'booking-date': return 'Tanggal tidak valid (tidak boleh tanggal yang sudah lewat).';
      case 'booking-time': return 'Jam harus antara 10:00 - 21:00.';
      case 'capster-select': return 'Silakan pilih capster.';
      case 'message': return 'Pesan tidak boleh kosong.';
      default: return 'Field ini wajib diisi.';
    }
  };
  const validateForm = () => {
  let isValid = true;
  const fields = [
      { id: 'name', regex: /.+/ },
      { id: 'phone', regex: /^\+?[0-9\s-]{8,}$/ },
      { id: 'service-type', regex: /.+/ },
      { id: 'booking-date', regex: /.+/ },
      { id: 'booking-time', regex: /.+/ },
      // { id: 'message', regex: /.+/ } // Pesan sekarang opsional
  ];
  fields.forEach(field => {
      const input = document.getElementById(field.id);
      const errorEl = document.getElementById(`${field.id}-error`) || document.getElementById(`${field.id.replace('booking-','booking-')}-error`) || document.getElementById(`${field.id}-error`);
      if (input) {
      // Validasi untuk custom dropdown
      const isCustomSelect = input.tagName === 'INPUT' && input.type === 'hidden';
      const trigger = isCustomSelect ? input.closest('.form-group').querySelector('[class*="-trigger"]') : null;
      
        input.classList.remove('error');
      if (trigger) trigger.classList.remove('error');
        if (errorEl) errorEl.style.display = 'none';
      
      const valueToTest = input.value.trim();

        if (!field.regex.test(valueToTest)) {
          isValid = false;
          input.classList.add('error');
          if (trigger) trigger.classList.add('error'); // Tambahkan error ke trigger
          if (errorEl) {
            errorEl.textContent = getErrorMessage(field.id);
            errorEl.style.display = 'block';
          }
        }
      }
  });

    // Validasi lanjutan untuk tanggal (tidak boleh masa lalu)
    const dateInput = document.getElementById('booking-date');
    const dateError = document.getElementById('booking-date-error');
    if (dateInput && dateInput.value) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const sel = new Date(dateInput.value + 'T00:00:00');
      if (isNaN(sel.getTime()) || sel < today) {
        isValid = false;
        dateInput.classList.add('error');
        if (dateError) { dateError.textContent = getErrorMessage('booking-date'); dateError.style.display = 'block'; }
      }
    }

    // Validasi lanjutan untuk jam (10:00 - 21:00)
    const timeInput = document.getElementById('booking-time');
    const timeError = document.getElementById('booking-time-error');
    if (timeInput && timeInput.value) {
      const [hh, mm] = timeInput.value.split(':').map(Number);
      const minutes = (hh * 60) + (mm || 0);
      const minAllowed = 10 * 60;   // 10:00
      const maxAllowed = 21 * 60;   // 21:00
      if (isNaN(minutes) || minutes < minAllowed || minutes > maxAllowed) {
        isValid = false;
        timeInput.classList.add('error');
        if (timeError) { timeError.textContent = getErrorMessage('booking-time'); timeError.style.display = 'block'; }
      }
    }
  return isValid;
  };
  if (contactForm && successNotification) {
  contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validateForm()) {
        console.log('Form valid, mengirim data...');
        successNotification.classList.add('show');
        setTimeout(() => {
          successNotification.classList.remove('show');
        }, 3000);
        contactForm.reset();
        // Reset custom dropdowns
        document.querySelectorAll('.custom-select-trigger').forEach(trigger => {
          trigger.innerHTML = trigger.dataset.placeholder; // Kembali ke placeholder
          trigger.classList.add('placeholder');
        });
      } else {
        console.log('Form tidak valid.');
      }
  });
  }

  // --- 8. Counter Animation (IntersectionObserver) ---
  const counters = document.querySelectorAll('.counter');
  if (counters.length > 0) {
  let counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = +counter.getAttribute('data-target');
          let current = 0;
          const duration = 2000;
          const stepTime = Math.max(1, Math.abs(Math.floor(duration / target)));
          const timer = setInterval(() => {
            current += 1;
            counter.textContent = current;
            if (current >= target) {
              counter.textContent = target;
              clearInterval(timer);
            }
          }, stepTime);
            observer.unobserve(counter);
        }
      });
  }, { threshold: 0.8 });
  counters.forEach(counter => {
      counterObserver.observe(counter);
  });
  }

  // --- 9. Service Card Ripple Effect ---
  document.body.addEventListener('click', function(e) {
  const card = e.target.closest('.service-card');
  if (card) {
      const ripple = document.createElement('span');
      ripple.classList.add('card-ripple');
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      card.appendChild(ripple);
      ripple.addEventListener('animationend', () => {
        ripple.remove();
      });
  }
  });

  // --- 10. Accessibility (Keyboard Navigation) ---
  document.body.addEventListener('mousedown', () => {
  document.body.classList.remove('keyboard-nav');
  });
  document.body.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
      document.body.classList.add('keyboard-nav');
  }
  });

  // --- 11. Login and Register Modal Logic ---
  const loginBtn = document.getElementById('login-btn');
  const loginModalOverlay = document.getElementById('login-modal-overlay');
  const registerModalOverlay = document.getElementById('register-modal-overlay');
  const closeLoginBtn = document.getElementById('close-modal-btn');
  const closeRegisterBtn = document.querySelector('#register-modal-container .modal-close-btn');
  const navLoginBtn = document.querySelector('.mobile-menu .nav-login');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const signupLink = document.getElementById('signup-link');
  const loginLink = document.getElementById('login-link');
  // Ensure menu refs exist in this scope
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');

  // Function to handle modal visibility
  const showModal = (modal) => {
    loginModalOverlay.classList.remove('active');
    registerModalOverlay.classList.remove('active');
    modal.classList.add('active');
  };

  const hideModals = () => {
    loginModalOverlay.classList.remove('active');
    registerModalOverlay.classList.remove('active');
  };

  // Login button clicks
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showModal(loginModalOverlay);
    });
  }

  if (navLoginBtn && mobileMenu) {
    navLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileMenu.classList.contains('active')) {
        mobileMenuBtn.click();
      }
      showModal(loginModalOverlay);
    });
  }

  // Switch between login and register
  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      showModal(registerModalOverlay);
    });
  }

  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showModal(loginModalOverlay);
    });
  }

  // Close buttons
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', hideModals);
  }
  if (closeRegisterBtn) {
    closeRegisterBtn.addEventListener('click', hideModals);
  }

  // Click outside to close (guard elements exist)
  if (loginModalOverlay) {
    loginModalOverlay.addEventListener('click', (e) => {
      if (e.target === loginModalOverlay) hideModals();
    });
  }
  if (registerModalOverlay) {
    registerModalOverlay.addEventListener('click', (e) => {
      if (e.target === registerModalOverlay) hideModals();
    });
  }

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModals();
  });
  // Form submissions dengan validasi admin
  // --- GANTI BAGIAN INI SAJA ---
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      // VALIDASI SEDERHANA (bisa diganti Firebase nanti)
      if (!email || !password) {
        alert('Email & password harus diisi!');
        return;
      }

      // ADMIN DETECTED: set flag and redirect to a server-served admin page
      if (email === 'admin@brocode.com' && password === '1') {
        localStorage.setItem('brocode_admin_logged', 'true');
        localStorage.setItem('brocode_user_email', email);
        const lm = document.getElementById('login-modal-overlay'); if (lm) lm.classList.remove('active');
        // Redirect to admin page served by the backend (public/admin.html)
        window.location.href = '/admin.html';
        return;
      }

      // USER BIASA: cek akun terdaftar di localStorage
      const raw = localStorage.getItem('brocode_accounts') || '[]';
      let accounts = [];
      try { accounts = JSON.parse(raw) || []; } catch(_) { accounts = []; }
      const found = accounts.find(a => a.email === email && a.password === password);
      if (found) {
        localStorage.setItem('brocode_user_logged', 'true');
        localStorage.setItem('brocode_user_email', email);
        localStorage.removeItem('brocode_admin_logged');

        const lm = document.getElementById('login-modal-overlay'); if (lm) lm.classList.remove('active');

        document.querySelectorAll('.nav-login').forEach(btn => {
          btn.innerHTML = `Hi, ${found.name || email.split('@')[0]} <span>Logout</span>`;
          btn.onclick = () => {
            localStorage.removeItem('brocode_user_logged');
            localStorage.removeItem('brocode_user_email');
            location.reload();
          };
        });

        // Unlock booking
        const evt = new Event('storage'); window.dispatchEvent(evt);
        const bookWrapper = document.querySelector('.book-form-wrapper');
        if (bookWrapper) {
          // call function if present
          try { (typeof updateBookingLockState==='function') && updateBookingLockState(); } catch(_){}
        }
        alert('Login berhasil.');
      } else {
        alert('Email atau password salah!');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-confirm-password').value;
      if (!name || !email || !password) { alert('Semua field wajib diisi.'); return; }
      if (password !== confirm) { alert('Konfirmasi password tidak cocok.'); return; }
      let accounts = [];
      try { accounts = JSON.parse(localStorage.getItem('brocode_accounts')||'[]') || []; } catch(_) {}
      if (accounts.some(a => a.email === email)) { alert('Email sudah terdaftar.'); return; }
      accounts.push({ name, email, password, createdAt: new Date().toISOString() });
      localStorage.setItem('brocode_accounts', JSON.stringify(accounts));

      // Auto-login sebagai user setelah daftar
      localStorage.setItem('brocode_user_logged', 'true');
      localStorage.setItem('brocode_user_email', email);
      localStorage.removeItem('brocode_admin_logged');

      const rm = document.getElementById('register-modal-overlay'); if (rm) rm.classList.remove('active');

      document.querySelectorAll('.nav-login').forEach(btn => {
        btn.innerHTML = `Hi, ${name || email.split('@')[0]} <span>Logout</span>`;
        btn.onclick = () => {
          localStorage.removeItem('brocode_user_logged');
          localStorage.removeItem('brocode_user_email');
          location.reload();
        };
      });
      // Unlock booking
      try { (typeof updateBookingLockState==='function') && updateBookingLockState(); } catch(_){}
      alert('Registrasi berhasil. Akun Anda sudah login.');
    });
  }
  // ===============================================
  // --- 12. PRICELIST MODAL LOGIC (DIPERBAIKI) ---
  // ===============================================
  
  // Ambil referensi ke modal SATU KALI saja
  const hairModal = document.getElementById('hair-modal-overlay');
  const specialModal = document.getElementById('special-modal-overlay');
  
  // Fungsi untuk menutup SEMUA modal
  function hideAllModals() {
  if (hairModal) hairModal.classList.remove('active');
  if (specialModal) specialModal.classList.remove('active');
  }

  // Logika untuk Modal Hair Treatment
  const showHairBtn = document.getElementById('show-hair-pricelist-btn');
  const closeHairBtn = document.getElementById('close-hair-modal-btn');
  if (showHairBtn && hairModal && closeHairBtn) {
  showHairBtn.addEventListener('click', () => hairModal.classList.add('active'));
  closeHairBtn.addEventListener('click', () => hairModal.classList.remove('active'));
  hairModal.addEventListener('click', (e) => {
      if (e.target === hairModal) hairModal.classList.remove('active');
  });
  }

  // Logika untuk Modal Special Treatment
  const showSpecialBtn = document.getElementById('show-special-pricelist-btn');
  const closeSpecialBtn = document.getElementById('close-special-modal-btn');
  if (showSpecialBtn && specialModal && closeSpecialBtn) {
  showSpecialBtn.addEventListener('click', () => specialModal.classList.add('active'));
  closeSpecialBtn.addEventListener('click', () => specialModal.classList.remove('active'));
  specialModal.addEventListener('click', (e) => {
      if (e.target === specialModal) specialModal.classList.remove('active');
  });
  }
  
  // Event listener global untuk tombol Escape
  document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
      hideAllModals();
  }
  });

  // Custom select helper already declared above (to avoid duplicate function declarations).
  // Ensure dropdowns close when clicking outside (single global handler).
  window.addEventListener('click', (e) => {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(wrapper => {
      if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
    });
  });


  // (Duplicate quick-book listener removed; single handler earlier handles booking shortcut.)
}