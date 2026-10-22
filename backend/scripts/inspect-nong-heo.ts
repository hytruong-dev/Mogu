import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

const nongHeo = activeList.find((a: any) => a.code === 'ING-3D9F30');
console.log('ING-3D9F30:', nongHeo);
