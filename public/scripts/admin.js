// Admin page: load appointments from Supabase via backend API
(function(){
  // Require admin login
  if (localStorage.getItem('brocode_admin_logged') !== 'true') {
    alert('Login dulu sebagai admin!');
    window.location.href = '/';
    return;
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      if (confirm('Yakin mau logout?')){
        localStorage.removeItem('brocode_admin_logged');
        window.location.href = '/';
      }
    });
  }
  const grid = document.getElementById('grid');
  const emptyEl = document.getElementById('empty');
  const trash = document.getElementById('trash');
  let dragged = null;
  let bookings = [];
  let capsterMap = {};

  // Hide loader when ready
  function hideLoader(){
    const l = document.getElementById('loader');
    if (!l) return; l.style.opacity='0'; setTimeout(()=>l.remove(), 500);
  }

  async function fetchCapsters(){
    try{
      const resp = await fetch('/api/capster');
      const body = await resp.json();
      if(!resp.ok) throw new Error(body.error||'Gagal memuat capster');
      const rows = Array.isArray(body.data)? body.data : [];
      capsterMap = rows.reduce((m,c)=>{ if(c && c.id!=null) m[String(c.id)] = c.name || `Capster #${c.id}`; return m; }, {});
    }catch(err){ console.warn('Capster map error:', err.message); capsterMap = {}; }
  }

  async function fetchBookings(){
    try {
      const resp = await fetch('/api/appointment');
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error||'Gagal mengambil data');
      bookings = Array.isArray(body.data) ? body.data : [];
      render();
    } catch(err){
      console.error('Fetch appointments error', err.message);
      bookings = [];
      render();
      alert('Gagal memuat daftar reservasi dari server.');
    }
    hideLoader();
  }

  async function toggleVerify(idx){
    const b = bookings[idx]; if(!b) return;
    const newStatus = 'approved';
    try {
      const resp = await fetch(`/api/appointment/${b.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
      let body = null; try { body = await resp.json(); } catch(_) {}
      if(!resp.ok) throw new Error((body && body.error) || 'Gagal update status');
      b.status = newStatus; render();
    } catch(err){ alert(err.message||'Gagal mengubah status'); }
  }

  async function deleteBooking(idx){
    const b = bookings[idx]; if(!b) return;
    if(!confirm(`Hapus reservasi dari ${b.name}?`)) return;
    try {
      const resp = await fetch(`/api/appointment/${b.id}`, { method:'DELETE' });
      if(!resp.ok && resp.status!==204) throw new Error('Gagal hapus reservasi');
      bookings.splice(idx,1); render();
    } catch(err){ alert(err.message||'Gagal menghapus reservasi'); }
  }

  function normalizeStatus(v){
    const s = String(v||'pending').trim().toLowerCase();
    if (s.startsWith('acc')) return 'approved';
    if (s.startsWith('app')) return 'approved';
    if (s.startsWith('rej')) return 'not approved';
    if (s.startsWith('not')) return 'not approved';
    return 'pending';
  }

  function isApproved(b){ return normalizeStatus(b.status) === 'approved'; }

  function statusBadge(b){
    const s = normalizeStatus(b.status);
    if (s === 'approved') return '✓';
    if (s === 'not approved') return '✗';
    return '•';
  }

  function render(){
    if(!grid) return;
    grid.innerHTML='';
    if(!bookings.length){ if(emptyEl) emptyEl.style.display='block'; return; }
    if(emptyEl) emptyEl.style.display='none';
    bookings.forEach((b,i)=>{
      const card=document.createElement('div');
  const verified = isApproved(b);
      card.className='card '+(verified?'verified':'');
      card.draggable=true; card.dataset.index=i;
      const capName = (b.capsterId!=null) ? (capsterMap[String(b.capsterId)] || `#${b.capsterId}`) : '-';
  card.innerHTML=`<div class="card-content">\n          <h3>${b.date||'-'} — ${b.time||'-'} ${statusBadge(b)}</h3>\n          <p><strong>Nama:</strong> ${b.name||'-'}</p>\n          <p><strong>Telepon:</strong> ${b.phone||'-'}</p>\n          <p><strong>Email:</strong> ${b.email||'-'}</p>\n          <p><strong>Capster:</strong> ${capName}</p>\n          <p><strong>Layanan:</strong> ${b.service||'-'}</p>\n          ${b.notes?`<p><strong>Catatan:</strong> ${b.notes}</p>`:''}\n        </div>\n        <div class="verify-container">\n          <label class="approve-toggle" title="Setujui">
    <input type="checkbox" class="approve-checkbox" data-idx="${i}" ${verified?'checked':''} />
    <span class="checkmark"></span>
    <span class="label-text">${verified?'Approved':'Approve'}</span>
      </label>\n        </div>`;
      card.addEventListener('dragstart',()=>{ dragged=card; card.classList.add('dragging'); });
      card.addEventListener('dragend',()=>{ card.classList.remove('dragging'); dragged=null; });
      grid.appendChild(card);
    });
    grid.querySelectorAll('.approve-checkbox').forEach(cb=>{
      cb.addEventListener('change', async ()=>{
        const idx = Number(cb.dataset.idx);
        const b = bookings[idx]; if(!b) return;
        // Hanya izinkan perubahan ke approved lewat checkbox; unapprove via trash
        if (!isApproved(b)){
          const prev = cb.checked;
          cb.disabled = true;
          try{ await toggleVerify(idx); } finally { cb.disabled=false; }
          // sinkronkan dengan data terbaru
          cb.checked = isApproved(bookings[idx]);
        } else {
          // Sudah approved; jaga tetap checked (unapprove via trash)
          cb.checked = true;
        }
      });
    });
  }

  if (trash){
    trash.addEventListener('dragover',e=>{ e.preventDefault(); trash.classList.add('drag-over'); });
    trash.addEventListener('dragleave',()=>trash.classList.remove('drag-over'));
    trash.addEventListener('drop',async e=>{ 
      e.preventDefault();
      trash.classList.remove('drag-over');
      const d=document.querySelector('.card.dragging'); if(!d) return; 
      const idx = Number(d.dataset.index);
      const b = bookings[idx]; if(!b) return;
      try {
        const resp = await fetch(`/api/appointment/${b.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'not approved' }) });
        let body = null; try { body = await resp.json(); } catch(_) {}
        if(!resp.ok) throw new Error((body && body.error) || 'Gagal set not approved');
        b.status = 'not approved';
        render();
      } catch(err){ alert(err.message||'Gagal mengubah status'); }
    });
  }

  // Initial fetch (ensure capsterMap ready for name mapping)
  (async()=>{ await fetchCapsters(); await fetchBookings(); })();
  // Periodic refresh
  setInterval(fetchBookings, 30000);
})();
 
