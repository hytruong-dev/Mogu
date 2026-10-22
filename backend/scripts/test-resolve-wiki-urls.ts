async function resolveWikimediaUrl(title: string): Promise<string | null> {
  const fileTitle = title.startsWith('File:') ? title : `File:${title}`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const p = Object.values(json.query.pages)[0] as any;
    return p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || null;
  } catch {
    return null;
  }
}

async function run() {
  const files = [
    'File:Bánh đa nướng.jpg',
    'File:Youtiao.jpg',
    'File:Nem chua.jpg',
    'File:Charsiu.jpg',
    'File:Annatto Seeds.jpg',
    'File:Chinesesausageunpackaged.jpg',
    'File:Hoisin sauce.jpg',
    'File:Phrynium pubinerve.jpg',
    'File:Piper sarmentosum.jpg',
    'File:Pork belly.jpg',
    'File:Siu yuk 01.jpg',
    'File:Fried garlic.jpg',
    'File:Fried shallots bawang goreng.JPG',
  ];

  for (const f of files) {
    const u = await resolveWikimediaUrl(f);
    console.log(f, '->', u ? 'OK' : 'FAIL', u?.slice(0, 70));
  }
}

run();
