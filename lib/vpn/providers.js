import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { basename } from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent } from 'undici';
import logger from '../logger.js';

// ============================================================
// EDIT DI FILE INI untuk menambah / mengurangi / mengubah VPN.
// Urutan array = urutan prioritas awal (nanti dinamis oleh scoring).
// ============================================================

const execAsync = promisify(exec);
const IS_WIN = process.platform === 'win32';

const WIREGUARD_CONF = IS_WIN
  ? 'C:\\Program Files\\WireGuard\\Data\\tunnel.conf'
  : '/etc/wireguard/wg0.conf';
const OPENVPN_CONF = IS_WIN
  ? 'C:\\Program Files\\OpenVPN\\config\\client.ovpn'
  : '/etc/openvpn/client/client.ovpn';

async function hasCommand(cmd) {
  try {
    await execAsync(IS_WIN ? `where ${cmd}` : `command -v ${cmd}`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const warpProvider = {
  name: 'warp',
  type: 'system',
  async isInstalled() {
    return hasCommand('warp-cli');
  },
  async connect() {
    await execAsync('warp-cli connect', { timeout: 20000 });
  },
  async disconnect() {
    await execAsync('warp-cli disconnect', { timeout: 15000 });
  },
};

const protonProvider = {
  name: 'protonvpn',
  type: 'system',
  async isInstalled() {
    return (await hasCommand('protonvpn-cli')) || (await hasCommand('protonvpn'));
  },
  async connect() {
    const cli = (await hasCommand('protonvpn-cli')) ? 'protonvpn-cli' : 'protonvpn';
    await execAsync(`${cli} connect --cc fastest`, { timeout: 60000 });
  },
  async disconnect() {
    const cli = (await hasCommand('protonvpn-cli')) ? 'protonvpn-cli' : 'protonvpn';
    await execAsync(`${cli} disconnect`, { timeout: 30000 });
  },
};

let wireguardActive = false;

const wireguardProvider = {
  name: 'wireguard',
  type: 'system',
  async isInstalled() {
    return IS_WIN ? hasCommand('wireguard') : hasCommand('wg-quick');
  },
  async connect() {
    if (IS_WIN) {
      await execAsync(`wireguard.exe /installtunnelservice "${WIREGUARD_CONF}"`, { timeout: 30000 });
    } else {
      await execAsync(`wg-quick up "${WIREGUARD_CONF}"`, { timeout: 30000 });
    }
    wireguardActive = true;
  },
  async disconnect() {
    if (!wireguardActive) return;
    if (IS_WIN) {
      const tunnelName = basename(WIREGUARD_CONF).replace(/\.conf$/i, '');
      await execAsync(`wireguard.exe /uninstalltunnelservice ${tunnelName}`, { timeout: 30000 });
    } else {
      await execAsync(`wg-quick down "${WIREGUARD_CONF}"`, { timeout: 30000 });
    }
    wireguardActive = false;
  },
};

let openvpnProcess = null;

const openvpnProvider = {
  name: 'openvpn',
  type: 'system',
  async isInstalled() {
    return hasCommand('openvpn');
  },
  async connect() {
    if (IS_WIN) {
      openvpnProcess = spawn('openvpn', ['--config', OPENVPN_CONF], {
        detached: true,
        stdio: 'ignore',
      });
      openvpnProcess.unref();
      await new Promise((resolve) => setTimeout(resolve, 8000));
    } else {
      await execAsync(`openvpn --config "${OPENVPN_CONF}" --daemon`, { timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  },
  async disconnect() {
    try {
      if (IS_WIN && openvpnProcess?.pid) {
        await execAsync(`taskkill /PID ${openvpnProcess.pid} /F`, { timeout: 10000 });
      } else if (!IS_WIN) {
        await execAsync("pkill -f 'openvpn --config'", { timeout: 10000 });
      }
    } catch (err) {
      logger.debug({ err }, 'Gagal mematikan proses OpenVPN (mungkin sudah mati)');
    }
    openvpnProcess = null;
  },
};

function getProxyUrl() {
  return (
    process.env.NEKO_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    process.env.SOCKS_PROXY ||
    ''
  );
}

const proxyProvider = {
  name: 'proxy',
  type: 'proxy',
  async isInstalled() {
    return Boolean(getProxyUrl());
  },
  async connect() {},
  async disconnect() {},
};

export function createProxyAgents() {
  const url = getProxyUrl();
  if (!url) return { agent: undefined, dispatcher: undefined };
  if (url.startsWith('socks')) {
    // SocksProxyAgent sebagai opsi `agent` DIABAIKAN oleh global fetch (undici).
    // Sampai ada dispatcher SOCKS, proxy socks tidak akan efektif — warn eksplisit.
    logger.warn(
      { proxyUrl: url.replace(/\/\/[^@]*@/, '//***@') },
      'Proxy SOCKS tidak didukung fetch bawaan Node (undici). Gunakan proxy http(s) atau VPN system-level.'
    );
    return { agent: undefined, dispatcher: undefined };
  }
  const agent = new HttpsProxyAgent(url);
  let dispatcher;
  try {
    dispatcher = new ProxyAgent(url);
  } catch (err) {
    logger.warn({ err }, 'Gagal membuat undici ProxyAgent, proxy mungkin tidak aktif');
  }
  return { agent, dispatcher };
}

export const PROVIDERS = [
  warpProvider,
  protonProvider,
  wireguardProvider,
  openvpnProvider,
  proxyProvider,
];
