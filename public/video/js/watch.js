// video/js/watch.js — Neko Video watch page

// Allowlist host player — fallback hardcoded; nilai resmi diambil dari
// /api/video/player-mode (field allowedHosts) saat halaman dimuat.
let playerAllowedHosts = ['playmogo.com', 'streampoi.com', 'yandex.ru'];

function isAllowedPlayerUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return playerAllowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
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
    a.href = `/video/html/watch.html?slug=${encodeURIComponent(ep.slug)}`;
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
    const res = await fetch('/api/video/random');
    const result = await res.json();
    if (!result.success || !result.data?.slug) throw new Error(result.message || 'Gagal');
    window.location.href = `/video/html/watch.html?slug=${encodeURIComponent(result.data.slug)}`;
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
  btn.innerHTML = '<svg class="ic"><use href="/manga/icons.svg#i-refresh-cw"></use></svg> Video Acak Lain';
  btn.addEventListener('click', () => goRandomVideo(btn));
  playerBox.appendChild(btn);
}

// Mode player (kebijakan server via .env PLAYER_FRAME_MODE):
//   'native'   = <video> milik sendiri memutar MP4 hasil ekstraksi server
//                (nol JS penyedia — mustahil ada iklan/klik/redirect)
//   'filtered' = embed penyedia disaring server (/api/video/player-frame)
//   'direct'   = perilaku lama (iframe langsung ke penyedia)
let playerMode = 'filtered';
const pageSlug = () => new URLSearchParams(window.location.search).get('slug') || '';

const NATIVE_TIMEOUT_MS = 20000; // batas sabar menunggu ekstraksi sebelum fallback

// Overlay loading: anak LANGSUNG #playerBox (.video-wrapper, sudah berukuran
// 16:9 lewat padding-bottom trick). Dulu dibungkus div.pf-wrap tambahan yang
// tingginya collapse → teks "membersihkan iklan" tergencet di garis atas.
function showLoading(playerBox, text = 'Membersihkan iklan…') {
  let el = document.getElementById('pfLoading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pfLoading';
    el.className = 'pf-loading';
    playerBox.prepend(el);
  }
  // Hapus teks loading statis awal dari HTML agar tidak bertumpuk dengan
  // overlay pf-loading (laporan user 2026-08-24)
  playerBox.querySelectorAll('.player-loading-text').forEach((n) => n.remove());
  el.style.display = 'flex';
  el.textContent = text;
}

let slowTimer1 = null;
let slowTimer2 = null;
function attachSlowNotes() {
  clearTimeout(slowTimer1);
  clearTimeout(slowTimer2);
  slowTimer1 = setTimeout(() => {
    const el = document.getElementById('pfLoading');
    if (el && el.style.display !== 'none') {
      el.textContent = 'Masih menyiapkan player… jaringan lambat';
    }
  }, 15000);
  slowTimer2 = setTimeout(() => {
    const el = document.getElementById('pfLoading');
    if (el && el.style.display !== 'none') {
      el.textContent = 'Lama tak selesai — pakai tombol mode langsung di bawah';
      // Player benar-benar dianggap gagal → barulah tampilkan fallback eksternal
      const c = document.getElementById('externalFallbackContainer');
      if (c) {
        // href sudah disiapkan saat memilih server — cukup tampilkan
        const btn = document.getElementById('externalPlayerBtn');
        if (btn?.href) c.style.display = 'block';
      }
    }
  }, 25000);
}
function clearSlowTimers() {
  clearTimeout(slowTimer1);
  clearTimeout(slowTimer2);
}

function hideLoading() {
  clearSlowTimers();
  const el = document.getElementById('pfLoading');
  if (el) el.style.display = 'none';
}

