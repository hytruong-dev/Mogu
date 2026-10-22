import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const laList = activeList.filter((a: any) => a.name.toLowerCase().includes('lá'));
console.log('Các loại lá trong Active DB:');
laList.forEach((l: any) => console.log(`- [${l.code}] "${l.name}"`));
