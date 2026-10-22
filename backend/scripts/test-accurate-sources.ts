import 'dotenv/config';

async function searchCommonsFile(query: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mogu/1.0 (culinary-curator)' } });
    if (!res.ok) {
      console.log('Commons res not ok:', res.status);
      return null;
    }
    const json = await res.json() as any;
    const pages = json?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages) as any[]) {
      const info = p.imageinfo?.[0];
      if (info?.thumburl || info?.url) {
        return info.thumburl || info.url;
      }
    }
  } catch (e: any) {
    console.log('Commons catch:', e.message);
    return null;
  }
  return null;
}

async function searchUnsplashExact(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.log('No UNSPLASH_ACCESS_KEY found in process.env');
    return null;
  }
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok) {
      console.log('Unsplash res not ok:', res.status, await res.text());
      return null;
    }
    const json = await res.json() as any;
    return json?.results?.[0]?.urls?.small || null;
  } catch (e: any) {
    console.log('Unsplash catch:', e.message);
    return null;
  }
}

async function run() {
  const testList = [
    { name: 'Đậu phụ rán vàng', commons: 'Fried tofu', unsplash: 'fried tofu cubes' },
    { name: 'Đậu phộng rang (Lạc rang)', commons: 'Roasted peanuts', unsplash: 'roasted peanuts bowl' },
    { name: 'Thịt gấc tươi', commons: 'Momordica cochinchinensis fruit', unsplash: 'gac fruit' },
    { name: 'Chả cá thu chiên hấp', commons: 'Chả cá chiên', unsplash: 'asian fish cake' },
    { name: 'Bột tôm chấy Huế (Ruốc tôm)', commons: 'Dried shrimp floss', unsplash: 'shrimp floss' },
    { name: 'Sợi bánh canh bột gạo', commons: 'Bánh canh noodles', unsplash: 'rice udon thick noodles' },
    { name: 'Bánh đa đỏ Hải Phòng tươi', commons: 'Bánh đa đỏ', unsplash: 'red rice noodle' },
    { name: 'Hạt điều màu (Hạt cà ri)', commons: 'Bixa orellana seeds annatto', unsplash: 'annatto seeds' },
    { name: 'Củ ngải bún tươi', commons: 'Boesenbergia rotunda', unsplash: 'fingerroot' },
    { name: 'Thịt xá xíu', commons: 'Char siu pork', unsplash: 'char siu pork' },
    { name: 'Thịt ba chỉ heo tươi', commons: 'Raw pork belly meat', unsplash: 'raw pork belly' },
    { name: 'Thịt heo quay giòn bì', commons: 'Crispy roasted pork belly', unsplash: 'crispy pork belly roasted' },
    { name: 'Chả cốm Hà Nội', commons: 'Chả cốm', unsplash: 'vietnamese food pork' },
    { name: 'Nem rán (Chả giò)', commons: 'Chả giò chiên', unsplash: 'crispy fried spring rolls' },
    { name: 'Thịt cua biển tươi gỡ sẵn', commons: 'Crab meat cooked', unsplash: 'crab meat white' },
  ];

  for (const t of testList) {
    const cUrl = await searchCommonsFile(t.commons);
    const uUrl = await searchUnsplashExact(t.unsplash);
    console.log(`\nItem: ${t.name}`);
    console.log(`  Commons: ${cUrl || 'NONE'}`);
    console.log(`  Unsplash: ${uUrl || 'NONE'}`);
  }
}

run();