// Tombol toggle mode: DI LUAR #playerBox (tepat di bawah kotak video),
// dibuat sekali lalu hanya teksnya yang diperbarui.
function ensureModeBtn(playerBox, playerUrl) {
  const host = document.getElementById('pfModeToggleHost');
  if (!host) return;
  
  host.innerHTML = '<button type="button" id="pfModeBtn" class="pf-mode-btn"></button>';
  const btn = document.getElementById('pfModeBtn');
  btn.textContent = playerMode === 'direct'
    ? 'Kembali ke mode bersih (anti iklan)'
    : 'Player tidak muncul? Pakai mode langsung';
  btn.onclick = () => {
    playerMode = playerMode === 'direct' ? 'filtered' : 'direct';
    mountPlayer(playerBox, playerUrl);
  };
}

// Coba ekstraksi stream langsung dari server; return src proxy atau null.
// AbortController 20 detik — jangan biarkan user menunggu fallback berat.
async function tryNativeStream(playerUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NATIVE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `/api/video/stream?url=${encodeURIComponent(playerUrl)}&slug=${encodeURIComponent(pageSlug())}`,
      { signal: controller.signal }
    );
    const json = await res.json();
    return json?.success && json.data?.proxyUrl ? json.data.proxyUrl : null;
  } catch {
    return null; // timeout / gagal → caller jatuh ke filtered
  } finally {
    clearTimeout(timer);
  }
}

// URL yang sudah terbukti gagal diputar di sesi ini — jangan coba native lagi
const failedNativeUrls = new Set();

function mountNativeVideo(playerBox, playerUrl, streamSrc) {
  playerBox.innerHTML =
    `<video id="nativeVideo" src="${escapeHtml(streamSrc)}" controls playsinline preload="metadata" ` +
    `referrerpolicy="no-referrer" ` +
    `style="position:absolute;inset:0;width:100%;height:100%;background:#000;border:0"></video>`;
  hideLoading();
  const video = document.getElementById('nativeVideo');
  video.addEventListener('loadeddata', hideLoading, { once: true });
  // V1.6 Custom Controls (Opsi A) — ambil alih kontrol native
  if (typeof window.initPlayerControls === 'function') {
    window.initPlayerControls(video);
  }
  // V1.5 Autoplay: saat native berakhir, lanjut episode berikutnya jika toggle aktif
  video.addEventListener('ended', () => {
    let on = false;
    try { on = localStorage.getItem('videoAutoplay') === '1'; } catch {}
    if (!on) return;
    const next = document.querySelector('.episode-card.is-active')?.nextElementSibling;
    if (next?.href) window.location.href = next.href;
  });
  video.addEventListener('error', () => {
    failedNativeUrls.add(playerUrl);
    playerMode = 'filtered';
    mountPlayer(playerBox, playerUrl, { skipNative: true });
  }, { once: true });
  ensureModeBtn(playerBox, playerUrl);
}

function mountFilteredFrame(playerBox, playerUrl) {
  playerBox.innerHTML =
    `<iframe src="${escapeHtml(`/api/video/player-frame?url=${encodeURIComponent(playerUrl)}&slug=${encodeURIComponent(pageSlug())}`)}" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  showLoading(playerBox); // innerHTML menghapus overlay lama — pasang lagi sampai load
  const frame = playerBox.querySelector('iframe');
  frame.addEventListener('load', hideLoading);
  attachSlowNotes();
  ensureModeBtn(playerBox, playerUrl);
}

function mountDirectFrame(playerBox, playerUrl) {
  playerBox.innerHTML =
    `<iframe src="${escapeHtml(playerUrl)}" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  showLoading(playerBox);
  const frame = playerBox.querySelector('iframe');
  frame.addEventListener('load', hideLoading);
  attachSlowNotes();
  ensureModeBtn(playerBox, playerUrl);
}

