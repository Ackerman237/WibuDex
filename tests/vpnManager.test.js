import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/vpn/providers.js', () => {
  const providers = [];
  return {
    PROVIDERS: providers,
    createProxyAgents: () => ({ agent: { fakeAgent: true }, dispatcher: undefined }),
    __setProviders: (list) => {
      providers.splice(0, providers.length, ...list);
    },
  };
});

import { __setProviders } from '../lib/vpn/providers.js';
import {
  ensureVpn,
  reportFailure,
  disconnectVpn,
  getVpnStatus,
  classifyError,
  _internals,
} from '../lib/vpn/vpn-manager.js';

function makeProvider(name, { type = 'proxy', connectError = null, connectDelayMs = 0 } = {}) {
  return {
    name,
    type,
    isInstalled: vi.fn(async () => true),
    connect: vi.fn(async () => {
      if (connectDelayMs > 0) await new Promise((r) => setTimeout(r, connectDelayMs));
      if (connectError) throw connectError;
    }),
    disconnect: vi.fn(async () => {}),
  };
}

describe('classifyError', () => {
  it('mengklasifikasi 403/DNS/reset sebagai blocked', () => {
    expect(classifyError(new Error('HTTP 403'))).toBe('blocked');
    expect(classifyError(new Error('getaddrinfo ENOTFOUND doujin.desu.xxx'))).toBe('blocked');
    expect(classifyError(new Error('socket hang up ECONNRESET'))).toBe('blocked');
  });

  it('mengklasifikasi timeout dan 5xx sebagai retryable', () => {
    expect(classifyError(new Error('Timeout 15 detik saat mengakses /'))).toBe('retryable');
    expect(classifyError(new Error('HTTP 503'))).toBe('retryable');
  });
});

describe('vpnManager', () => {
  beforeEach(() => {
    _internals.reset();
    _internals.setVerifyConfig({ attempts: 2, delayMs: 1 });
    __setProviders([]);
    vi.restoreAllMocks();
  });

  it('mode auto: direct dulu tanpa VPN sebelum ada blokir', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    const route = await ensureVpn('doujin');

    expect(route.provider).toBeNull();
    expect(warp.connect).not.toHaveBeenCalled();
  });

  it('failover ke provider berikutnya saat provider pertama gagal', async () => {
    const bad = makeProvider('bad', { connectError: new Error('boom') });
    const good = makeProvider('good');
    __setProviders([bad, good]);

    const route = await ensureVpn('neko');

    expect(route.provider).toBe('good');
    expect(bad.connect).toHaveBeenCalledTimes(1);
    expect(bad.disconnect).toHaveBeenCalledTimes(1);
    expect(good.connect).toHaveBeenCalledTimes(1);
  });

  it('sticky state: doujin yang diblokir langsung pakai VPN di request berikutnya', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    await reportFailure('doujin', new Error('HTTP 403'));
    const route = await ensureVpn('doujin');

    expect(route.provider).toBe('warp');
    expect(getVpnStatus().targets.doujin.blocked).toBe(true);
  });

  it('gagal retryable (timeout) tidak menandai target diblokir', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    await reportFailure('doujin', new Error('Timeout 12 detik'));
    const route = await ensureVpn('doujin');

    expect(route.provider).toBeNull();
    expect(getVpnStatus().targets.doujin.blocked).toBe(false);
  });

  it('single-flight: 10 request bersamaan hanya membuat 1 koneksi', async () => {
    const slow = makeProvider('slow', { connectDelayMs: 25 });
    __setProviders([slow]);

    const routes = await Promise.all(Array.from({ length: 10 }, () => ensureVpn('neko')));

    expect(slow.connect).toHaveBeenCalledTimes(1);
    expect(routes.every((r) => r.provider === 'slow')).toBe(true);
  });

  it('strict mode: request ditolak jika semua provider gagal', async () => {
    const a = makeProvider('a', { connectError: new Error('down') });
    const b = makeProvider('b', { connectError: new Error('down') });
    __setProviders([a, b]);

    await expect(ensureVpn('neko')).rejects.toThrow(/VPN_STRICT/);
  });

  it('provider yang gagal masuk cooldown lalu dicoba lagi setelah cooldown habis', async () => {
    const flaky = makeProvider('flaky', { connectError: new Error('down') });
    __setProviders([flaky]);

    await expect(ensureVpn('neko')).rejects.toThrow(/VPN_STRICT/);
    expect(flaky.connect).toHaveBeenCalledTimes(1);

    flaky.connect.mockImplementation(async () => {});
    _internals.getHealth('flaky').cooldownUntil = Date.now() - 1;

    const route = await ensureVpn('neko');
    expect(route.provider).toBe('flaky');
    expect(flaky.connect).toHaveBeenCalledTimes(2);
  });

  it('verifikasi IP: provider yang IP-nya tidak berubah dianggap gagal dan switch', async () => {
    const ipSeq = ['1.1.1.1', '1.1.1.1', '1.1.1.1', '9.9.9.9'];
    let ipifyCalls = 0;
    global.fetch = vi.fn(async (url) => {
      if (/ipify|icanhazip/.test(String(url))) {
        const ip = ipSeq[Math.min(ipifyCalls, ipSeq.length - 1)];
        ipifyCalls += 1;
        return { ok: true, status: 200, text: async () => ip };
      }
      const status = ipifyCalls < 4 ? 403 : 200;
      return { ok: status === 200, status, text: async () => '' };
    });

    const a = makeProvider('sysA', { type: 'system' });
    const b = makeProvider('sysB', { type: 'system' });
    __setProviders([a, b]);
    _internals.setBaselineIp(null);

    const route = await ensureVpn('neko');

    expect(route.provider).toBe('sysB');
    expect(a.connect).toHaveBeenCalledTimes(1);
    expect(_internals.getHealth('sysA').failures).toBeGreaterThanOrEqual(1);
    expect(_internals.getHealth('sysB').successes).toBe(1);

    await disconnectVpn();
  });

  it('disconnectVpn memutus provider aktif', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    await ensureVpn('neko');
    expect(_internals.getActiveProviderName()).toBe('warp');

    await disconnectVpn();
    expect(warp.disconnect).toHaveBeenCalledTimes(1);
    expect(_internals.getActiveProviderName()).toBeNull();
  });
});

