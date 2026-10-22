const fs = require('fs');

async function testUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return { ok: false, status: res.status, err: 'HTTP ' + res.status };
    if (!ct.startsWith('image/')) return { ok: false, status: res.status, err: 'Not an image: ' + ct };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) return { ok: false, status: res.status, err: 'Too small: ' + buf.byteLength };
    return { ok: true, status: res.status, size: buf.byteLength, ct };
  } catch (e) {
    return { ok: false, status: 0, err: e.message };
  }
}

module.exports = { testUrl };