async function mountPlayer(playerBox, playerUrl, opts = {}) {
  // FIX BUG A: feedback instan SEBELUM await apa pun. Dulu ekstraksi (10–60 dtk)
  // berjalan dengan kotak player benar-benar kosong tanpa pesan apa pun.
  showLoading(playerBox);
  attachSlowNotes();
  ensureModeBtn(playerBox, playerUrl);

  if (playerMode === 'direct') {
    // Guard: URL di luar allowlist tidak pernah masuk iframe langsung —
    // jatuh ke mode filtered (server juga memvalidasi ulang).
    if (isAllowedPlayerUrl(playerUrl)) {
      mountDirectFrame(playerBox, playerUrl);
    } else {
      mountFilteredFrame(playerBox, playerUrl);
    }
    return;
  }

  // URL yang sudah terbukti gagal diputar tidak dicoba native lagi (anti ping-pong)
  if (!opts.skipNative && !failedNativeUrls.has(playerUrl)) {
    const streamUrl = await tryNativeStream(playerUrl);
    if (streamUrl) {
      mountNativeVideo(playerBox, playerUrl, streamUrl);
      return;
    }
  }
  mountFilteredFrame(playerBox, playerUrl);
}

/* ----- SYNOPSIS COLLAPSE ----- */

function setupSynopsisToggle() {
  const synopsisEl = document.getElementById('videoSynopsis');
  const toggleBtn = document.getElementById('synopsisToggle');
  const panel = synopsisEl?.closest('.synopsis-panel');

  if (!synopsisEl || !toggleBtn || !panel) return;

  // Deteksi: konten lebih tinggi dari clamp 4 baris? (line-height 1.6 × 15px × 4)
  requestAnimationFrame(() => {
    const maxHeight = 15 * 1.6 * 4;
    if (synopsisEl.scrollHeight > maxHeight) {
      panel.classList.add('has-more');
    }
  });

  toggleBtn.addEventListener('click', () => {
    const isExpanded = panel.classList.toggle('is-expanded');
    toggleBtn.textContent = isExpanded ? 'Sembunyikan' : 'Baca selengkapnya';
  });
}
/* ----- SIDEBAR & MOBILE RENDER FUNCTIONS ----- */

function renderEpisodeSidebar(episodes, currentSlug) {
  if (!Array.isArray(episodes) || episodes.length === 0) return;

  const container = document.getElementById('episodeList');
  const sidebarSection = document.getElementById('sidebarEpisodes');
  if (container) {
    container.innerHTML = '';
    episodes.forEach((ep) => {
      if (!ep?.slug) return;
      container.appendChild(renderMediaCard(ep, {
        variant: 'episode',
        isActive: ep.slug === currentSlug,
      }));
    });
    if (sidebarSection) sidebarSection.style.display = 'block';
  }
  // Duplikat mobile (episodeMobileList) dihapus — episode hanya di sidebar.
}

