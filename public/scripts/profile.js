// Profile page logic: fetch appointments from backend, filter by logged user, render cards
(function(){
  function getCurrentUser(){
    // Preferred: stored full object
    try {
      const raw = localStorage.getItem('brocode_user');
      if (raw){
        const obj = JSON.parse(raw);
        if (obj && (obj.email || obj.name)) return obj;
      }
    } catch(_){}
    // Fallback: boolean + email from legacy flows
    const isUser = localStorage.getItem('brocode_user_logged') === 'true';
    const email = localStorage.getItem('brocode_user_email') || null;
    if (isUser && email){
      let name = null;
      try {
        const accounts = JSON.parse(localStorage.getItem('brocode_accounts')||'[]');
        const acc = Array.isArray(accounts) ? accounts.find(a=>a && a.email===email) : null;
        name = acc?.name || null;
      } catch(_){}
      if (!name) name = email.split('@')[0];
      const u = { email, name };
      try { localStorage.setItem('brocode_user', JSON.stringify(u)); } catch(_){}
      return u;
    }
    return null;
  }

  const user = getCurrentUser();
  if (!user){
    alert('Silakan login dulu sebagai pengguna!');
    window.location.href = '/';
    return;
  }

  const grid = document.getElementById('grid');
  const emptyEl = document.getElementById('empty');
  const loading = document.getElementById('loading');
  const statusFilter = document.getElementById('statusFilter');
  const filtersWrap = document.getElementById('filters');
  const logoutBtn = document.getElementById('logout-btn');

  if (logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      if (confirm('Yakin mau logout?')){
        try {
          // Bersihkan semua state login user/admin yang digunakan aplikasi
          localStorage.removeItem('brocode_user');
          localStorage.removeItem('brocode_user_logged');
          localStorage.removeItem('brocode_user_email');
          localStorage.removeItem('brocode_admin_logged');
        } catch(_){}
        // Kembali ke homepage setelah benar-benar logout
        window.location.replace('/');
      }
    });
  }

  let allBookings = [];
  let capsterMap = {};
  let visible = [];

  function normalizeStatus(v){
    const s = String(v||'pending').trim().toLowerCase();
    if (s.startsWith('acc') || s.startsWith('app')) return 'approved';
    if (s.startsWith('rej') || s.startsWith('not')) return 'not approved';
    return 'pending';
  }

  function applyFilter(){
    const sel = statusFilter.value;
    visible = allBookings.filter(b => sel==='all' ? true : normalizeStatus(b.status) === sel);
    render();
  }

  function render(){
    grid.innerHTML='';
    if(!visible.length){
      emptyEl.style.display='block';
    } else {
      emptyEl.style.display='none';
    }
    visible.forEach(b => {
      const card = document.createElement('div');
      card.className='card';
      const nStatus = normalizeStatus(b.status);
      card.innerHTML = `
        <h3>${b.date||'-'} — ${b.time||'-'}</h3>
        <div class="row"><strong>Layanan:</strong><span>${b.service||'-'}</span></div>
        <div class="row"><strong>Capster:</strong><span>${b.capsterName || '-'}</span></div>
        ${b.notes?`<div class="row"><strong>Catatan:</strong><span>${b.notes}</span></div>`:''}
        <div class="status-badge status-${nStatus.replace(/\s+/g,'-')}">${nStatus.toUpperCase()}</div>
      `;
      grid.appendChild(card);
    });
  }

  async function fetchAppointments(){
    try {
      const resp = await fetch('/api/appointment');
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal ambil data');
      const rows = Array.isArray(body.data)? body.data : [];
      // Filter by matching user email OR name
      const loweredName = (user.name||'').toLowerCase();
      const loweredEmail = (user.email||'').toLowerCase();
      const filtered = rows.filter(r => (r.email && r.email.toLowerCase()===loweredEmail) || (r.name && r.name.toLowerCase()===loweredName));
      // Enrich with capsterName using capsterId mapping
      allBookings = filtered.map(r => {
        const id = r.capsterId ?? r.capster_id;
        const capName = (id != null) ? (capsterMap[String(id)] || `#${id}`) : '-';
        return { ...r, capsterName: capName };
      });
      visible = [...allBookings];
      if(allBookings.length){ filtersWrap.hidden=false; }
      render();
    } catch(err){
      console.error('Fetch appointments (profile) error', err.message);
      emptyEl.style.display='block';
    } finally {
      if (loading) loading.remove();
    }
  }

  async function fetchCapsters(){
    try{
      const resp = await fetch('/api/capster');
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal memuat capster');
      const rows = Array.isArray(body.data)? body.data : [];
      capsterMap = rows.reduce((m,c)=>{ if(c && c.id!=null) m[String(c.id)] = c.name || `Capster #${c.id}`; return m; }, {});
    }catch(err){ console.warn('Capster map (profile) error:', err.message); capsterMap = {}; }
  }

  statusFilter.addEventListener('change', applyFilter);

  (async()=>{ await fetchCapsters(); await fetchAppointments(); })();
})();
