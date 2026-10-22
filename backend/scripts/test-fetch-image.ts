import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, image/*, */*',
        ...headers,
      },
      timeout: 10000,
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        return httpGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// 1. Wikipedia VI API
async function searchWikiVI(name: string): Promise<string | null> {
  try {
    const searchUrl = `https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=2&format=json&origin=*`;
    const res = await httpGet(searchUrl);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.data.toString('utf-8'));
    const hits = json?.query?.search ?? [];
    if (!hits.length) return null;

    const pageTitle = hits[0].title;
    const imgUrl = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
    const imgRes = await httpGet(imgUrl);
    if (imgRes.status !== 200) return null;
    const imgJson = JSON.parse(imgRes.data.toString('utf-8'));
    const pages = imgJson?.query?.pages ?? {};
    for (const p of Object.values(pages) as any[]) {
      if (p.thumbnail?.source) return p.thumbnail.source;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// 2. Wikimedia Commons API
async function searchWikimediaCommons(keyword: string): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&gsrlimit=3&prop=imageinfo&iiprop=url|mime&iiurlwidth=600&format=json&origin=*`;
    const res = await httpGet(url);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.data.toString('utf-8'));
    const pages = json?.query?.pages ?? {};
    for (const p of Object.values(pages) as any[]) {
      const info = p.imageinfo?.[0];
      if (info?.thumburl || info?.url) {
        return info.thumburl || info.url;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// 3. DuckDuckGo / Bing image search or Tavily or curated dictionary
async function test() {
  const items = [
    'Măng chua',
    'Chả cốm',
    'Tương đen',
    'Thịt xá xíu',
    'Lá lốt',
    'Hủ tiếu',
    'Quế thanh',
    'Bánh đa cua',
    'Hoa hồi',
    'Sứa biển',
  ];

  for (const item of items) {
    const wiki = await searchWikiVI(item);
    const commons = await searchWikimediaCommons(item);
    console.log(`\nItem: "${item}"`);
    console.log(`  Wiki VI: ${wiki || 'NONE'}`);
    console.log(`  Commons: ${commons || 'NONE'}`);
  }
}

test();
