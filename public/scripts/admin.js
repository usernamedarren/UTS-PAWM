// Admin page JS: render bookings from localStorage, support verify and drag-to-delete
// NEW ADMIN DATA SOURCE USING BACKEND API (replaces localStorage dummy seed)
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

  async function fetchBookings(){
    try {
      const resp = await fetch('/api/appointments');
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
  }

  async function toggleVerify(idx){
    const b = bookings[idx]; if(!b) return;
    const newStatus = b.status && b.status.toLowerCase().startsWith('acc') ? 'rejected' : 'accepted';
    try {
      const resp = await fetch(`/api/appointments/${b.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
      const body = await resp.json(); if(!resp.ok) throw new Error(body.error||'Gagal update status');
      b.status = newStatus; render();
    } catch(err){ alert(err.message||'Gagal mengubah status'); }
  }

  async function deleteBooking(idx){
    const b = bookings[idx]; if(!b) return;
    if(!confirm(`Hapus reservasi dari ${b.name}?`)) return;
    try {
      const resp = await fetch(`/api/appointments/${b.id}`, { method:'DELETE' });
      if(!resp.ok && resp.status!==204) throw new Error('Gagal hapus reservasi');
      bookings.splice(idx,1); render();
    } catch(err){ alert(err.message||'Gagal menghapus reservasi'); }
  }

  function statusBadge(b){
    const s=(b.status||'pending').toLowerCase();
    if (s.startsWith('acc')) return '✓';
    if (s.startsWith('rej')) return '✗';
    return '•';
  }

  function render(){
    if(!grid) return;
    grid.innerHTML='';
    if(!bookings.length){ if(emptyEl) emptyEl.style.display='block'; return; }
    if(emptyEl) emptyEl.style.display='none';
    bookings.forEach((b,i)=>{
      const card=document.createElement('div');
      const verified = b.status && b.status.toLowerCase().startsWith('acc');
      card.className='card '+(verified?'verified':'');
      card.draggable=true; card.dataset.index=i;
  card.innerHTML=`<div class="card-content">\n          <h3>${b.date||b.datetime||'-'} — ${b.time||'-'} ${statusBadge(b)}</h3>\n          <p><strong>Nama:</strong> ${b.name||'-'}</p>\n          <p><strong>Telepon:</strong> ${b.phone||'-'}</p>\n          <p><strong>Email:</strong> ${b.email||'-'}</p>\n          <p><strong>Capster:</strong> ${b.capster||b.capsterId||'-'}</p>\n          <p><strong>Layanan:</strong> ${b.service||'-'}</p>\n          ${b.notes?`<p><strong>Catatan:</strong> ${b.notes}</p>`:''}\n        </div>\n        <div class="verify-container">\n          <button class="verify-btn" data-idx="${i}" title="${verified?'Tandai Ditolak':'Tandai Diterima'}">${verified?'✓':'?'}</button>\n        </div>`;
      card.addEventListener('dragstart',()=>{ dragged=card; card.classList.add('dragging'); });
      card.addEventListener('dragend',()=>{ card.classList.remove('dragging'); dragged=null; });
      grid.appendChild(card);
    });
    grid.querySelectorAll('.verify-btn').forEach(btn=>btn.addEventListener('click',()=>toggleVerify(Number(btn.dataset.idx))));
  }

  if (trash){
    trash.addEventListener('dragover',e=>{ e.preventDefault(); trash.classList.add('drag-over'); });
    trash.addEventListener('dragleave',()=>trash.classList.remove('drag-over'));
    trash.addEventListener('drop',e=>{ e.preventDefault(); trash.classList.remove('drag-over'); const d=document.querySelector('.card.dragging'); if(!d) return; deleteBooking(Number(d.dataset.index)); });
  }

  // Initial fetch
  fetchBookings();
  // Periodic refresh
  setInterval(fetchBookings, 30000);
})();
// Admin page JS (moved from inline <script> in components/admin.html)
// Responsibilities:
// - enforce simple admin check (localStorage)
// - render bookings from localStorage
// - drag & drop delete, verify toggle, and edit modal wiring

(function(){
  // === AUTO GENERATE 10 DUMMY RESERVASI KALO BELUM ADA ===
  let bookings = [];
  
  if (bookings.length === 0) {
    const dummyNames = ["Rizky", "Fajar", "Dika", "Bayu", "Gilang", "Adit", "Rafi", "Yoga", "Hendra", "Fikri"];
    const services = ["Classic Cut", "Fade + Skin", "Buzz Cut", "Crew Cut", "Pompadour", "Undercut", "Slick Back"];
    const capsters = ["Bro Asep", "Bro Dedi", "Bro Udin", "Bro Jaja", "Siapa saja"];
    const times = ["10:00", "11:30", "14:00", "15:30", "17:00", "19:00"];
    bookings = dummyNames.map((name, i) => ({
      name: name + " Pratama",
      phone: "08" + Math.floor(100000000 + Math.random() * 900000000),
      service: services[Math.floor(Math.random() * services.length)],
      capster: capsters[Math.floor(Math.random() * capsters.length)],
      datetime: "2025-11-" + String(8 + i).padStart(2, '0'),
      time: times[i % times.length],
      message: i % 3 === 0 ? "Minta fade rendah + skin, jangan lupa part tengah!" : (i % 4 === 0 ? "Bawa anak, anak umur 5 tahun" : ""),
      verified: i % 3 === 0
    }));
    localStorage.setItem('brocode_bookings', JSON.stringify(bookings));
    console.log("10 DUMMY RESERVASI TELAH DIBUAT!");
  }

  // HILANGKAN LOADER jika ada
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 800);
    }
  }, 800);

  // CEK LOGIN ADMIN
  if (localStorage.getItem('brocode_admin_logged') !== 'true') {
    alert('Login dulu sebagai admin!');
    location.href = '/';
  }

  const grid = document.getElementById('grid');
  const trash = document.getElementById('trash');
  const emptyState = document.getElementById('empty');
  let dragged = null;

  function render() {
    if (!grid) return;
    grid.innerHTML = '';
    if (bookings.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    bookings.forEach((b, i) => {
      const card = document.createElement('div');
      card.className = `card ${b.verified ? 'verified' : ''}`;
      card.draggable = true;
      card.dataset.index = i;

      card.innerHTML = `
        <div class="card-content">
            <h3>${b.datetime} — ${b.time}</h3>
            <p><strong>Nama:</strong> ${b.name}</p>
            <p><strong>Telepon:</strong> ${b.phone}</p>
            <p><strong>Email:</strong> ${b.email || '-'}</p>
            <p><strong>Capster:</strong> ${b.capster}</p>
            <p><strong>Layanan:</strong> ${b.service}</p>
            ${b.message ? `<p><strong>Catatan:</strong> ${b.message}</p>` : ''}
        </div>
        <div class="verify-container">
            <div class="verify-btn" data-idx="${i}" title="${b.verified ? '✓ Sudah Diverifikasi' : 'Klik untuk Verifikasi'}">
            ${b.verified ? '✓' : ''}
            </div>
        </div>
      `;

      // Drag handlers
      card.addEventListener('dragstart', (e) => { dragged = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => { if (card) card.classList.remove('dragging'); dragged = null; });

      grid.appendChild(card);
    });
  }

  // Toggle verify
  window.toggleVerify = (i) => {
    bookings[i].verified = !bookings[i].verified;
    localStorage.setItem('brocode_bookings', JSON.stringify(bookings));
    render();
  };

  // Trash drag & drop
  if (trash) {
    trash.addEventListener('dragover', e => { e.preventDefault(); trash.classList.add('drag-over'); });
    trash.addEventListener('dragleave', () => trash.classList.remove('drag-over'));
    trash.addEventListener('drop', e => {
      e.preventDefault(); trash.classList.remove('drag-over');
      if (dragged) {
        const idx = dragged.dataset.index;
        const booking = bookings[idx];
        if (confirm(`Hapus reservasi dari ${booking.name}?\n\nLayanan: ${booking.service}\nTanggal: ${booking.datetime} - ${booking.time}`)) {
          bookings.splice(idx, 1);
          localStorage.setItem('brocode_bookings', JSON.stringify(bookings));
          render();
          console.log('🗑️ Reservasi berhasil dihapus!');
        }
      }
    });
  }

  // Logout handler
  window.handleLogout = () => {
    if (confirm('Yakin mau logout?')) {
      localStorage.removeItem('brocode_admin_logged');
      location.href = '/';
    }
  };

  // Initial fetch and periodic refresh using API (fallback if first IIFE fails)
  async function refreshFromApi(){
    try { const resp=await fetch('/api/appointments'); const json=await resp.json(); if(resp.ok) bookings=json.data||[]; } catch(_){}
    render();
  }
  refreshFromApi();
  setInterval(refreshFromApi, 45000);

})();
