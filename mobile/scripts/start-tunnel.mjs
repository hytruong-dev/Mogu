import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(mobileDir, '.env.local');

// Tìm file thực thi cloudflared
const candidates = [
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
  `${process.env.LOCALAPPDATA || ''}\\Microsoft\\WinGet\\Links\\cloudflared.exe`,
  'cloudflared',
];

let cloudflaredBin = null;
for (const cand of candidates) {
  if (cand !== 'cloudflared' && fs.existsSync(cand)) {
    cloudflaredBin = cand;
    break;
  }
}
if (!cloudflaredBin) {
  cloudflaredBin = 'cloudflared';
}

console.log('🚀 Đang mở Cloudflare Tunnel cho Backend (port 3001)...');

const cf = spawn(cloudflaredBin, ['tunnel', '--url', 'http://localhost:3001'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let originalEnvLocal = 'EXPO_PUBLIC_API_URL=http://172.28.0.166:3001/v1\nEXPO_PUBLIC_SUPABASE_URL=https://lkqvyvllmrbxgaoqrkhd.supabase.co\n';
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  if (!content.includes('trycloudflare.com')) {
    originalEnvLocal = content;
  }
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    fs.writeFileSync(envLocalPath, originalEnvLocal, 'utf8');
    console.log('\n🔄 Đã khôi phục mobile/.env.local về IP mạng nội bộ.');
  } catch {}
  try {
    if (cf && cf.pid) {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${cf.pid} /T /F`, { stdio: 'ignore' });
      } else {
        cf.kill();
      }
    }
  } catch {}
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', () => {
  cleanup();
});

let tunnelFound = false;

function handleOutput(data) {
  const text = data.toString();
  const match = text.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
  if (match && !tunnelFound) {
    tunnelFound = true;
    const tunnelUrl = match[0];
    const apiUrl = `${tunnelUrl}/v1`;

    console.log(`\n================================================================`);
    console.log(`✅ Backend Cloudflare Tunnel: ${tunnelUrl}`);
    console.log(`🌐 Tự động cấu hình EXPO_PUBLIC_API_URL: ${apiUrl}`);
    console.log(`================================================================\n`);

    // Ghi vào .env.local
    const newEnv = `EXPO_PUBLIC_API_URL=${apiUrl}\nEXPO_PUBLIC_SUPABASE_URL=https://lkqvyvllmrbxgaoqrkhd.supabase.co\n`;
    fs.writeFileSync(envLocalPath, newEnv, 'utf8');

    // Chạy expo start --go --tunnel
    console.log('📱 Khởi động Expo Metro Bundler (Tunnel + Expo Go)...\n');
    const isWindows = process.platform === 'win32';
    const expoCommand = isWindows
      ? 'npx.cmd expo start --go --tunnel'
      : 'npx expo start --go --tunnel';
    const expoProcess = spawn(expoCommand, {
      cwd: mobileDir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        EXPO_PUBLIC_API_URL: apiUrl,
      },
    });

    expoProcess.on('exit', (code) => {
      cleanup();
      process.exit(code ?? 0);
    });
  }
}

cf.stdout.on('data', handleOutput);
cf.stderr.on('data', handleOutput);

cf.on('error', (err) => {
  console.error('❌ Lỗi khởi động cloudflared:', err.message);
  cleanup();
  process.exit(1);
});
