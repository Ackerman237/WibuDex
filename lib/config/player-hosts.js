// lib/config/playerHosts.js — SATU sumber kebenaran allowlist host player video.
//
// BUG-4 (config drift): sebelumnya tiga file mendefinisikan default berbeda —
//   nekoScraper.js   : ['playmogo.com', 'yandex.ru', 'streampoi.com']
//   playerFrame.js   : ['playmogo.com', 'streampoi.com', 'yandex.ru']  (tanpa env)
//   videoController   : 'playmogo.com,yandex.ru'                        (tanpa streampoi!)
// Update env/daftar cukup di sini sekarang.

export const DEFAULT_PLAYER_HOSTS = ['playmogo.com', 'streampoi.com', 'yandex.ru'];

const fromEnv = (process.env.NEKO_PLAYER_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter((h) => h.length > 0);

export const PLAYER_HOSTS = fromEnv.length > 0 ? fromEnv : DEFAULT_PLAYER_HOSTS;

export function isAllowedPlayerHost(hostname) {
  if (!hostname) return false;
  const host = String(hostname).toLowerCase();
  return PLAYER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
