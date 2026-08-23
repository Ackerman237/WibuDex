// nekoPage/js/watch.js — Neko Video watch page

function escapeHtml(s) {
  return String(s || '').replace(/[&"<>]/g, (m) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[m]));
}

function renderEpisodeList(episodes) {
  const playerBox = document.getElementById('playerBox');
  if (!playerBox || !Array.isArray(episodes) || episodes.length === 0) return false;

  const wrap = document.createElement('div');
  wrap.className = 'episode-list';

  const label = document.createElement('p');
  label.className = 'player-error-text';
  label.textContent = 'Ini halaman seri — pilih episode:';
  wrap.appendChild(label);

  episodes.forEach((ep) => {
    if (!ep?.slug) return;
    const a = document.createElement('a');
    a.className = 'server-btn';
    a.href = `/nekoPage/html/watch.html?slug=${encodeURIComponent(ep.slug)}`;
    a.textContent = ep.title || ep.slug;
    wrap.appendChild(a);
  });

  playerBox.innerHTML = '';
  playerBox.appendChild(wrap);
  return true;
}

async function goRandomVideo(btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'MENCARI...';
  try {
    const res = await fetch('/api/neko/random');
    const result = await res.json();
    if (!result.success || !result.data?.slug) throw new Error(result.message || 'Gagal');
    window.location.href = `/nekoPage/html/watch.html?slug=${encodeURIComponent(result.data.slug)}`;
  } catch (err) {
    console.error('Gagal ambil video acak:', err);
    btn.disabled = false;
    btn.textContent = original;
  }
}

function renderRandomRetry(playerBox) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'server-btn random-retry-btn';
  btn.textContent = '🎲 Video Acak Lain';
  btn.addEventListener('click', () => goRandomVideo(btn));
  playerBox.appendChild(btn);
}

// Mode player (kebijakan server via .env PLAYER_FRAME_MODE):
//   'native'   = <video> milik sendiri memutar MP4 hasil ekstraksi server
//                (nol JS penyedia — mustahil ada iklan/klik/redirect)
//   'filtered' = embed penyedia disaring server (/api/neko/player-frame)
//   'direct'   = perilaku lama (iframe langsung ke penyedia)
let playerMode = 'filtered';
const pageSlug = () => new URLSearchParams(window.location.search).get('slug') || '';

function showLoading(text) {
  const el = document.getElementById('pfLoading');
  if (el) { el.style.display = 'flex'; el.textContent = text; }
}

function hideLoading() {
  const el = document.getElementById('pfLoading');
  if (el) el.style.display = 'none';
}

function attachSlowNote() {
  setTimeout(() => {
    const el = document.getElementById('pfLoading');
    if (el && el.style.display !== 'none') {
      el.textContent = '⏳ Masih menyiapkan player… jaringan lambat';
    }
  }, 15000);
}

// Coba ekstraksi stream langsung dari server; return URL atau null
async function tryNativeStream(playerUrl) {
  try {
    const res = await fetch(`/api/neko/stream?url=${encodeURIComponent(playerUrl)}&slug=${encodeURIComponent(pageSlug())}`);
    const json = await res.json();
    return json?.success && json.data?.url ? json.data.url : null;
  } catch {
    return null;
  }
}

function renderModeBtn(modeBtn, playerBox, playerUrl) {
  modeBtn.textContent = playerMode === 'direct'
    ? '🧹 Kembali ke mode bersih (anti iklan)'
    : '⚡ Player tidak muncul? Pakai mode langsung';
  modeBtn.onclick = () => {
    playerMode = playerMode === 'direct' ? 'filtered' : 'direct';
    mountPlayer(playerBox, playerUrl);
  };
}

function renderNativeVideo(playerBox, playerUrl, streamUrl) {
  playerBox.innerHTML = `
    <div class="pf-wrap">
      <div class="pf-loading" id="pfLoading">🧹 Sedang membersihkan iklan…</div>
      <video id="nativeVideo" src="${escapeHtml(streamUrl)}" controls playsinline
             referrerpolicy="no-referrer"
             style="width:100%;aspect-ratio:16/9;background:#000;display:block"></video>
    </div>
    <div class="pf-mode-toggle"><button type="button" id="pfModeBtn" class="server-btn pf-mode-btn"></button></div>
  `;
  hideLoading();
  const video = document.getElementById('nativeVideo');
  // Stream gagal diputar di browser (token/referer ditolak CDN) → jatuh otomatis
  // ke mode filtered — jangan biarkan user menatap layar mati.
  video.addEventListener('error', () => {
    playerMode = 'filtered';
    mountPlayer(playerBox, playerUrl);
  }, { once: true });
  renderModeBtn(document.getElementById('pfModeBtn'), playerBox, playerUrl);
}

function renderFilteredFrame(playerBox, playerUrl) {
  playerBox.innerHTML = `
    <div class="pf-wrap">
      <div class="pf-loading" id="pfLoading">🧹 Sedang membersihkan iklan…</div>
      <iframe src="${escapeHtml(`/api/neko/player-frame?url=${encodeURIComponent(playerUrl)}&slug=${encodeURIComponent(pageSlug())}`)}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
    </div>
    <div class="pf-mode-toggle"><button type="button" id="pfModeBtn" class="server-btn pf-mode-btn"></button></div>
  `;
  const frame = playerBox.querySelector('iframe');
  frame.addEventListener('load', hideLoading);
  attachSlowNote();
  renderModeBtn(document.getElementById('pfModeBtn'), playerBox, playerUrl);
}

function renderDirectFrame(playerBox, playerUrl) {
  playerBox.innerHTML = `
    <div class="pf-wrap">
      <iframe src="${escapeHtml(playerUrl)}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
    </div>
    <div class="pf-mode-toggle"><button type="button" id="pfModeBtn" class="server-btn pf-mode-btn"></button></div>
  `;
  renderModeBtn(document.getElementById('pfModeBtn'), playerBox, playerUrl);
}

async function mountPlayer(playerBox, playerUrl) {
  if (playerMode === 'direct') {
    renderDirectFrame(playerBox, playerUrl);
    return;
  }

  // Mode filtered tetap mencoba ekstraksi dulu (hasil paling bersih).
  // Kalau penyedia tidak didukung / gagal → jatuh ke iframe terfilter.
  const streamUrl = await tryNativeStream(playerUrl);
  if (streamUrl && playerMode !== 'direct') {
    renderNativeVideo(playerBox, playerUrl, streamUrl);
    return;
  }
  renderFilteredFrame(playerBox, playerUrl);
}

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const playerBox = document.getElementById('playerBox');
  const serverSelectorContainer = document.getElementById('serverSelectorContainer');
  const externalFallbackContainer = document.getElementById('externalFallbackContainer');
  const externalPlayerBtn = document.getElementById('externalPlayerBtn');

  if (!slug) {
    playerBox.innerHTML = '<p class="player-error-text">Error: Parameter slug tidak ditemukan di URL.</p>';
    return;
  }

  try {
    // Ikuti kebijakan server (.env PLAYER_FRAME_MODE); jika endpoint gagal, tetap filtered
    try {
      const modeRes = await fetch('/api/neko/player-mode');
      const modeJson = await modeRes.json();
      if (modeJson?.success && modeJson.data?.mode) playerMode = modeJson.data.mode;
    } catch {
      /* server lama / offline — pakai default */
    }

    const res = await fetch(`/api/neko/detail?slug=${encodeURIComponent(slug)}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Gagal memuat detail video.');
    }

    const detail = result.data;
    document.getElementById('videoTitle').innerText = detail.title || 'Tanpa Judul';
    document.getElementById('videoSynopsis').innerText = detail.synopsis || 'Tidak ada deskripsi/sinopsis.';

    renderRelated(detail.related || []);

    if (detail.players && detail.players.length > 0) {
      serverSelectorContainer.innerHTML = '';

      detail.players.forEach((playerUrl, index) => {
        const btn = document.createElement('button');
        btn.className = `server-btn ${index === 0 ? 'active' : ''}`;
        btn.textContent = `Server ${index + 1}`;

        btn.onclick = () => {
          document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          externalPlayerBtn.href = playerUrl;
          externalFallbackContainer.style.display = 'block';

          mountPlayer(playerBox, playerUrl);
        };

        serverSelectorContainer.appendChild(btn);
      });

      const firstUrl = detail.players[0];
      externalPlayerBtn.href = firstUrl;
      externalFallbackContainer.style.display = 'block';
      mountPlayer(playerBox, firstUrl);

    } else {
      playerBox.innerHTML = '<p class="player-error-text">Player video tidak tersedia.</p>';
      // Recovery: halaman seri -> daftar episode; plus tombol acak ulang
      renderEpisodeList(detail.episodes);
      renderRandomRetry(playerBox);
    }
  } catch (err) {
    playerBox.innerHTML = `<p class="player-error-text">Error: ${err.message}</p>`;
  }
}

function renderRelated(related) {
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  if (!section || !grid) return;

  if (!Array.isArray(related) || related.length === 0) return;

  grid.innerHTML = '';
  related.forEach((item) => {
    if (!item?.slug) return;
    const card = document.createElement('a');
    card.className = 'video-card';
    card.href = `/nekoPage/html/watch.html?slug=${encodeURIComponent(item.slug)}`;

    const thumbUrl = item.thumb || 'https://placehold.co/480x270?text=No+Thumb';
    const title = (item.title || 'Tanpa Judul').replace(/[&"<>]/g, m => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[m]));

    card.innerHTML = `
      <img class="video-thumb" src="${thumbUrl}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">
      <div class="video-info">
        <h3 class="video-title">${title}</h3>
      </div>
    `;
    grid.appendChild(card);
  });

  if (grid.children.length > 0) {
    section.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', loadDetail);