function renderRelatedSidebar(related) {
  const sidebarSection = document.getElementById('sidebarRelated');
  const sidebarContainer = document.getElementById('relatedList');

  // Kosong → sembunyikan section agar tidak ada judul menggantung
  if (!Array.isArray(related) || related.length === 0) {
    if (sidebarSection) sidebarSection.style.display = 'none';
    return;
  }

  if (sidebarContainer) {
    sidebarContainer.innerHTML = '';
    related.forEach((item) => {
      if (!item?.slug) return;
      sidebarContainer.appendChild(renderMediaCard(item, { variant: 'related' }));
    });
  }
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
    // Ikuti kebijakan server (.env PLAYER_FRAME_MODE); jika gagal, tetap default
    try {
      const modeRes = await fetch('/api/video/player-mode');
      const modeJson = await modeRes.json();
      if (modeJson?.success && modeJson.data?.mode) playerMode = modeJson.data.mode;
      if (Array.isArray(modeJson?.data?.allowedHosts) && modeJson.data.allowedHosts.length > 0) {
        playerAllowedHosts = modeJson.data.allowedHosts;
      }
    } catch {
      /* server lama / offline — pakai default */
    }

    const res = await fetch(`/api/video/detail?slug=${encodeURIComponent(slug)}`);
    const result = await res.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Gagal memuat detail video.');
    }

    const detail = result.data;
    document.getElementById('videoTitle').innerText = detail.title || 'Tanpa Judul';
    // Channel row
    (() => {
      const epCount = (detail.episodes || []).length;
      const cr = document.createElement('div');
      cr.className = 'channel-row';
      const baseName = String(detail.title || '').split(' Episode')[0].slice(0, 60);
      cr.innerHTML = `<span class="channel-name">${escapeHtml(baseName)}</span><span class="channel-count">${epCount} episode</span>`;
      document.getElementById('videoTitle')?.after(cr);
    })();
    document.getElementById('videoSynopsis').innerText = detail.synopsis || 'Tidak ada deskripsi/sinopsis.';

    // Render sidebar components — digabung SATU daftar (isinya memang
    // sama di upstream; duplikasi dua heading hanya memakan tempat)
    renderSidebarList(detail.episodes || [], detail.related || [], slug);
    
    // Setup synopsis toggle
    setupSynopsisToggle();

    // Update content type badge
    const contentTypeBadge = document.getElementById('contentTypeBadge');
    if (contentTypeBadge && detail.type) {
      contentTypeBadge.textContent = detail.type.toUpperCase();
    }

    // Update watch meta
    const watchMeta = document.getElementById('watchMeta');
    if (watchMeta) {
      let metaHtml = '';
      if (detail.date) {
        metaHtml += `<span class="watch-meta-item"><svg class="ic meta-ic" aria-hidden="true"><use href="/manga/icons.svg#i-clock"></use></svg> ${escapeHtml(detail.date)}</span>`;
      }
      if (detail.duration) {
        metaHtml += `<span class="watch-meta-item"><svg class="ic meta-ic" aria-hidden="true"><use href="/manga/icons.svg#i-play"></use></svg> ${escapeHtml(detail.duration)}</span>`;
      }
      if (detail.studio) {
        metaHtml += `<span class="watch-meta-item"><svg class="ic meta-ic" aria-hidden="true"><use href="/manga/icons.svg#i-list"></use></svg> ${escapeHtml(detail.studio)}</span>`;
      }
      watchMeta.innerHTML = metaHtml;
    }

    // Genre chips (dari parseVideoMeta di server)
    const genreRow = document.getElementById('watchGenres');
    if (genreRow) {
      const genres = Array.isArray(detail.genres) ? detail.genres : [];
      genreRow.innerHTML = genres
        .map((g) => `<span class="genre-chip">${escapeHtml(String(g))}</span>`)
        .join('');
      genreRow.style.display = genres.length > 0 ? 'flex' : 'none';
    }

    // Helper: tampilkan tombol eksternal HANYA saat player benar-benar gagal
    // (opsi A — di toolbar, tidak menutupi video)
    const revealExternal = (url) => {
      if (!isAllowedPlayerUrl(url)) return;
      externalPlayerBtn.href = url;
      externalFallbackContainer.style.display = 'block';
    };

    // Gagal total (timeout/slow 25 dtk) juga memicu fallback

    if (detail.players && detail.players.length > 0) {
      serverSelectorContainer.innerHTML = '';

      detail.players.forEach((playerUrl, index) => {
        const btn = document.createElement('button');
        btn.className = `server-btn ${index === 0 ? 'active' : ''}`;
        btn.textContent = `Server ${index + 1}`;

        btn.onclick = () => {
          document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // href disiapkan tapi fallback tetap tersembunyi sampai benar-benar gagal
          if (isAllowedPlayerUrl(playerUrl)) {
            externalPlayerBtn.href = playerUrl;
          }

          mountPlayer(playerBox, playerUrl);
        };

        serverSelectorContainer.appendChild(btn);
      });

      const firstUrl = detail.players[0];
      if (isAllowedPlayerUrl(firstUrl)) {
        externalPlayerBtn.href = firstUrl;
      }
      mountPlayer(playerBox, firstUrl);
    } else {
      hideLoading(); // tidak ada player — matikan overlay agar pesan terlihat
      playerBox.innerHTML = '<p class="player-error-text">Player video tidak tersedia.</p>';
      revealExternal(detail.players[0] || '');
      renderEpisodeList(detail.episodes);
      renderRandomRetry(playerBox);
    }
  } catch (err) {
    hideLoading();
    playerBox.innerHTML = `<p class="player-error-text">Error: ${escapeHtml(err.message)}</p>`;
    revealExternal(detail.players?.[0] || '');
  }
}

