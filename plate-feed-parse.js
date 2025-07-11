const axios   = require('axios');
const cheerio = require('cheerio');
const iconv   = require('iconv-lite');
const fs      = require('fs');

(async () => {
  const url     = 'http://m.28car.com/num_lst.php';
  const params  = { type: 1, h_page: 1, qs_b: 'y', qs_e: 'y' };
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
  };

  const res  = await axios.get(url, { params, headers, responseType: 'arraybuffer' });
  const html = iconv.decode(res.data, 'big5');
  const $    = cheerio.load(html);

  /* ①  figure out which num_dsp*.php the page uses today */
  const firstLink = $('a[href*="num_dsp"]').first().attr('href') || '';
  const dspFile   = (firstLink.match(/num_dsp[^?"]+\.php/) || ['num_dsp.php'])[0];

  /* ②  extract rows */
  const rows = [];
  $(`a[href*="${dspFile}"]`).each((_, a) => {
    const href   = $(a).attr('href');
    const plate  = $(a).text().trim();
    const tds    = $(a).closest('tr').find('td');
    const price  = $(tds[2]).text().trim().replace(/\s+/g, ' ') || '—';
    const visits = $(tds[4]).text().trim() || '0';
    const link   = new URL(href, url).href;
    rows.push({ plate, price, visits, link });
  });

  if (!rows.length) {
    fs.writeFileSync('debug_28car_page.html', html);
    console.error('Still zero rows – saved page to debug_28car_page.html for inspection.');
    return;
  }

  console.log(`Found ${rows.length} plate listings on page-1\n`);
  rows.forEach((r, i) =>
    console.log(`${String(i + 1).padStart(2)}  ${r.plate.padEnd(8)} | ${r.price.padStart(10)} | views ${r.visits} | ${r.link}`)
  );
})();