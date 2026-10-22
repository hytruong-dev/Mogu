import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { TARGETS } from './test-all-commons-search';

async function searchCommonsDetails(query: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
    const json = await res.json() as any;
    const pages = json?.query?.pages;
    if (!pages) return null;
    const items = Object.values(pages).map((p: any) => ({
      title: p.title,
      thumb: p.imageinfo?.[0]?.thumburl,
      url: p.imageinfo?.[0]?.url,
    }));
    return items[0] || null;
  } catch {
    return null;
  }
}

async function run() {
  console.log(`Auditing titles for ${TARGETS.length} targets...`);
  const lines: string[] = [];

  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const match = await searchCommonsDetails(t.query);
    const line = `${i + 1}. [${t.code}] "${t.name}" (query: "${t.query}")\n   -> File: ${match?.title || 'NONE'}\n   -> URL: ${match?.thumb || match?.url || 'NONE'}`;
    lines.push(line);
    console.log(`${i + 1}. "${t.name}" -> ${match?.title || 'NONE'}`);
  }

  const outPath = path.join(__dirname, 'commons-search-results.txt');
  fs.writeFileSync(outPath, lines.join('\n\n'), 'utf-8');
  console.log(`Saved results to ${outPath}`);
}

run();
