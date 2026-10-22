import 'dotenv/config';
import fs from 'fs';

const map = JSON.parse(fs.readFileSync('scripts/verified-sources-map.json', 'utf8'));
const pending = JSON.parse(fs.readFileSync('scripts/current-pending-ingredients.json', 'utf8'));

async function checkUrl(name: string, url: string): Promise<{ ok: boolean; status: number; size: number; ct: string; err?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return { ok: false, status: res.status, size: 0, ct, err: `HTTP ${res.status}` };
    if (!ct.startsWith('image/')) return { ok: false, status: res.status, size: 0, ct, err: `Not image: ${ct}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 3000) return { ok: false, status: res.status, size: buf.byteLength, ct, err: `Too small: ${buf.byteLength}` };
    return { ok: true, status: res.status, size: buf.byteLength, ct };
  } catch (e: any) {
    return { ok: false, status: 0, size: 0, ct: '', err: e.message };
  }
}

async function run() {
  const entries = Object.entries(map) as [string, string][];
  console.log(`Testing all ${entries.length} URLs...`);

  const passed: any[] = [];
  const failed: any[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [code, url] = entries[i];
    const p = pending.find((x: any) => x.code === code);
    const name = p ? p.name : code;
    const res = await checkUrl(name, url);
    if (res.ok) {
      passed.push({ code, name, url, size: res.size, ct: res.ct });
      console.log(`[PASS ${i + 1}/${entries.length}] "${name}" -> ${res.size} bytes (${res.ct})`);
    } else {
      failed.push({ code, name, url, err: res.err });
      console.log(`[FAIL ${i + 1}/${entries.length}] "${name}" -> ${res.err} (${url})`);
    }
  }

  console.log(`\n\n=== RESULTS ===`);
  console.log(`Passed: ${passed.length} / ${entries.length}`);
  console.log(`Failed: ${failed.length} / ${entries.length}`);

  fs.writeFileSync('scripts/download-audit-results.json', JSON.stringify({ passed, failed }, null, 2), 'utf-8');
}

run();
