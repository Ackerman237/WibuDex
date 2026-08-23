import fs from 'fs';
import puppeteer from 'puppeteer-core';
import logger from './logger.js';

function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const path of candidates) {
    if (path && fs.existsSync(path)) {
      return path;
    }
  }

  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const CHROME_PATH = resolveChromePath();

let browser = null;

export async function getBrowser() {
  if (browser && browser.connected) {
    return browser;
  }

  logger.info('Menjalankan Google Chrome...');

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ]
  });

  browser.on('disconnected', () => {
    browser = null;
    logger.warn('Chrome terputus.');
  });

  logger.info('Google Chrome berhasil dijalankan.');

  return browser;
}

export async function newPage() {
  const browser = await getBrowser();
  return await browser.newPage();
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Google Chrome ditutup.');
  }
}