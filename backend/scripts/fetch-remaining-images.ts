import * as fs from 'fs';
import * as path from 'path';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function testFetch() {
  const resp = await fetch(`https://www.bachhoaxanh.com/`, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const rawCookies = resp.headers.getSetCookie?.() || [];
  const cookieMap: Record<string, string> = {
    ck_bhx_us_is_new_flow: '1',
    ck_bhx_us_deviceId: 'mogu-' + Date.now(),
  };
  for (const c of rawCookies) {
    const parts = c.split(';')[0].split('=');
    if (parts[0] && parts[1]) cookieMap[parts[0].trim()] = parts[1].trim();
  }
  const cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');

  const queries = ['dau-ngu', 'hat-e', 'tau-hu-ky', 'ca-duoi', 'thit-nong', 'banh-trang-phoi-suong'];
  for (const q of queries) {
    const url = `https://api.bachhoaxanh.com/gw/Category/V2/GetCate?provinceId=1027&wardId=0&districtId=0&storeId=2546&categoryUrl=${q}&isMobile=true&isV2=true&pageSize=10`;
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          referer: 'https://www.bachhoaxanh.com/',
          cookie: cookieStr,
        },
      });
      console.log(`[${q}] status: ${res.status}`);
      if (res.ok) {
        const json = await res.json();
        const prods = json?.data?.products || [];
        console.log(` -> found ${prods.length} products:`, prods.slice(0, 2).map((p: any) => `${p.name} (${p.avatar})`));
      }
    } catch (e: any) {
      console.log(`[${q}] err: ${e.message}`);
    }
  }
}

testFetch();
