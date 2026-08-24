// player-frame-server.js — Server eksperimen TERPISAH (port 3444).
// Tidak mengimpor server.js/controllers/routes utama — hanya playerFrame + express.
// Jalankan: node --env-file=.env scripts/dev/player-frame-server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PLAYER_HOSTS,
  isAllowedPlayerUrl,
  buildPlayerFrameHtml,
  fetchProviderEmbed,
} from '../../lib/scraper/playerFrame.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PLAYER_FRAME_PORT) || 3444;

export function createPlayerFrameApp() {
  const app = express();

  // Halaman uji A/B: versi tersaring vs iframe langsung
  app.get('/test', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>Player Frame Lab — :${PORT}</title>
<style>
 body{background:#141414;color:#eee;font-family:system-ui;margin:24px}
 input{padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#eee;width:60%}
 button{padding:8px 16px;border-radius:6px;border:none;background:#c0392b;color:#fff;cursor:pointer;margin-left:8px}
 .row{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}
 .col{flex:1;min-width:420px}
 h3{margin:8px 0}
 iframe{width:100%;height:480px;border:1px solid #333;border-radius:8px;background:#000}
</style></head><body>
<h2>🎬 Player Frame Lab (eksperimen, port ${PORT})</h2>
<p>Masukkan URL embed penyedia dan slug post nekopoi. Contoh slug: <code>akina-to-onsen-de-h-shiyo-episode-1-subtitle-indonesia</code></p>
<form method="get" action="/test">
  <input name="url" placeholder="https://streampoi.com/embed-xxxx.html" value="${_req.query.url || ''}" size="50">
  <input name="slug" placeholder="slug-post-nekopoi (opsional)" value="${_req.query.slug || ''}" size="30">
  <button type="submit">Muat</button>
</form>
${_req.query.url ? `<div class="row">
  <div class="col"><h3>✅ Versi TERSARING (player-frame)</h3><iframe src="/player-frame?url=${encodeURIComponent(_req.query.url)}&slug=${encodeURIComponent(_req.query.slug || '')}"></iframe></div>
  <div class="col"><h3>⚠️ Versi LANGSUNG (pembanding)</h3><iframe src="${String(_req.query.url).replace(/"/g, '&quot;')}"></iframe></div>
</div>` : ''}
</body></html>`);
  });

  // Inti eksperimen: HTML embed tersaring
  app.get('/player-frame', async (req, res) => {
    try {
      const safeUrl = isAllowedPlayerUrl(req.query.url);
      if (!safeUrl) return res.status(400).json({ success: false, message: 'URL tidak diizinkan' });
      const providerHost = new URL(safeUrl).hostname;
      const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '');
      const html = await fetchProviderEmbed(safeUrl, { slug });
      const transformed = buildPlayerFrameHtml({ html, providerHost, slug });
      res.type('html').send(transformed);
    } catch (err) {
      console.error('player-frame error:', err.message);
      res.status(502).json({ success: false, message: `Gagal memuat embed: ${err.message}` });
    }
  });

  // Passthrough XHR internal penyedia ($.get('/pass_md5/...') → /pf/<host>/pass_md5/...)
  app.get('/pf/:host/*', async (req, res) => {
    const host = req.params.host;
    if (!PLAYER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return res.status(400).json({ success: false, message: 'Host tidak diizinkan' });
    }
    const rest = req.params[0] || '';
    const target = `https://${host}/${rest}${req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''}`;
    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: `https://${host}/`,
          Accept: '*/*',
        },
      });
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.type(ct);
      const text = await upstream.text();
      res.send(text);
    } catch (err) {
      console.error('pf passthrough error:', err.message);
      res.status(502).json({ success: false, message: 'Passthrough gagal' });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createPlayerFrameApp().listen(PORT, () => {
    console.log(`[player-frame-lab] http://localhost:${PORT}/test`);
  });
}
