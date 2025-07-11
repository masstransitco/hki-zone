// scrape-28car.js
// 1) grab page-1 of private listings from 28car mobile site
// 2) open each detail page with Playwright
// 3) extract make / model / year / price + up-to-5 full-size photos
//    ───────── DEBUG EDITION ─────────
// 2025-07-11 ▸ v7-debug
//   • For the *very first* photo attempt we now:
//       – log every network request/response line (method, status, url)
//       – dump the first ~1 200 characters of the raw pop-up HTML
//   • Helps us see exactly what 28Car is sending so we can adapt scraping.
//   • Behaviour unchanged for subsequent listings.

const axios        = require('axios');
const cheerio      = require('cheerio');
const iconv        = require('iconv-lite');
const { chromium } = require('playwright');

// ── config ──────────────────────────────────────────────────────
const LIST_URL   = 'http://m.28car.com/sell_lst.php';
const LIST_QUERY = { h_f_ty: 1, h_page: 1, qs_b: 'y', qs_e: 'y' }; // private listings p-1
const MOBILE_UA  = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const DELAY_MS   = 1300;   // polite pause between detail pages
const MAX_PHOTOS = 5;      // fetch ≤ N photos per car

const PLACEHOLDER_RE = /(openp|sold|fr_id_bn)\.gif$/i;
let   photoDebugOnce = true;   // one-shot flag
// ───────────────────────────────────────────────────────────────

