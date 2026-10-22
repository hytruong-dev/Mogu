async function testCommons(query: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (culinary-assistant; contact@mogu.vn)' } });
  const json = await res.json() as any;
  const pages = json?.query?.pages;
  if (!pages) return null;
  for (const p of Object.values(pages) as any[]) {
    const info = p.imageinfo?.[0];
    if (info?.thumburl || info?.url) {
      return { title: p.title, url: info.thumburl || info.url };
    }
  }
  return null;
}

async function run() {
  const queries = [
    'Fried tofu',
    'Chả lụa',
    'Chả giò',
    'Nem chua',
    'Char siu',
    'Lap cheong',
    'Youtiao',
    'Cinnamomum',
    'Illicium verum',
    'Hoisin sauce',
    'Phrynium',
    'Momordica cochinchinensis',
    'Annatto seeds',
    'Bixa orellana',
    'Piper sarmentosum',
    'Bánh xèo'
  ];

  for (const q of queries) {
    const r = await testCommons(q);
    console.log(`Query "${q}":`, r?.title, '->', r?.url ? 'FOUND' : 'NOT FOUND');
  }
}

run();
