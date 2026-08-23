import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PROVIDERS, createProxyAgents } from './providers.js';
import logger from '../logger.js';

// ============================================================
// KEBIJAKAN PER-TARGET — edit di sini.
//   mode: 'always' = selalu VPN | 'auto' = direct dulu, VPN jika diblokir
//   strict: true    = kill switch (tolak request jika semua VPN gagal)
//   sticky: true    = begitu diblokir, langsung VPN tanpa coba direct lagi
//   probeIntervalMs: jeda awal probe direct (backoff eksponensial s.d. 30 menit)
// ============================================================
const POLICIES = {
  neko: { mode: 'always', strict: true },
  doujin: { mode: 'auto', sticky: true, probeIntervalMs: 5 * 60_000 },
};

const TARGET_PROBE_URLS = {
  neko: 'https://nekopoi.care/',
  doujin: 'https://doujin.desu.xxx/api/genres',
};

const COOLDOWN_MS = 5 * 60_000;
const VERIFY_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 6_000;
const MAX_PROBE_DELAY_MS = 30 * 60_000;
const MONITOR_INTERVAL_MS = 60_000;
const HISTORY_LIMIT = 50;
const IP_SERVICES = ['https://api.ipify.org', 'https://ipv4.icanhazip.com'];

const VERIFY = { attempts: 5, delayMs: 2000 };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', '..', '.data');
const STATE_FILE = join(STATE_DIR, 'vpn-state.json');
const IS_TEST = process.env.NODE_ENV === 'test';

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let activeProvider = null;
let activeAgents = { agent: undefined, dispatcher: undefined };
let baselineIp = null;
let expectedIp = null;
let connectingPromise = null;
let monitorTimer = null;

const targets = {};
const health = new Map();
const history = [];

function getPolicy(target) {
  return (
    POLICIES[target] || { mode: 'auto', sticky: true, probeIntervalMs: 5 * 60_000 }
  );
}

function isStrict(policy) {
  return policy.strict ?? process.env.VPN_STRICT === 'true';
}

function getTargetState(target) {
  if (!targets[target]) {
    targets[target] = { blocked: false, probeFailures: 0, nextProbeAt: 0 };
  }
  return targets[target];
}

function getHealth(name) {
  if (!health.has(name)) {
    health.set(name, { successes: 0, failures: 0, latencyEma: 0, cooldownUntil: 0 });
  }
  return health.get(name);
}

function scoreOf(h) {
  const total = h.successes + h.failures;
  const rate = total > 0 ? h.successes / total : 0.8;
  return rate * 100 - h.latencyEma / 10 - h.failures * 5;
}

function pushHistory(event, data = {}) {
  history.push({ event, data, at: Date.now() });
  if (history.length > HISTORY_LIMIT) history.shift();
}

function emit(event, data) {
  emitter.emit(event, data);
}

let persistTimer = null;
function persist() {
  if (IS_TEST) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(
        STATE_FILE,
        JSON.stringify({ targets, history: history.slice(-HISTORY_LIMIT) }, null, 2)
      );
    } catch (err) {
      logger.debug({ err }, 'Gagal menyimpan state VPN');
    }
  }, 1000);
}

function loadPersisted() {
  if (IS_TEST) return;
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    for (const [key, val] of Object.entries(raw.targets || {})) {
      targets[key] = { ...getTargetState(key), ...val };
    }
    history.push(...(raw.history || []).slice(-HISTORY_LIMIT));
    if (Object.values(targets).some((t) => t.blocked)) {
      logger.info('State VPN dipulihkan: ada target yang sebelumnya diblokir');
    }
  } catch {
    // File belum ada / rusak — mulai dengan state bersih.
  }
}
loadPersisted();

export function classifyError(err) {
  const msg = String(err?.message || err || '');
  if (/403|forbidden|getaddrinfo|ENOTFOUND|ECONNRESET|EAI_AGAIN|dns/i.test(msg)) {
    return 'blocked';
  }
  if (/abort|timed?\s*out|ETIMEDOUT|HTTP\s?5\d\d|502|503|504|EACCES|ECONNREFUSED|ECONNRESET/i.test(msg)) {
    return 'retryable';
  }
  return 'unknown';
}

