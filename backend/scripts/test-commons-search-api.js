async function searchCommons(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (culinary-research)' } });
  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});
  return pages
    .filter(p => p.imageinfo && p.imageinfo[0])
    .map(p => ({
      title: p.title,
      url: p.imageinfo[0].thumburl || p.imageinfo[0].url,
      mime: p.imageinfo[0].mime,
      size: p.imageinfo[0].size,
    }))
    .filter(p => p.mime && p.mime.startsWith('image/') && !p.mime.includes('svg') && !p.mime.includes('pdf'));
}

async function run() {
  const testQueries = ['Chả lụa', 'Chả bò', 'Nem chua', 'Hủ tiếu', 'Cơm tấm', 'Lạp xưởng', 'Chà bông', 'Bột tôm'];
  for (const q of testQueries) {
    const results = await searchCommons(q);
    console.log(`\nQuery: "${q}" (${results.length} found):`);
    results.slice(0, 3).forEach(r => console.log(`  - ${r.title} -> ${r.url.slice(0, 80)}...`));
  }
}

run();