describe('VPN auto-toggle idle (pindah section neko ↔ doujin)', () => {
  beforeEach(() => {
    _internals.reset();
    _internals.setVerifyConfig({ attempts: 2, delayMs: 1 });
    __setProviders([]);
    vi.restoreAllMocks();
    _internals.setIdleTimeoutMs(3 * 60_000); // default 3 menit
  });

  it('idle melewati batas → VPN dimatikan, lalu nyala lagi saat neko dipakai', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    // Masuk neko → VPN nyala
    await ensureVpn('neko');
    expect(_internals.getActiveProviderName()).toBe('warp');
    expect(getVpnStatus().idleDisconnectInMs).toBeLessThanOrEqual(3 * 60_000);

    // User pindah ke doujin — tidak ada aktivitas neko melewati window idle
    _internals.setLastUsedAt('neko', Date.now() - 4 * 60_000);
    await _internals.forceIdleCheck();

    expect(warp.disconnect).toHaveBeenCalledTimes(1);
    expect(_internals.getActiveProviderName()).toBeNull();
    expect(getVpnStatus().idleDisconnectInMs).toBeNull();

    // Balik ke neko → nyala lagi otomatis
    await ensureVpn('neko');
    expect(_internals.getActiveProviderName()).toBe('warp');
    expect(warp.connect).toHaveBeenCalledTimes(2);
  });

  it('aktivitas dalam window idle → VPN tetap hidup', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    await ensureVpn('neko');
    _internals.setLastUsedAt('neko', Date.now() - 60_000); // baru 1 menit lalu

    await _internals.forceIdleCheck();

    expect(_internals.getActiveProviderName()).toBe('warp');
    expect(warp.disconnect).not.toHaveBeenCalled();
  });

  it('doujin sedang blocked → VPN TIDAK dimatikan meski neko idle', async () => {
    const warp = makeProvider('warp');
    __setProviders([warp]);

    // Doujin diblokir → sticky: dia juga bergantung pada VPN
    await reportFailure('doujin', new Error('HTTP 403'));
    await ensureVpn('doujin');
    expect(_internals.getActiveProviderName()).toBe('warp');

    // Neko diam jauh melewati window idle
    _internals.setLastUsedAt('neko', Date.now() - 10 * 60_000);

    await _internals.forceIdleCheck();

    expect(_internals.getActiveProviderName()).toBe('warp');
    expect(warp.disconnect).not.toHaveBeenCalled();
  });
});