/**
 * SATU daftar sidebar gabungan: episodes (current ditandai) + related
 * (slug duplikat dilewati). Kartu memakai renderMediaCard V1.1.
 */
function renderSidebarList(episodes, related, currentSlug) {
  const container = document.getElementById('episodeList');
  const section = document.getElementById('sidebarEpisodes');
  if (!container) return;

  container.innerHTML = '';
  const seen = new Set();
  let added = 0;

  const push = (item) => {
    if (!item?.slug) return;
    if (seen.has(item.slug)) return;
    seen.add(item.slug);
    container.appendChild(renderMediaCard(item, {
      variant: 'episode',
      isActive: item.slug === currentSlug,
    }));
    added++;
  };

  (episodes || []).forEach(push);
  (related || []).forEach(push);

  if (section) section.style.display = added > 0 ? 'block' : 'none';

  // Autoplay toggle (V1.5, persisten)
  if (!document.getElementById('autoplayRow') && section) {
    const row = document.createElement('label');
    row.id = 'autoplayRow';
    row.className = 'autoplay-row';
    row.innerHTML = '<input type="checkbox" id="autoplayToggle"> Autoplay next';
    section.insertBefore(row, container);
    const cb = row.querySelector('input');
    try { cb.checked = localStorage.getItem('videoAutoplay') === '1'; } catch {}
    cb.addEventListener('change', () => {
      try { localStorage.setItem('videoAutoplay', cb.checked ? '1' : '0'); } catch {}
    });
  }
}

// V1.5 Keyboard shortcut (native-only seek, N/P global)
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
  const vid = document.getElementById('nativeVideo');
  const isNative = vid && vid.tagName === 'VIDEO';
  if (e.key === ' ' && isNative) { e.preventDefault(); vid.paused ? vid.play().catch(()=>{}) : vid.pause(); }
  if (e.key === 'ArrowRight' && isNative) { vid.currentTime = Math.min(vid.duration || Infinity, vid.currentTime + 5); }
  if (e.key === 'ArrowLeft' && isNative) { vid.currentTime = Math.max(0, vid.currentTime - 5); }
  if (e.key.toLowerCase() === 'n') { const n = document.querySelector('.episode-card.is-active + .episode-card'); if (n?.href) window.location.href = n.href; }
  if (e.key.toLowerCase() === 'p') {
    const cards = [...document.querySelectorAll('.episode-card')];
    const idx = cards.findIndex((c) => c.classList.contains('is-active'));
    const prev = cards[idx - 1];
    if (prev?.href) window.location.href = prev.href;
  }
});

document.addEventListener('DOMContentLoaded', loadDetail);

// ─── Tombol Kembali: referrer-aware (pola detail page) ───
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    if (!backBtn) return;
    backBtn.addEventListener('click', () => {
      if (document.referrer && document.referrer.startsWith(location.origin)) {
        history.back();
      } else {
        window.location.href = '/video/html/index.html';
      }
    });
  });
})();

// ─── Theater mode (V1.2): perbesar player, sembunyikan sidebar sementara ──
// State persisten di localStorage — preferensi tampilan bersifat sticky.
(function () {
  const KEY = 'watchTheater';
  const layout = document.querySelector('.watch-layout');
  const btn = document.getElementById('theaterToggleBtn');
  if (!layout || !btn) return;

  function apply(on) {
    layout.classList.toggle('theater-mode', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Keluar Mode Teater' : 'Mode Teater';
  }

  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch { /* abaikan */ }
  apply(on);

  btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* abaikan */ }
    apply(on);
  });
})();
