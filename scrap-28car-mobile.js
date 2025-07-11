// scrape-28car-mobile.js
// Gets page-1 of private listings via the undocumented mobile feed
//  (≈20 items; much faster and no redirects)

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

(async () => {
  // 1 – hit the feed (type=1 → private, page=1)
  const { data: xml } = await axios.get(
    'https://m.28car.com/m_num_lst.php',       // NOTE: https & “m.” host
    { params: { type: 1, page: 1 }, timeout: 10000 }
  );

  // 2 – parse XML → JS
  const parser  = new XMLParser({ ignoreAttributes: false });
  const feed    = parser.parse(xml);

  if (!feed?.items?.item) {
    console.error('Feed returned no items. The endpoint may be down.');
    process.exit(1);
  }

  const list = Array.isArray(feed.items.item)
    ? feed.items.item
    : [feed.items.item];

  // 3 – print the essentials
  console.log(`Found ${list.length} listings on page-1 (mobile feed)\n`);
  list.forEach((it, i) => {
    console.log(
      `${i + 1}. [${it.@id}] ${it.title} | ${it.price}\n` +
      `    Thumb: ${it.img}\n` +
      `    Detail: https://www.28car.com/sell_dsp.php?h_vid=${it.@id}&h_vw=y`
    );
  });
})();