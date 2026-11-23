import * as fs from 'fs';
import * as path from 'path';

const allPath = path.join(__dirname, 'missing-37-dish-prompts.json');
const all = JSON.parse(fs.readFileSync(allPath, 'utf8'));

const brainDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';
const files = fs.readdirSync(brainDir);

const remaining = all.filter((item: any) => !files.some((f: string) => f.startsWith(item.prefix)));

console.log(`Số món còn thiếu ảnh: ${remaining.length}`);
remaining.forEach((r: any, idx: number) => {
  console.log(`${idx + 1}. [${r.id}] ${r.name} (${r.prefix})`);
});

const outPath = path.join(__dirname, 'missing-10-dish-prompts.json');
fs.writeFileSync(outPath, JSON.stringify(remaining, null, 2), 'utf8');
console.log(`Đã lưu danh sách 10 món vào ${outPath}`);
