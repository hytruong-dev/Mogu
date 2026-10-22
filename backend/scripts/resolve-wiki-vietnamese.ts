import 'dotenv/config';
import fs from 'fs';

const pending = JSON.parse(fs.readFileSync('scripts/current-pending-ingredients.json', 'utf8'));

// Map pending item names to Wikipedia Vietnamese article titles
const titleMap: Record<string, string> = {
  'banh-da-do-hai-phong-tuoi-tppoj': 'Bánh đa cua',
  'banh-quay-gion-dsr7f': 'Quẩy',
  'banh-trang-me-nuong-njpz9': 'Bánh tráng',
  'bi-heo-tron-thinh-gao-04aqb': 'Cơm tấm',
  'bot-gia-vi-bo-kho-iayya': 'Bò kho',
  'bot-tom-chay-hue-ruoc-tom-8dwof': 'Tôm khô',
  'bun-soi-to-bun-bo-hue-eueh4': 'Bún bò Huế',
  'cha-bo-da-nang-hkz0k': 'Giò lụa',
  'cha-bong-thit-heo-ruoc-fr1ql': 'Ruốc',
  'cha-ca-thu-chien-hap-6ki89': 'Chả cá',
  'cha-com-ha-noi-0jqaq': 'Bún đậu mắm tôm',
  'cha-cua-hue-nxsuq': 'Bún bò Huế',
  'cha-trung-hap-thit-viwuf': 'Cơm tấm',
  'chanh-tuoi-va-ot-hiem-ts23x': 'Chanh',
  'chi-chuong-hai-phong-ot-chung-095en': 'Ớt chưng',
  'com-trang-com-nguoi-s0hyk': 'Cơm',
  'cu-cai-muoi-kho-xa-bau-tq7as': 'Củ cải trắng',
  'cu-ngai-bun-tuoi-lmv3l': 'Ngải bún',
  'cu-san-tuoi-cu-dau-mmw68': 'Củ đậu',
  'dau-phong-rang-lac-rang-tx3n7': 'Lạc (thực vật)',
  'dau-phu-ran-vang-h6kub': 'Đậu phụ',
  'do-chua-ie01z': 'Đồ chua',
  'do-chua-ca-rot-cu-cai-jxacf': 'Đồ chua',
  'doi-sun-chien-mien-nam-o9mmm': 'Dồi',
  'du-du-chua-ngam-gion-k9s9r': 'Bún chả',
  'dua-leo-va-ca-chua-tuoi-yym2k': 'Dưa chuột',
  'dui-ga-goc-tu-4kxf3': 'Thịt gà',
  'gach-ghe-xao-dau-dieu-yremn': 'Dầu điều',
  'gan-heo-tuoi-zones': 'Gan (nội tạng)',
  'gao-tam-thom-iq9ex': 'Cơm tấm',
  'gia-vi-nau-an-tong-hop-m0pvq': 'Gia vị',
  'gia-vi-uop-toi-gung-s18r6': 'Gia vị',
  'gio-lua-truyen-thong-bkhik': 'Giò lụa',
  'gio-song-moc-66b6u': 'Mọc',
  'hanh-kho-hanh-cu-tim-4gybv': 'Hành tím',
  'hanh-la-va-mui-tau-ngo-gai-x7vr7': 'Mùi tàu',
  'hanh-la-va-ngo-ri-uxy0m': 'Hành lá',
  'hanh-la-va-rau-mui-ngo-ri-k24wf': 'Hành lá',
  'hanh-la-va-rau-ram-tuoi-9pa00': 'Rau răm',
  'hanh-la-va-thi-la-tuoi-b4ffv': 'Thì là',
  'hanh-tim-phi-gion-yv2fj': 'Hành phi',
  'hanh-tim-va-gung-nuong-810f0': 'Gừng',
  'hat-dieu-mau-hat-ca-ri-ca29m': 'Điều nhuộm',
  'hoa-hoi-va-que-thanh-h89rx': 'Đại hồi',
  'hu-tieu-dai-iksax': 'Hủ tiếu',
  'kho-muc-mini-nuong-nau-nuoc-dung-0c5iz': 'Mực khô',
  'khoanh-gio-heo-xh2jw': 'Chân giò',
  'khuon-chen-sanh-lam-banh-beo-k22j1': 'Bánh bèo',
  'la-dong-goi-banh-tuoi-wowmt': 'Lá dong',
  'la-lot-va-tia-to-u7jym': 'Lá lốt',
  'la-oi-banh-te-tuoi-6uu83': 'Ổi',
  'lap-xuong-mai-que-lo-eaogu': 'Lạp xưởng',
  'mi-trung-tuoi-soi-tron-2ji9y': 'Mì sợi',
  'mo-ga-thang-yd9pe': 'Mỡ (thực phẩm)',
  'mo-hanh-la-liv0t': 'Mỡ hành',
  'muoi-ot-xanh-cham-hai-san-7dr3s': 'Muối ớt',
  'nam-bao-ngu-xam-tuoi-4pf85': 'Nấm sò',
  'nem-chua-cay-gu1vh': 'Nem chua',
  'nem-ran-cha-gio-pqzw3': 'Chả giò',
  'nuoc-cham-nem-chua-ngot-25wxw': 'Nước chấm',
  'nuoc-cot-me-chua-wvk4w': 'Me (thực vật)',
  'nuoc-ham-xuong-u7jws': 'Nước dùng',
  'nuoc-ham-xuong-heo-lnoi9': 'Nước dùng',
  'nuoc-luoc-ga-fgizi': 'Nước dùng',
  'nuoc-ma-long-me-ga-fmrpt': 'Cơm gà Hội An',
  'nuoc-sot-tron-iksef': 'Tương đen',
  'ot-chung-sa-te-6t7n3': 'Sa tế',
  'pa-te-gan-heo-beo-gqbsj': 'Pâté',
  'pheo-non-heo-tuoi-long-non-0anzl': 'Lòng lợn',
  'phi-le-ca-ro-phi-tuoi-2xvne': 'Cá rô phi',
  'que-thanh-cao-vo-aerwl': 'Quế',
  'rau-an-lau-mam-thap-cam-keo-neo-rau-dang-dien-dien-bong-sung-ym62o': 'Lẩu mắm',
  'rau-cai-xanh-cai-cay-zzvxf': 'Cải xanh',
  'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf': 'Kho quẹt',
  'rau-kinh-gioi-va-rau-mui-01m1e': 'Kinh giới',
  'rau-mam-cu-cai-trang-jecym': 'Rau mầm',
  'rau-song-idzyt': 'Rau sống',
  'rau-song-an-kem-ulcnw': 'Rau sống',
  'rau-song-chuoi-chat-khe-chua-mvyl3': 'Khế',
  'rau-song-hoa-chuoi-bup-non-o7chr': 'Nộm hoa chuối',
  'rau-xa-lach-va-hung-lui-31xfb': 'Rau xà lách',
  'ruot-banh-mi-xe-vun-xqcxg': 'Bánh mì',
  'ruou-vang-do-nau-an-5yg6f': 'Rượu vang đỏ',
  'soi-banh-canh-bot-gao-4e1if': 'Bánh canh',
  'soi-banh-canh-bot-loc-mzaqg': 'Bánh canh',
  'soi-hu-tieu-my-tho-botuy': 'Hủ tiếu Mỹ Tho',
  'soi-mi-cao-lau-tuoi-dulqb': 'Cao lầu',
  'soi-mi-quang-vang-c5wl5': 'Mì Quảng',
  'sot-tuong-den-cay-gb19u': 'Tương đen',
  'sua-bien-tuoi-lam-sach-0r7x5': 'Sứa biển',
  'suon-cot-let-heo-tuoi-mag0f': 'Thịt lợn',
  'than-chuoi-non-bao-mong-2xbkv': 'Nộm hoa chuối',
  'thinh-gao-rang-min-w4wsm': 'Thính gạo',
  'thit-ba-chi-heo-tuoi-5q9rd': 'Thịt ba chỉ',
  'thit-bo-kho-mieng-soi-tam-vi-xkvmb': 'Thịt bò khô',
  'thit-ca-ngu-hoac-ca-co-yjkqn': 'Cá ngừ',
  'thit-cua-bien-tuoi-go-san-q6o2t': 'Cua biển',
  'thit-ghe-tuoi-boc-san-u9h5m': 'Ghẹ',
  'thit-hen-tuoi-luoc-san-g4pqa': 'Hến',
  'thit-heo-quay-gion-bi-kop4s': 'Thịt heo quay',
  'thit-ma-dau-heo-tah6a': 'Thịt lợn',
  'thit-nac-vai-heo-ljwlc': 'Thịt lợn',
  'thit-qua-gac-tuoi-zw33x': 'Gấc',
  'thit-xa-xiu-ikscz': 'Xá xíu',
  'tinh-dau-ca-cuong-nguyen-chat-gwho4': 'Cà cuống',
  'toi-phi-vang-thom-tzsln': 'Hành phi',
  'toi-tep-va-ot-hiem-d5sny': 'Tỏi',
  'tom-dat-tuoi-bntj8': 'Tôm',
  'tuong-den-ie00c': 'Tương đen',
  'xuong-bay-heo-ham-nuoc-dung-573mj': 'Nước dùng',
  'xuong-ca-va-dau-ca-nau-nuoc-dung-ig6y8': 'Chả cá',
  'xuong-ong-heo-ham-canh-52nm8': 'Nước dùng',
};

