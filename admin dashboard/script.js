// ====================================================
// SIGAB-AI — script.js dengan Supabase Auth v2 + Realtime
// Tabel: users (nama, email, role, is_online, telegram_id)
//         pelanggaran (timestamps, gambar_url, status, jam_penanganan, deskripsi)
// ====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = "https://ksqqpkpdftgrcjtsbcjj.supabase.co";
const SUPABASE_KEY = "sb_publishable_NHL4sYeOyeQg9iGBsedg8g_cOZXPX0l";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true }
});

const DEFAULT_IMG = "https://ksqqpkpdftgrcjtsbcjj.supabase.co/storage/v1/object/public/pelanggaran/WhatsApp%20Image%202026-05-08%20at%2008.39.42.jpeg";

let userCache        = [];
let pelanggaranCache = [];
let realtimeChannel  = null;
let isRegistering    = false; // flag: jangan masuk dashboard saat registrasi

// ====== BUBBLES ======
(function() {
  const c = document.getElementById('bubbles');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const sz = Math.random() * 60 + 15;
    b.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;bottom:${Math.random()*20}%;animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*10}s;`;
    c.appendChild(b);
  }
})();

// ======================================================
// AUTH STATE — Login tampil duluan jika tidak ada sesi
// ======================================================
supabase.auth.onAuthStateChange((event, session) => {
  if (session && !isRegistering) {
    masukDashboard(session.user);
  } else if (!session && !isRegistering) {
    showLoginPage(); // ← Jangan panggil saat registrasi sedang proses signOut
  }
});

// ======================================================
// NAVIGASI HALAMAN AUTH
// ======================================================
function showLoginPage() {
  document.getElementById('login-page').style.display   = 'flex';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display    = 'none';
  const err = document.getElementById('login-err');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  const u = document.getElementById('username');
  const p = document.getElementById('password');
  if (u) u.value = '';
  if (p) p.value = '';
}

function showRegisterPage() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-page').style.display   = 'none';
  document.getElementById('dashboard').style.display    = 'none';
  // reset form
  ['r-fname','r-lname','r-email','r-pass','r-pass2','r-telegram'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sf = document.getElementById('s-fill');
  const sl = document.getElementById('s-label');
  if (sf) { sf.style.width = '0%'; sf.style.background = 'transparent'; }
  if (sl) { sl.textContent = 'Kekuatan password'; sl.style.color = 'rgba(255,255,255,0.3)'; }
  hideRegAlert();
}

function masukDashboard(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('login-page').style.display   = 'none';
  document.getElementById('dashboard').style.display    = 'flex';
  const name = user.email.split('@')[0];
  document.getElementById('topbar-avatar').textContent = name.substring(0, 2).toUpperCase();
  document.getElementById('topbar-name').textContent   = name;
  loadUsers();
  loadPelanggaran();
  startRealtimePelanggaran();
}


function toggleLoginPass() {
  const inp = document.getElementById('password');
  const btn = document.getElementById('login-toggle-btn');
  if (!inp || !btn) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ======================================================
// LOGIN
// ======================================================
async function doLogin() {
  const email = document.getElementById('username').value.trim();
  const pass  = document.getElementById('password').value;
  const err   = document.getElementById('login-err');
  err.style.display = 'none';
  err.textContent   = '';

  if (!email || !pass) {
    err.textContent   = '⚠️ Email dan password wajib diisi.';
    err.style.display = 'block';
    return;
  }

  const btn      = document.getElementById('btn-login-submit');
  const origText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '⏳ Memverifikasi...';

  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent   = '⚠️ Email atau password salah.';
    err.style.display = 'block';
    btn.disabled      = false;
    btn.textContent   = origText;
    return;
  }

  btn.disabled    = false;
  btn.textContent = origText;
}

document.getElementById('password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ======================================================
// REGISTER
// ======================================================
function hideRegAlert() {
  const err = document.getElementById('reg-err');
  const suc = document.getElementById('reg-success');
  if (err) err.style.display = 'none';
  if (suc) suc.style.display = 'none';
}

function showRegErr(msg) {
  const err = document.getElementById('reg-err');
  if (!err) return;
  err.textContent   = msg;
  err.style.display = 'block';
  document.getElementById('reg-success').style.display = 'none';
}

function showRegOk(msg) {
  const suc = document.getElementById('reg-success');
  if (!suc) return;
  suc.textContent   = msg;
  suc.style.display = 'block';
  document.getElementById('reg-err').style.display = 'none';
}

async function doRegister() {
  const fname    = document.getElementById('r-fname').value.trim();
  const lname    = document.getElementById('r-lname').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const pass     = document.getElementById('r-pass').value;
  const pass2    = document.getElementById('r-pass2').value;
  const role     = document.getElementById('r-role').value;
  const isOnline = document.getElementById('r-online').value === 'true';
  const telegram = document.getElementById('r-telegram').value.trim();

  hideRegAlert();

  if (!fname || !lname || !email || !pass || !pass2) {
    showRegErr('⚠️ Harap isi semua field yang wajib (*).');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegErr('⚠️ Format email tidak valid.');
    return;
  }
  if (pass.length < 8) {
    showRegErr('⚠️ Password minimal 8 karakter.');
    return;
  }
  if (pass !== pass2) {
    showRegErr('⚠️ Password dan konfirmasi tidak cocok.');
    return;
  }

  const btn = document.querySelector('#login-screen .btn-login');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

  isRegistering = true;
  const { data, error: signUpErr } = await supabase.auth.signUp({ email, password: pass });

  if (signUpErr) {
    isRegistering = false;
    showRegErr('❌ ' + signUpErr.message);
    if (btn) { btn.disabled = false; btn.textContent = '🌊 Buat Akun'; }
    return;
  }

  // Simpan profil ke tabel users
  const payload = { nama: `${fname} ${lname}`, email, role, is_online: isOnline };
  if (telegram) payload.telegram_id = telegram;
  await supabase.from('users').insert([payload]);

  // Sign out agar tidak langsung masuk dashboard
  await supabase.auth.signOut();
  // isRegistering tetap true sampai setelah redirect agar onAuthStateChange
  // tidak langsung berpindah halaman dan memotong toast

  if (btn) { btn.disabled = false; btn.textContent = '🌊 Buat Akun'; }

  // Reset form
  ['r-fname','r-lname','r-email','r-pass','r-pass2','r-telegram'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sf = document.getElementById('s-fill');
  const sl = document.getElementById('s-label');
  if (sf) { sf.style.width = '0%'; sf.style.background = 'transparent'; }
  if (sl) { sl.textContent = 'Kekuatan password'; sl.style.color = 'rgba(255,255,255,0.3)'; }

  // Tampilkan notifikasi sukses di halaman register
  showRegOk('✅ Akun berhasil dibuat! Mengarahkan ke halaman login...');
  showToast('🎉 Akun berhasil dibuat! Silakan masuk.');

  // Pindah ke login setelah toast sempat dibaca, lalu reset flag
  setTimeout(() => {
    isRegistering = false;
    showLoginPage();
    // Tampilkan toast lagi agar masih terlihat setelah pindah halaman
    setTimeout(() => showToast('🎉 Akun berhasil dibuat! Silakan masuk.'), 100);
  }, 2800);
}

// ====== Password Toggle ======
function togglePass() {
  const inp = document.getElementById('r-pass');
  const btn = document.getElementById('toggle-btn');
  if (!inp || !btn) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ====== Strength Bar ======
function checkStrength() {
  const val   = document.getElementById('r-pass')?.value || '';
  const fill  = document.getElementById('s-fill');
  const label = document.getElementById('s-label');
  if (!fill || !label) return;

  let score = 0;
  if (val.length >= 8)           score++;
  if (/[A-Z]/.test(val))         score++;
  if (/[0-9]/.test(val))         score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const map = [
    { w:'0%',   color:'transparent', txt:'Kekuatan password',       c:'rgba(255,255,255,0.3)' },
    { w:'25%',  color:'#e84a5f',     txt:'Lemah',                   c:'#e84a5f' },
    { w:'50%',  color:'#f07d3a',     txt:'Sedang',                  c:'#f07d3a' },
    { w:'75%',  color:'#fbbf24',     txt:'Kuat',                    c:'#fbbf24' },
    { w:'100%', color:'#4ade80',     txt:'Sangat kuat',             c:'#4ade80' },
  ];
  fill.style.width      = map[score].w;
  fill.style.background = map[score].color;
  label.textContent     = map[score].txt;
  label.style.color     = map[score].c;
}

// ======================================================
// LOGOUT
// ======================================================
async function doLogout() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  await supabase.auth.signOut();
}

// ====== NAVIGASI DASHBOARD ======
function showPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-'  + p).classList.add('active');
  const t = { tambah:'Tambah User', list:'List User', log:'Log Kejadian' };
  document.getElementById('topbar-title').textContent = t[p];
  if (p === 'list') loadUsers();
  if (p === 'log')  loadPelanggaran();
}

// ====== TOAST ======
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ======================================================
// REALTIME — Listener kejadian
// ======================================================
function startRealtimePelanggaran() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);

  realtimeChannel = supabase
    .channel('pelanggaran-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'pelanggaran' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          pelanggaranCache.unshift(payload.new);
          showToast('🚨 Kejadian baru terdeteksi!');
        } else if (payload.eventType === 'UPDATE') {
          const idx = pelanggaranCache.findIndex(l => l.id === payload.new.id);
          if (idx !== -1) pelanggaranCache[idx] = payload.new;
        } else if (payload.eventType === 'DELETE') {
          pelanggaranCache = pelanggaranCache.filter(l => l.id !== payload.old.id);
        }
        renderLog();
        updateStats();
      }
    )
    .subscribe();
}

// ======================================================
// USER — Tambah
// ======================================================
async function tambahUser() {
  const nama       = document.getElementById('f-nama').value.trim();
  const email      = document.getElementById('f-email').value.trim();
  const role       = document.getElementById('f-role').value;
  const isOnline   = document.getElementById('f-online').value === 'true';
  const telegramId = document.getElementById('f-telegram').value.trim();

  if (!nama || !email || !role) {
    alert('Mohon isi semua field yang wajib (*).');
    return;
  }

  const payload = { nama, email, role, is_online: isOnline };
  if (telegramId) payload.telegram_id = telegramId;

  const { error } = await supabase.from('users').insert([payload]);
  if (error) { showToast('❌ Gagal: ' + error.message); return; }

  ['f-nama','f-email','f-telegram'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-role').value   = '';
  document.getElementById('f-online').value = 'true';
  showToast('✅ User berhasil ditambahkan!');
  showPage('list');
}

// ======================================================
// USER — Load
// ======================================================
async function loadUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadUsers:', error); return; }
  userCache = data || [];
  renderTable();
  updateStats();
}

// ======================================================
// USER — Toggle is_online
// ======================================================
async function toggleOnline(id) {
  const u = userCache.find(x => x.id === id);
  if (!u) return;
  const { error } = await supabase
    .from('users')
    .update({ is_online: !u.is_online })
    .eq('id', id);
  if (error) { showToast('❌ Gagal update.'); return; }
  loadUsers();
}

// ======================================================
// USER — Hapus
// ======================================================
async function hapusUser(id) {
  if (!confirm('Hapus user ini?')) return;
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) { showToast('❌ Gagal menghapus.'); return; }
  showToast('🗑️ User dihapus.');
  loadUsers();
}

// ======================================================
// USER — Render Tabel
// ======================================================
function renderTable() {
  const q       = (document.getElementById('search-input')?.value  || '').toLowerCase();
  const fRole   = document.getElementById('filter-role')?.value    || '';
  const fOnline = document.getElementById('filter-online')?.value  || '';

  const filtered = userCache.filter(u =>
    (u.nama?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) &&
    (!fRole   || u.role === fRole) &&
    (!fOnline || String(u.is_online) === fOnline)
  );

  const tbody = document.getElementById('table-body');
  const empty = document.getElementById('empty-state');

  if (!filtered.length) {
    tbody.innerHTML     = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map((u, i) => `
      <tr>
        <td style="color:rgba(255,255,255,0.3);font-size:12px;">${i + 1}</td>
        <td style="font-weight:500;">${u.nama}</td>
        <td style="color:rgba(255,255,255,0.5);font-size:13px;">${u.email}</td>
        <td>
          <span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-pengawas'}">
            ${u.role === 'admin' ? '🛡️ Admin' : '👮 Pengawas'}
          </span>
        </td>
        <td style="font-size:13px;color:rgba(255,255,255,0.5);">
          ${u.telegram_id
            ? `<span style="color:#29b6f6;">📱 ${u.telegram_id}</span>`
            : '<span style="opacity:0.3;">—</span>'}
        </td>
        <td>
          <span class="badge ${u.is_online ? 'badge-on' : 'badge-off'}">
            ${u.is_online ? '🟢 Bertugas' : '⚫ Tidak Bertugas'}
          </span>
        </td>
        <td>
          <button class="btn-sm" onclick="toggleOnline(${u.id})">
            ${u.is_online ? 'Set Offline' : 'Set Online'}
          </button>
          <button class="btn-sm del" onclick="hapusUser(${u.id})">Hapus</button>
        </td>
      </tr>
    `).join('');
  }
  updateStats();
}

// ======================================================
// STATS
// ======================================================
function updateStats() {
  document.getElementById('stat-total').textContent   = userCache.length;
  document.getElementById('stat-on').textContent      = userCache.filter(u => u.is_online === true).length;
  document.getElementById('stat-admin').textContent   = userCache.filter(u => u.role === 'admin').length;
  document.getElementById('stat-pengawas').textContent = userCache.filter(u => u.role === 'pengawas').length;
  document.getElementById('log-total').textContent    = pelanggaranCache.length;
  document.getElementById('log-pending').textContent  = pelanggaranCache.filter(l => l.status === 'belum').length;
  document.getElementById('log-done').textContent     = pelanggaranCache.filter(l => l.status === 'ditangani').length;
}

// ======================================================
// KEJADIAN — Load
// ======================================================
async function loadPelanggaran() {
  const { data, error } = await supabase
    .from('pelanggaran')
    .select('*')
    .order('timestamps', { ascending: false });

  if (error) { console.error('loadPelanggaran:', error); return; }
  pelanggaranCache = data || [];
  renderLog();
  updateStats();
}

// ======================================================
// KEJADIAN — Tandai Ditangani
// ======================================================
async function tandaiDitangani(id) {
  const { error } = await supabase
    .from('pelanggaran')
    .update({ status: 'ditangani', jam_penanganan: new Date().toISOString() })
    .eq('id', id);

  if (error) { showToast('❌ Gagal update status.'); return; }
  showToast('✅ Kejadian ditandai ditangani.');
}

// ======================================================
// KEJADIAN — Render kartu
// ======================================================
function renderLog() {
  updateStats();
  const grid  = document.getElementById('log-grid');
  const empty = document.getElementById('log-empty');

  if (!pelanggaranCache.length) {
    grid.innerHTML      = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = pelanggaranCache.map(l => {
    const ts = l.timestamps     ? new Date(l.timestamps).toLocaleString('id-ID')     : '-';
    const jp = l.jam_penanganan ? new Date(l.jam_penanganan).toLocaleString('id-ID') : null;
    const sudahDitangani = l.status === 'ditangani';
    const imgUrl = l.gambar_url || DEFAULT_IMG;

    return `
      <div class="log-card">
        <div class="log-img">
          <img src="${imgUrl}" alt="Foto kejadian"
            style="width:100%;height:100%;object-fit:cover;display:block;border-radius:12px 12px 0 0;"
            onerror="this.src='${DEFAULT_IMG}';" />
          <span class="violation-label">KEJADIAN</span>
          ${sudahDitangani ? '<span class="handled-label">✓ Ditangani</span>' : ''}
        </div>
        <div class="log-info">
          <div class="log-time">🕐 <strong>Waktu:</strong> ${ts}</div>
          <div class="log-loc" style="margin-top:6px;">
            📌 <strong>Status:</strong>
            <span class="badge ${sudahDitangani ? 'badge-on' : 'badge-off'}" style="margin-left:4px;">
              ${sudahDitangani ? 'Ditangani' : 'Belum Ditangani'}
            </span>
          </div>
          ${jp ? `<div class="log-time" style="margin-top:4px;">🛠️ <strong>Jam Penanganan:</strong> ${jp}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            ${!sudahDitangani ? `<button class="btn-sm" onclick="tandaiDitangani(${l.id})">✅ Tandai Ditangani</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ====== Expose ke HTML onclick ======
window.doLogin          = doLogin;
window.doLogout         = doLogout;
window.showPage         = showPage;
window.tambahUser       = tambahUser;
window.toggleOnline     = toggleOnline;
window.hapusUser        = hapusUser;
window.renderTable      = renderTable;
window.tandaiDitangani  = tandaiDitangani;
window.doRegister       = doRegister;
window.togglePass       = togglePass;
window.checkStrength    = checkStrength;
window.showLoginPage    = showLoginPage;
window.showRegisterPage = showRegisterPage;
window.toggleLoginPass  = toggleLoginPass;