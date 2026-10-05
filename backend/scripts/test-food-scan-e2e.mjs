// Debug: end-to-end test of POST /v1/food-scan/recognize against local backend.
// Usage: node scripts/test-food-scan-e2e.mjs <imagePath>
import fs from 'node:fs';
import sharp from 'sharp';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/test-food-scan-e2e.mjs <imagePath>');
  process.exit(1);
}

const email = `foodscan.test.${Date.now()}@example.com`;
const password = 'FoodScan!123';

async function post(path, body, headers = {}) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

// 1) Register (or login) to get a token
let token;
const reg = await post('/auth/register', { email, password, username: `foodscan_${Date.now()}` });
console.log('register ->', reg.status);
const pickToken = (j) =>
  j?.data?.session?.accessToken ?? j?.session?.accessToken ?? j?.accessToken ?? j?.data?.accessToken;
token = pickToken(reg.json);
if (!token) {
  const login = await post('/auth/login', { identifier: email, password });
  console.log('login ->', login.status);
  token = pickToken(login.json);
}
if (!token) {
  console.error('No token. Register response:', JSON.stringify(reg.json).slice(0, 600));
  process.exit(1);
}

// 2) Convert input to JPEG <=1024px like the mobile app does
const jpeg = await sharp(fs.readFileSync(imagePath))
  .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 75 })
  .toBuffer();
console.log(`image: ${Math.round(jpeg.length / 1024)} KB jpeg`);

// 3) Multipart upload
const form = new FormData();
form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'food-scan.jpg');

const t0 = Date.now();
const r = await fetch(`${API}/food-scan/recognize`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const text = await r.text();
console.log(`recognize -> HTTP ${r.status} in ${Date.now() - t0} ms`);
try {
  const j = JSON.parse(text);
  console.log(JSON.stringify(j, null, 2).slice(0, 3000));
} catch {
  console.log(text.slice(0, 1500));
}