async function fetchWithTimeout(url, timeoutMs, extraOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (VPN-Manager health check)' },
      ...extraOptions,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicIp() {
  for (const service of IP_SERVICES) {
    try {
      const res = await fetchWithTimeout(service, VERIFY_TIMEOUT_MS);
      if (res.ok) {
        const ip = (await res.text()).trim();
        if (ip) return ip;
      }
    } catch {
      // Coba layanan berikutnya.
    }
  }
  return null;
}

async function verifyProvider(provider, target) {
  if (provider.type === 'proxy') return true;
  const currentIp = await fetchPublicIp();
  if (!currentIp) {
    logger.warn(
      { provider: provider.name },
      'Tidak bisa memverifikasi IP publik — anggap VPN sehat'
    );
    return true;
  }
  if (baselineIp && currentIp === baselineIp) {
    const targetOk = await probeDirect(target);
    if (targetOk) {
      expectedIp = currentIp;
      logger.info(
        { provider: provider.name },
        'IP tidak berubah namun target terjangkau — kemungkinan VPN sudah aktif sebelumnya'
      );
      return true;
    }
    return false;
  }
  expectedIp = currentIp;
  if (target === 'neko') {
    try {
      const res = await fetchWithTimeout(TARGET_PROBE_URLS.neko, VERIFY_TIMEOUT_MS);
      if (res.status === 403) return false;
    } catch {
      // Health check target gagal tidak otomatis berarti VPN buruk.
    }
  }
  return true;
}

function setActive(provider) {
  activeProvider = provider;
  activeAgents =
    provider && provider.type === 'proxy' ? createProxyAgents() : { agent: undefined, dispatcher: undefined };
  if (!provider) expectedIp = null;
}

async function deactivateActive() {
  if (!activeProvider) return;
  const provider = activeProvider;
  setActive(null);
  try {
    await provider.disconnect();
  } catch (err) {
    logger.warn({ err, provider: provider.name }, 'Gagal disconnect provider aktif');
  }
}

function currentRoute() {
  return {
    provider: activeProvider ? activeProvider.name : null,
    agent: activeAgents.agent,
    dispatcher: activeAgents.dispatcher,
  };
}

async function probeDirect(target) {
  const url = TARGET_PROBE_URLS[target];
  if (!url) return false;
  try {
    const res = await fetchWithTimeout(url, PROBE_TIMEOUT_MS);
    return res.status < 400;
  } catch {
    return false;
  }
}

async function ensureConnectedRoute(target) {
  if (activeProvider) {
    const h = getHealth(activeProvider.name);
    if (Date.now() < h.cooldownUntil) {
      await deactivateActive();
    } else {
      return currentRoute();
    }
  }

  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const candidates = PROVIDERS.filter(
      (p) => Date.now() >= getHealth(p.name).cooldownUntil
    ).sort((a, b) => scoreOf(getHealth(b.name)) - scoreOf(getHealth(a.name)));

    for (const provider of candidates) {
      let installed = false;
      try {
        installed = await provider.isInstalled();
      } catch {
        // gagal cek = anggap tidak terpasang (installed tetap false)
      }
      if (!installed) continue;

      const startedAt = Date.now();
      try {
        if (provider.type === 'system' && !baselineIp) {
          baselineIp = await fetchPublicIp();
        }
        await provider.connect();

        let verified = false;
        let lastVerifyError = null;
        for (let attempt = 0; attempt < VERIFY.attempts; attempt++) {
          if (await verifyProvider(provider, target)) {
            verified = true;
            break;
          }
          lastVerifyError = new Error(
            `Verifikasi gagal: IP publik tidak berubah (${provider.name})`
          );
          if (attempt < VERIFY.attempts - 1) await delay(VERIFY.delayMs);
        }
        if (!verified) {
          throw lastVerifyError;
        }

        setActive(provider);
        const h = getHealth(provider.name);
        h.successes += 1;
        const elapsed = Date.now() - startedAt;
        h.latencyEma = h.latencyEma > 0 ? h.latencyEma * 0.7 + elapsed * 0.3 : elapsed;

        emit('vpn:connected', { provider: provider.name, target });
        pushHistory('connected', { provider: provider.name, target });
        startMonitor();
        persist();
        return currentRoute();
      } catch (err) {
        const h = getHealth(provider.name);
        h.failures += 1;
        h.cooldownUntil = Date.now() + COOLDOWN_MS;
        try {
          await provider.disconnect();
        } catch {
          // Abaikan kegagalan disconnect saat cleanup.
        }
        if (activeProvider === provider) setActive(null);
        emit('vpn:failed', {
          provider: provider.name,
          target,
          error: String(err?.message || err),
        });
        pushHistory('provider_failed', {
          provider: provider.name,
          target,
          error: String(err?.message || err),
        });
      }
    }

    logger.warn({ target }, 'Semua provider VPN gagal');
    if (isStrict(getPolicy(target))) {
      const error = new Error(
        `VPN_STRICT aktif: semua provider VPN gagal untuk target "${target}", request ditolak`
      );
      emit('vpn:failed', { provider: null, target, error: error.message });
      throw error;
    }
    emit('vpn:failed', { provider: null, target, error: 'semua provider gagal, lanjut direct' });
    return { provider: null, agent: undefined, dispatcher: undefined, degraded: true };
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

export async function ensureVpn(target) {
  const policy = getPolicy(target);

  if (policy.mode === 'always') {
    return ensureConnectedRoute(target);
  }

  const st = getTargetState(target);
  if (!st.blocked) {
    return { provider: null, agent: undefined, dispatcher: undefined };
  }

  const now = Date.now();
  if (now >= st.nextProbeAt) {
    const directOk = await probeDirect(target);
    if (directOk) {
      st.blocked = false;
      st.probeFailures = 0;
      emit('vpn:recovered', { target });
      pushHistory('recovered', { target });
      persist();
      return { provider: null, agent: undefined, dispatcher: undefined };
    }
    st.probeFailures += 1;
    st.nextProbeAt =
      now + Math.min(policy.probeIntervalMs * 2 ** st.probeFailures, MAX_PROBE_DELAY_MS);
    persist();
  }

  return ensureConnectedRoute(target);
}

export async function reportFailure(target, err) {
  const policy = getPolicy(target);
  const kind = classifyError(err);
  const message = String(err?.message || err);
  pushHistory('request_failed', { target, kind, error: message });

  if (kind === 'retryable') {
    return;
  }

  if (policy.mode === 'always') {
    if (activeProvider) {
      const from = activeProvider.name;
      const h = getHealth(from);
      h.failures += 1;
      h.cooldownUntil = Date.now() + COOLDOWN_MS;
      await deactivateActive();
      emit('vpn:switched', { target, from, reason: 'request_failure' });
      pushHistory('switched', { target, from, reason: 'request_failure' });
    }
    ensureConnectedRoute(target).catch(() => {});
  } else {
    const st = getTargetState(target);
    if (!st.blocked) {
      st.blocked = true;
      st.probeFailures = 0;
      st.nextProbeAt = Date.now() + policy.probeIntervalMs;
      emit('vpn:blocked', { target });
      pushHistory('blocked', { target });
      persist();
    }
    ensureConnectedRoute(target).catch(() => {});
  }
}

export function reportSuccess(target) {
  const st = getTargetState(target);
  if (st.blocked) {
    st.blocked = false;
    st.probeFailures = 0;
    emit('vpn:recovered', { target });
    pushHistory('recovered', { target });
    persist();
  }
}

export async function disconnectVpn() {
  stopMonitor();
  await deactivateActive();
  baselineIp = null;
  expectedIp = null;
  emit('vpn:disconnected', {});
}

export function getVpnStatus() {
  const providers = {};
  for (const p of PROVIDERS) {
    const h = getHealth(p.name);
    providers[p.name] = {
      type: p.type,
      score: Math.round(scoreOf(h)),
      successes: h.successes,
      failures: h.failures,
      latencyMs: h.latencyEma > 0 ? Math.round(h.latencyEma) : null,
      coolingDown: Date.now() < h.cooldownUntil,
    };
  }

  const targetsOut = {};
  for (const key of Object.keys(POLICIES)) {
    const st = targets[key] || { blocked: false, nextProbeAt: 0 };
    targetsOut[key] = {
      mode: getPolicy(key).mode,
      strict: isStrict(getPolicy(key)),
      blocked: Boolean(st.blocked),
      nextProbeAt: st.nextProbeAt || null,
    };
  }

  return {
    activeProvider: activeProvider ? activeProvider.name : null,
    targets: targetsOut,
    providers,
    history: history.slice(-20),
  };
}

function startMonitor() {
  if (IS_TEST || monitorTimer) return;
  monitorTimer = setInterval(() => {
    monitorTick().catch(() => {});
  }, MONITOR_INTERVAL_MS);
  monitorTimer.unref?.();
}

function stopMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = null;
}

async function monitorTick() {
  if (!activeProvider || activeProvider.type !== 'system') return;
  const currentIp = await fetchPublicIp();
  if (!currentIp) return;
  if (expectedIp && currentIp !== expectedIp) {
    const from = activeProvider.name;
    logger.warn({ provider: from, expectedIp, currentIp }, 'IP publik berubah — VPN kemungkinan drop');
    const h = getHealth(from);
    h.failures += 1;
    h.cooldownUntil = Date.now() + COOLDOWN_MS;
    await deactivateActive();
    emit('vpn:switched', { from, reason: 'ip_changed' });
    pushHistory('monitor_ip_changed', { provider: from });
    persist();
  } else if (!expectedIp) {
    expectedIp = currentIp;
  }
}

export function onVpnEvent(event, handler) {
  emitter.on(event, handler);
}

onVpnEvent('vpn:connected', (d) => logger.info(d, 'VPN terhubung'));
onVpnEvent('vpn:failed', (d) => logger.warn(d, 'Provider VPN gagal'));
onVpnEvent('vpn:switched', (d) => logger.warn(d, 'VPN berpindah provider'));
onVpnEvent('vpn:blocked', (d) => logger.warn(d, 'Target terdeteksi diblokir, mengaktifkan VPN'));
onVpnEvent('vpn:recovered', (d) => logger.info(d, 'Target kembali bisa diakses langsung'));

export const _internals = {
  reset() {
    for (const key of Object.keys(targets)) delete targets[key];
    health.clear();
    history.length = 0;
    activeProvider = null;
    activeAgents = { agent: undefined, dispatcher: undefined };
    baselineIp = null;
    expectedIp = null;
    connectingPromise = null;
  },
  getTargetState,
  getHealth,
  setBaselineIp(ip) {
    baselineIp = ip;
  },
  setVerifyConfig({ attempts, delayMs }) {
    if (Number.isFinite(attempts)) VERIFY.attempts = attempts;
    if (Number.isFinite(delayMs)) VERIFY.delayMs = delayMs;
  },
  getActiveProviderName() {
    return activeProvider ? activeProvider.name : null;
  },
};
