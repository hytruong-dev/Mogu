async function checkWikiArticles(titles: string[]) {
  const url = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0' } });
  const json = await res.json() as any;
  const pages = json.query?.pages || {};
  for (const p of Object.values(pages) as any[]) {
    console.log(`- "${p.title}": ${p.thumbnail?.source ? 'FOUND -> ' + p.thumbnail.source.slice(0, 75) + '...' : 'NO IMAGE'}`);
  }
}

async function run() {
  const test1 = ['Giò lụa', 'Nem chua', 'Hủ tiếu', 'Bánh đa cua', 'Mì Quảng', 'Cao lầu', 'Cà cuống', 'Gấc', 'Lá lốt', 'Rau răm', 'Ngò gai', 'Thì là', 'Củ đậu', 'Bánh bèo', 'Bánh xèo', 'Tôm khô', 'Thịt lợn', 'Thịt bò', 'Thịt gà'];
  await checkWikiArticles(test1);
}

run();
