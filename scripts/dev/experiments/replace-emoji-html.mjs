// scripts/dev/replace-emoji-html.mjs — ganti emoji fungsional dengan ikon sprite SVG
import fs from 'fs';

const ic = (n) => `<svg class="ic" aria-hidden="true"><use href="/doujinPage/icons.svg#i-${n}"></use></svg>`;
const dir = 'website/doujinPage/html';

const REPLACEMENTS = {
  'detail.html': [
    ['← BACK TO HOME', `${ic('arrow-left')} BACK TO HOME`],
    ['id="altTitlesToggle" type="button">▾</button>', `id="altTitlesToggle" type="button">${ic('chevron-down')}</button>`],
    ['<span id="mTypeFlag">🇰🇷</span>', '<img id="mTypeFlag" class="flag-badge" src="/icons/flags/kr.svg" alt="">'],
    ['⟳ <span id="mStatusText">', `${ic('refresh-cw')} <span id="mStatusText">`],
    ['📖 READ NOW', `${ic('book-open')} READ NOW`],
    ['id="bookmarkBtn" type="button">🔖 BOOKMARK</button>', `id="bookmarkBtn" type="button">${ic('bookmark')} <span class="btn-label">BOOKMARK</span></button>`],
    ['id="favoriteBtn" type="button">❤️ FAVORITE</button>', `id="favoriteBtn" type="button">${ic('heart')} <span class="btn-label">FAVORITE</span></button>`],
    ['aria-label="Notifikasi">🔔</button>', `aria-label="Notifikasi">${ic('bell')}</button>`],
    ['id="listIconBtn" title="Daftar chapter">☰</button>', `id="listIconBtn" title="Daftar chapter">${ic('list')}</button>`],
    ['id="commentIconBtn" title="Komentar">💬</button>', `id="commentIconBtn" title="Komentar">${ic('message-circle')}</button>`],
    ['id="shareIconBtn" title="Bagikan">🔗</button>', `id="shareIconBtn" title="Bagikan">${ic('share-2')}</button>`],
    ['id="reportIconBtn" title="Laporkan">⚑</button>', `id="reportIconBtn" title="Laporkan">${ic('flag')}</button>`],
    ['id="tabInfo" type="button">📖 Detail Info</button>', `id="tabInfo" type="button">${ic('book-open')} Detail Info</button>`],
    ['id="tabMoreSeries" type="button">👍 More Series</button>', `id="tabMoreSeries" type="button">${ic('thumbs-up')} More Series</button>`],
    ['<h3 class="panel-title"><span class="icon">ⓘ</span> Series Information</h3>', `<h3 class="panel-title"><span class="icon">${ic('info')}</span> Series Information</h3>`],
    ['<span id="infoTypeFlag">🇰🇷</span>', '<img id="infoTypeFlag" class="flag-badge" src="/icons/flags/kr.svg" alt="">'],
    ['style="color:var(--ink);">⟳ <span id="infoStatus">', `style="color:var(--ink);">${ic('refresh-cw')} <span id="infoStatus">`],
    ['<div class="views-label">👁 VIEWS</div>', `<div class="views-label">${ic('eye')} VIEWS</div>`],
    ['<h3 class="panel-title"><span class="icon">☰</span> Synopsis</h3>', `<h3 class="panel-title"><span class="icon">${ic('list')}</span> Synopsis</h3>`],
    ['id="synopsisToggle" type="button">SHOW MORE ▾</button>', `id="synopsisToggle" type="button">SHOW MORE ${ic('chevron-down')}</button>`],
    ['<h3 class="panel-title" style="margin:0;"><span class="icon">📖</span> List Chapter', `<h3 class="panel-title" style="margin:0;"><span class="icon">${ic('book-open')}</span> List Chapter`],
    ['<span class="icon">🔍</span>', `<span class="icon">${ic('search')}</span>`],
    ['id="chapterSortBtn" title="Urutkan">⇅</button>', `id="chapterSortBtn" title="Urutkan">${ic('arrow-up-down')}</button>`],
    ['✨ Manga Serupa', `${ic('sparkles')} Manga Serupa`],
    ['id="backToTop" class="back-to-top" title="Kembali ke atas">▲</button>', `id="backToTop" class="back-to-top" title="Kembali ke atas">${ic('arrow-up')}</button>`],
  ],
  'index.html': [
    ['<span class="badge badge-gold">⭐ 8.8</span>', `<span class="badge badge-gold">${ic('star')} 8.8</span>`],
    ['🔥 Populer Saat Ini', `${ic('flame')} Populer Saat Ini`],
    ['LIHAT SEMUA POPULER →', `LIHAT SEMUA POPULER ${ic('arrow-right')}`],
    ['VIEW ALL MANGA →', `VIEW ALL MANGA ${ic('arrow-right')}`],
    ['id="backToTop" class="back-to-top" title="Kembali ke atas">▲</button>', `id="backToTop" class="back-to-top" title="Kembali ke atas">${ic('arrow-up')}</button>`],
  ],
  'library.html': [
    ['❤️ Favorite Manga', `${ic('heart')} Favorite Manga`],
    ['🔖 Bookmarked Manga', `${ic('bookmark')} Bookmarked Manga`],
    ['id="favoriteSeeMore" style="display: none;">SEE MORE ▾</button>', `id="favoriteSeeMore" style="display: none;">SEE MORE ${ic('chevron-down')}</button>`],
    ['id="bookmarkSeeMore" style="display: none;">SEE MORE ▾</button>', `id="bookmarkSeeMore" style="display: none;">SEE MORE ${ic('chevron-down')}</button>`],
    ['id="backToTop" class="back-to-top" title="Kembali ke atas">▲</button>', `id="backToTop" class="back-to-top" title="Kembali ke atas">${ic('arrow-up')}</button>`],
  ],
};

let fail = false;
for (const [name, pairs] of Object.entries(REPLACEMENTS)) {
  const p = `${dir}/${name}`;
  let c = fs.readFileSync(p, 'utf8');
  for (const [from, to] of pairs) {
    if (!c.includes(from)) {
      console.log(`MISS di ${name}: ${from.slice(0, 60)}...`);
      fail = true;
      continue;
    }
    c = c.split(from).join(to);
  }
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK', name);
}
process.exit(fail ? 1 : 0);