(async () => {
  /* 1⃣  download list */
  const res  = await axios.get(LIST_URL, {
    params       : LIST_QUERY,
    headers      : { 'User-Agent': MOBILE_UA },
    responseType : 'arraybuffer'
  });
  const html = iconv.decode(res.data, 'big5');
  const $l   = cheerio.load(html);

  /* 2⃣  collect VIDs + thumb + raw title */
  const list = [];
  $l('td[onclick^="go"]').each((_, td) => {
    const vid = ($l(td).attr('onclick') || '').match(/\w+\([^,]+,\s*(\d+)/)?.[1];
    if (!vid) return;
    const tr   = $l(td).closest('tr');
    const img  = tr.find('img').first().attr('src') || '';
    const raw  = tr.find('td').eq(1).text().trim().replace(/\s+/g, ' ');
    list.push({ vid, img, raw });
  });
  if (!list.length) {
    console.error('❌  list parse failed – layout changed.');
    return;
  }

  /* 3⃣  detail pages */
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ locale: 'zh-HK', userAgent: MOBILE_UA });
  const page    = await ctx.newPage();
  const sleep   = ms => new Promise(r => setTimeout(r, ms));

  console.log(`Found ${list.length} rows – fetching unique detail pages …\n`);
  const seen    = new Set();
  const results = [];

  // helper: find pic_pop.php href (or popPic) anywhere in current doc/frames
  async function findPopHref(p) {
    for (const f of p.frames()) {
      const href = await f.evaluate(() => {
        const a = document.querySelector('a[href*="pic_pop.php"]');
        if (a) return a.getAttribute('href');
        const click = document.querySelector('[onclick*="pic_pop.php"], [onclick*="popPic("]');
        if (click) {
          const txt = click.getAttribute('onclick') || '';
          const mm  = txt.match(/pic_pop\.php[^'"\s)]+/);
          if (mm) return mm[0];
          const m = txt.match(/popPic\([^,]+,\s*(\d+),\s*(\d+)/); // VID, CNT
          if (m) return `/pic_pop.php?h_cat=sell&h_vid=${m[1]}&h_cnt=${m[2]}&h_idx=1`;
        }
        return '';
      });
      if (href) return href;
    }
    return '';
  }

  // helper: grab image by sniffing network responses first, DOM second
  async function grabImage(popURL) {
    await page.goto(popURL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // one-off debug hooks
    if (photoDebugOnce) {
      page.on('request',  r => console.log('   >> req', r.method(), r.url()));
      page.on('response', r => console.log('   << res', r.status(), r.url()));
    }

    // 1️⃣ wait up to 3 s for *any* image response
    try {
      const resp = await page.waitForResponse(r => {
        const ct = (r.headers()['content-type'] || '').toLowerCase();
        return ct.startsWith('image/');
      }, { timeout: 3000 });
      const imgURL = resp.url();
      if (!PLACEHOLDER_RE.test(imgURL)) return imgURL;
    } catch {/* no image response */}

    // 2️⃣ fallback DOM scan (all frames)
    for (const fr of page.frames()) {
      const src = await fr.evaluate(() => {
        const img = document.querySelector('img');
        return img ? img.src : '';
      });
      if (src && !PLACEHOLDER_RE.test(src)) return new URL(src, popURL).href;
    }

    // 3️⃣ meta refresh
    const meta = await page.evaluate(() => {
      const m = document.querySelector('meta[http-equiv="refresh" i]');
      if (!m) return '';
      const cont = m.getAttribute('content') || '';
      const mt = cont.match(/url=([^;]+)/i);
      return mt ? mt[1] : '';
    });
    if (meta && !PLACEHOLDER_RE.test(meta)) return new URL(meta, popURL).href;

    // dump raw pop-up HTML once for analysis
    if (photoDebugOnce) {
      photoDebugOnce = false; // disable after first dump
      console.log('\n========== RAW POP-UP HTML ==========');
      console.log((await page.content()).slice(0, 1200));
      console.log('… (truncated)');
      console.log('=====================================\n');
    }

    return '';
  }

  for (const { vid, img, raw } of list) {
    if (seen.has(vid)) continue;
    seen.add(vid);

    const url = `http://m.28car.com/sell_dsp.php?h_vid=${vid}&h_vw=y`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      /* locate spec frame */
      const frame = await (async function findFrame() {
        for (let t = 0; t < 15; t++) {
          const tgt = await (async function rec(fr) {
            for (const f of fr) {
              if ((await f.content()).includes('售價')) return f;
              const deep = await rec(f.childFrames());
              if (deep) return deep;
            }
          })(page.frames());
          if (tgt) return tgt;
          await sleep(400);
        }
        return page.mainFrame();
      })();

      /* spec → object */
      const $spec = cheerio.load(await frame.content(), null, false);
      const spec = {};
      $spec('tr').each((_, tr) => {
        const td = $spec(tr).find('td');
        if (td.length < 2) return;
        const key = $spec(td[0]).text().replace(/[：:\s\u00A0]+$/g, '').trim();
        const val = $spec(td[1]).text().trim().replace(/\s+/g, ' ');
        if (key) spec[key] = val;
      });
      if (!spec['售價']) {
        console.warn(`· VID ${vid} has no spec table – skipped`);
        continue;
      }

      /* 📸 photo extraction */
      const imgsFull = [];
      
      // Extract images directly from the page (not popup)
      for (const f of page.frames()) {
        const images = await f.evaluate(() => {
          return Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => 
              src.includes('djlfajk23a.28car.com/data/image/sell/') ||
              src.includes('28car.com/data/image/sell/')
            );
        });
        
        for (const imgSrc of images) {
          if (!imgsFull.includes(imgSrc)) {
            imgsFull.push(imgSrc);
          }
        }
        
        // Limit to MAX_PHOTOS
        if (imgsFull.length >= MAX_PHOTOS) break;
      }

      results.push({
        make     : spec['車廠'] || '—',
        model    : spec['型號'] || raw,
        year     : spec['年份'] || '—',
        price    : spec['售價'],
        imgThumb : img,
        imgsFull,
        url
      });

      console.log(`✔ ${results.length}/${seen.size}  ${results.at(-1).model}  (+${imgsFull.length} photos)`);
    } catch (err) {
      console.warn(`✖ VID ${vid} skipped – ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  await browser.close();

  /* 4⃣ print */
  console.log('\n#  Make / Model (Year) – Price');
  console.log('─'.repeat(74));
  results.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)} ${r.make}  ${r.model} (${r.year}) – ${r.price}`);
    console.log(`   Thumb : ${r.imgThumb}`);
    console.log(`   Full  : ${r.imgsFull.length ? r.imgsFull.join(', ') : '—'}`);
    console.log(`   URL   : ${r.url}\n`);
  });
})();