async function queryWikiBatch(titles: string[]): Promise<Record<string, string>> {
  const url = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (culinary-research)' } });
  const data = await res.json() as any;
  const map: Record<string, string> = {};
  for (const p of Object.values(data.query?.pages || {}) as any[]) {
    if (p.thumbnail?.source) {
      map[p.title] = p.thumbnail.source;
    }
  }
  return map;
}

async function run() {
  const allTitles = Array.from(new Set(Object.values(titleMap)));
  console.log(`Unique Wikipedia titles to query: ${allTitles.length}`);

  const resultMap: Record<string, string> = {};
  for (let i = 0; i < allTitles.length; i += 20) {
    const chunk = allTitles.slice(i, i + 20);
    const chunkResults = await queryWikiBatch(chunk);
    Object.assign(resultMap, chunkResults);
  }

  console.log(`Resolved ${Object.keys(resultMap).length} / ${allTitles.length} titles with images.`);

  const codeToImage: Record<string, string> = {};
  for (const [code, title] of Object.entries(titleMap)) {
    if (resultMap[title]) {
      codeToImage[code] = resultMap[title];
    }
  }

  console.log(`Mapped ${Object.keys(codeToImage).length} / ${pending.length} pending ingredients to Wiki images.`);
  fs.writeFileSync('scripts/wiki-resolved-images.json', JSON.stringify({ codeToImage, titleMap, resultMap }, null, 2), 'utf-8');
}

run();
