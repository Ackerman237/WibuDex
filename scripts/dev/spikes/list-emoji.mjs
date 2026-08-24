// scripts/dev/list-emoji.mjs — tampilkan setiap baris yang mengandung emoji
import fs from 'fs';

const dir = 'website/doujinPage/html';
const re = /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F]/gu;

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const lines = fs.readFileSync(`${dir}/${name}`, 'utf8').split(/\r?\n/);
  let n = 0;
  lines.forEach((line, i) => {
    if (re.test(line)) {
      console.log(`${name}:${i + 1}: ${line.trim().slice(0, 110)}`);
      n++;
    }
  });
  if (n) console.log('');
}
