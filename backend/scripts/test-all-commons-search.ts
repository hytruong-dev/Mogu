import 'dotenv/config';

interface SearchTarget {
  code: string;
  name: string;
  query: string;
}

export const TARGETS: SearchTarget[] = [
  { code: 'banh-da-do-hai-phong-tuoi-tppoj', name: 'Bánh đa đỏ Hải Phòng tươi', query: 'Bánh đa đỏ' },
  { code: 'banh-quay-gion-dsr7f', name: 'Bánh quẩy giòn', query: 'Youtiao' },
  { code: 'banh-trang-me-nuong-njpz9', name: 'Bánh tráng mè nướng', query: 'Bánh đa' },
  { code: 'bi-heo-tron-thinh-gao-04aqb', name: 'Bì heo trộn thính gạo', query: 'Bì lợn' },
  { code: 'bot-gia-vi-bo-kho-iayya', name: 'Bột gia vị bò kho', query: 'Bò kho' },
  { code: 'bot-tom-chay-hue-ruoc-tom-8dwof', name: 'Bột tôm chấy Huế (Ruốc tôm)', query: 'Dried shrimp' },
  { code: 'bun-soi-to-bun-bo-hue-eueh4', name: 'Bún sợi to Bún Bò Huế', query: 'Bún bò Huế' },
  { code: 'cha-bo-da-nang-hkz0k', name: 'Chả bò Đà Nẵng', query: 'Chả bò' },
  { code: 'cha-bong-thit-heo-ruoc-fr1ql', name: 'Chà bông thịt heo (Ruốc)', query: 'Rousong' },
  { code: 'cha-ca-thu-chien-hap-6ki89', name: 'Chả cá thu chiên hấp', query: 'Chả cá' },
  { code: 'cha-com-ha-noi-0jqaq', name: 'Chả cốm Hà Nội', query: 'Chả cốm' },
  { code: 'cha-cua-hue-nxsuq', name: 'Chả cua Huế', query: 'Crab cake' },
  { code: 'cha-trung-hap-thit-viwuf', name: 'Chả trứng hấp thịt', query: 'Cơm tấm' },
  { code: 'chanh-tuoi-va-ot-hiem-ts23x', name: 'Chanh tươi và ớt hiểm', query: 'Lime and chili' },
  { code: 'chi-chuong-hai-phong-ot-chung-095en', name: 'Chí chương Hải Phòng (Ớt chưng)', query: 'Chili oil' },
  { code: 'com-trang-com-nguoi-s0hyk', name: 'Cơm trắng (Cơm nguội)', query: 'White rice bowl' },
  { code: 'cu-cai-muoi-kho-xa-bau-tq7as', name: 'Củ cải muối khô xá bấu', query: 'Preserved radish' },
  { code: 'cu-ngai-bun-tuoi-lmv3l', name: 'Củ ngải bún tươi', query: 'Boesenbergia rotunda' },
  { code: 'cu-san-tuoi-cu-dau-mmw68', name: 'Củ sắn tươi (Củ đậu)', query: 'Pachyrhizus erosus' },
  { code: 'dau-phong-rang-lac-rang-tx3n7', name: 'Đậu phộng rang (Lạc rang)', query: 'Fried groundnuts' },
  { code: 'dau-phu-ran-vang-h6kub', name: 'Đậu phụ rán vàng', query: 'Tahu digoreng' },
  { code: 'do-chua-ie01z', name: 'Đồ chua', query: 'Đồ chua' },
  { code: 'do-chua-ca-rot-cu-cai-jxacf', name: 'Đồ chua (Cà rốt & Củ cải)', query: 'Đồ chua' },
  { code: 'doi-sun-chien-mien-nam-o9mmm', name: 'Dồi sụn chiên miền Nam', query: 'Blood sausage' },
  { code: 'du-du-chua-ngam-gion-k9s9r', name: 'Đu đủ chua ngâm giòn', query: 'Pickled papaya' },
  { code: 'dua-leo-va-ca-chua-tuoi-yym2k', name: 'Dưa leo và cà chua tươi', query: 'Cucumber tomato salad' },
  { code: 'dui-ga-goc-tu-4kxf3', name: 'Đùi gà góc tư', query: 'Chicken leg quarter' },
  { code: 'gach-ghe-xao-dau-dieu-yremn', name: 'Gạch ghẹ xào dầu điều', query: 'Crab roe' },
  { code: 'gan-heo-tuoi-zones', name: 'Gan heo tươi', query: 'Pork liver' },
  { code: 'gao-tam-thom-iq9ex', name: 'Gạo tấm thơm', query: 'Broken rice' },
  { code: 'gia-vi-nau-an-tong-hop-m0pvq', name: 'Gia vị nấu ăn tổng hợp', query: 'Spices' },
  { code: 'gia-vi-uop-toi-gung-s18r6', name: 'Gia vị ướp tỏi gừng', query: 'Minced garlic' },
  { code: 'gio-lua-truyen-thong-bkhik', name: 'Giò lụa truyền thống', query: 'Giò lụa' },
  { code: 'gio-song-moc-66b6u', name: 'Giò sống (Mọc)', query: 'Pork paste' },
  { code: 'hanh-kho-hanh-cu-tim-4gybv', name: 'Hành khô (Hành củ tím)', query: 'Shallot bulbs' },
  { code: 'hanh-la-va-mui-tau-ngo-gai-x7vr7', name: 'Hành lá và mùi tàu (Ngò gai)', query: 'Culantro' },
  { code: 'hanh-la-va-ngo-ri-uxy0m', name: 'Hành lá và ngò rí', query: 'Coriander scallion' },
  { code: 'hanh-la-va-rau-mui-ngo-ri-k24wf', name: 'Hành lá và rau mùi (Ngò rí)', query: 'Coriander' },
  { code: 'hanh-la-va-rau-ram-tuoi-9pa00', name: 'Hành lá và rau răm tươi', query: 'Persicaria odorata' },
  { code: 'hanh-la-va-thi-la-tuoi-b4ffv', name: 'Hành lá và thì là tươi', query: 'Anethum graveolens' },
  { code: 'hanh-tim-phi-gion-yv2fj', name: 'Hành tím phi giòn', query: 'Bawang goreng' },
  { code: 'hanh-tim-va-gung-nuong-810f0', name: 'Hành tím và gừng nướng', query: 'Ginger root' },
  { code: 'hat-dieu-mau-hat-ca-ri-ca29m', name: 'Hạt điều màu (Hạt cà ri)', query: 'Annatto Seeds' },
  { code: 'hoa-hoi-va-que-thanh-h89rx', name: 'Hoa hồi và quế thanh', query: 'Star anise cinnamon' },
  { code: 'hu-tieu-dai-iksax', name: 'Hủ tiếu dai', query: 'Hủ tiếu' },
  { code: 'kho-muc-mini-nuong-nau-nuoc-dung-0c5iz', name: 'Khô mực mini nướng nấu nước dùng', query: 'Dried squid' },
  { code: 'khoanh-gio-heo-xh2jw', name: 'Khoanh giò heo', query: 'Pork shank' },
  { code: 'khuon-chen-sanh-lam-banh-beo-k22j1', name: 'Khuôn chén sành làm bánh bèo', query: 'Bánh bèo' },
  { code: 'la-dong-goi-banh-tuoi-wowmt', name: 'Lá dong gói bánh tươi', query: 'Phrynium' },
  { code: 'la-lot-va-tia-to-u7jym', name: 'lá lốt và tía tô', query: 'Piper sarmentosum' },
  { code: 'la-oi-banh-te-tuoi-6uu83', name: 'Lá ổi bánh tẻ tươi', query: 'Psidium guajava leaves' },
  { code: 'lap-xuong-mai-que-lo-eaogu', name: 'Lạp xưởng Mai Quế Lộ', query: 'Lap cheong' },
  { code: 'mi-trung-tuoi-soi-tron-2ji9y', name: 'Mì trứng tươi sợi tròn', query: 'Egg noodles' },
  { code: 'mo-ga-thang-yd9pe', name: 'Mỡ gà thắng', query: 'Schmaltz' },
  { code: 'mo-hanh-la-liv0t', name: 'Mỡ hành lá', query: 'Mỡ hành' },
  { code: 'muoi-ot-xanh-cham-hai-san-7dr3s', name: 'Muối ớt xanh chấm hải sản', query: 'Green chili sauce' },
  { code: 'nam-bao-ngu-xam-tuoi-4pf85', name: 'Nấm bào ngư xám tươi', query: 'Pleurotus ostreatus' },
  { code: 'nem-chua-cay-gu1vh', name: 'Nem chua cây', query: 'Nem chua' },
  { code: 'nem-ran-cha-gio-pqzw3', name: 'Nem rán (Chả giò)', query: 'Cha gio' },
  { code: 'nuoc-cham-nem-chua-ngot-25wxw', name: 'Nước chấm nem chua ngọt', query: 'Nước chấm' },
  { code: 'nuoc-cot-me-chua-wvk4w', name: 'Nước cốt me chua', query: 'Tamarind' },
  { code: 'nuoc-ham-xuong-u7jws', name: 'nước hầm xương', query: 'Bone broth' },
  { code: 'nuoc-ham-xuong-heo-lnoi9', name: 'Nước hầm xương heo', query: 'Bone broth' },
  { code: 'nuoc-luoc-ga-fgizi', name: 'Nước luộc gà', query: 'Chicken broth' },
  { code: 'nuoc-ma-long-me-ga-fmrpt', name: 'Nước mạ lòng mề gà', query: 'Giblets gravy' },
  { code: 'nuoc-sot-tron-iksef', name: 'Nước sốt trộn', query: 'Soy sauce dish' },
  { code: 'ot-chung-sa-te-6t7n3', name: 'Ớt chưng sa tế', query: 'Chili oil' },
  { code: 'pa-te-gan-heo-beo-gqbsj', name: 'Pa-tê gan heo béo', query: 'Pâté' },
  { code: 'pheo-non-heo-tuoi-long-non-0anzl', name: 'Phèo non heo tươi (Lòng non)', query: 'Chitterlings' },
  { code: 'phi-le-ca-ro-phi-tuoi-2xvne', name: 'Phi lê cá rô phi tươi', query: 'Tilapia fillet' },
  { code: 'que-thanh-cao-vo-aerwl', name: 'Quế thanh cạo vỏ', query: 'Cinnamomum' },
  { code: 'rau-an-lau-mam-thap-cam-keo-neo-rau-dang-dien-dien-bong-sung-ym62o', name: 'Rau ăn lẩu mắm thập cẩm (Kèo nèo, rau đắng, điên điển, bông súng)', query: 'Water spinach' },
  { code: 'rau-cai-xanh-cai-cay-zzvxf', name: 'Rau cải xanh (Cải cay)', query: 'Mustard greens' },
  { code: 'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf', name: 'Rau củ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)', query: 'Steamed vegetables' },
  { code: 'rau-kinh-gioi-va-rau-mui-01m1e', name: 'Rau kinh giới và rau mùi', query: 'Elsholtzia ciliata' },
  { code: 'rau-mam-cu-cai-trang-jecym', name: 'Rau mầm củ cải trắng', query: 'Radish sprouts' },
  { code: 'rau-song-idzyt', name: 'Rau sống', query: 'Rau sống' },
  { code: 'rau-song-an-kem-ulcnw', name: 'Rau sống ăn kèm', query: 'Rau sống' },
  { code: 'rau-song-chuoi-chat-khe-chua-mvyl3', name: 'Rau sống chuối chát khế chua', query: 'Rau sống' },
  { code: 'rau-song-hoa-chuoi-bup-non-o7chr', name: 'Rau sống hoa chuối búp non', query: 'Banana flower salad' },
  { code: 'rau-xa-lach-va-hung-lui-31xfb', name: 'Rau xà lách và húng lủi', query: 'Spearmint' },
  { code: 'ruot-banh-mi-xe-vun-xqcxg', name: 'Ruột bánh mì xé vụn', query: 'Bread crumbs' },
  { code: 'ruou-vang-do-nau-an-5yg6f', name: 'Rượu vang đỏ nấu ăn', query: 'Red wine glass' },
  { code: 'soi-banh-canh-bot-gao-4e1if', name: 'Sợi bánh canh bột gạo', query: 'Bánh canh' },
  { code: 'soi-banh-canh-bot-loc-mzaqg', name: 'Sợi bánh canh bột lọc', query: 'Bánh canh' },
  { code: 'soi-hu-tieu-my-tho-botuy', name: 'Sợi hủ tiếu Mỹ Tho', query: 'Hủ tiếu' },
  { code: 'soi-mi-cao-lau-tuoi-dulqb', name: 'Sợi mì Cao lầu tươi', query: 'Cao lầu' },
  { code: 'soi-mi-quang-vang-c5wl5', name: 'Sợi mì Quảng vàng', query: 'Mì Quảng' },
  { code: 'sot-tuong-den-cay-gb19u', name: 'Sốt tương đen cay', query: 'Hoisin sauce' },
  { code: 'sua-bien-tuoi-lam-sach-0r7x5', name: 'Sứa biển tươi làm sạch', query: 'Jellyfish food' },
  { code: 'suon-cot-let-heo-tuoi-mag0f', name: 'Sườn cốt lết heo tươi', query: 'Pork chops raw' },
  { code: 'than-chuoi-non-bao-mong-2xbkv', name: 'Thân chuối non bào mỏng', query: 'Banana blossom' },
  { code: 'thinh-gao-rang-min-w4wsm', name: 'Thính gạo rang mịn', query: 'Roasted rice powder' },
  { code: 'thit-ba-chi-heo-tuoi-5q9rd', name: 'Thịt ba chỉ heo tươi', query: 'Pork belly' },
  { code: 'thit-bo-kho-mieng-soi-tam-vi-xkvmb', name: 'Thịt bò khô miếng sợi tẩm vị', query: 'Bò khô' },
  { code: 'thit-ca-ngu-hoac-ca-co-yjkqn', name: 'Thịt cá ngừ (hoặc cá cờ)', query: 'Tuna steak raw' },
  { code: 'thit-cua-bien-tuoi-go-san-q6o2t', name: 'Thịt cua biển tươi gỡ sẵn', query: 'Crab meat cooked' },
  { code: 'thit-ghe-tuoi-boc-san-u9h5m', name: 'Thịt ghẹ tươi bóc sẵn', query: 'Crab meat' },
  { code: 'thit-hen-tuoi-luoc-san-g4pqa', name: 'Thịt hến tươi luộc sẵn', query: 'Baby clams cooked' },
  { code: 'thit-heo-quay-gion-bi-kop4s', name: 'Thịt heo quay giòn bì', query: 'Siu yuk' },
  { code: 'thit-ma-dau-heo-tah6a', name: 'Thịt má đầu heo', query: 'Pork jowl' },
  { code: 'thit-nac-vai-heo-ljwlc', name: 'Thịt nạc vai heo', query: 'Pork shoulder' },
  { code: 'thit-qua-gac-tuoi-zw33x', name: 'Thịt quả gấc tươi', query: 'Momordica cochinchinensis' },
  { code: 'thit-xa-xiu-ikscz', name: 'Thịt xá xíu', query: 'Charsiu' },
  { code: 'tinh-dau-ca-cuong-nguyen-chat-gwho4', name: 'Tinh dầu cà cuống nguyên chất', query: 'Lethocerus indicus' },
  { code: 'toi-phi-vang-thom-tzsln', name: 'Tỏi phi vàng thơm', query: 'Fried garlic' },
  { code: 'toi-tep-va-ot-hiem-d5sny', name: 'Tỏi tép và ớt hiểm', query: 'Garlic and chili' },
  { code: 'tom-dat-tuoi-bntj8', name: 'Tôm đất tươi', query: 'Raw shrimp' },
  { code: 'tuong-den-ie00c', name: 'Tương đen', query: 'Hoisin sauce' },
  { code: 'xuong-bay-heo-ham-nuoc-dung-573mj', name: 'Xương bay heo hầm nước dùng', query: 'Pork bones' },
  { code: 'xuong-ca-va-dau-ca-nau-nuoc-dung-ig6y8', name: 'Xương cá và đầu cá nấu nước dùng', query: 'Fish head' },
  { code: 'xuong-ong-heo-ham-canh-52nm8', name: 'Xương ống heo hầm canh', query: 'Marrow bones' },
];

async function searchCommons(query: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
    const json = await res.json() as any;
    const pages = json?.query?.pages;
    if (!pages) return null;
    const p = Object.values(pages)[0] as any;
    return p.imageinfo?.[0]?.thumburl || null;
  } catch {
    return null;
  }
}

async function testAll() {
  console.log(`Checking ${TARGETS.length} targets against Wikimedia Commons File namespace...`);
  let found = 0;
  const missing: string[] = [];

  for (const t of TARGETS) {
    const url = await searchCommons(t.query);
    if (url) {
      found++;
    } else {
      missing.push(`${t.name} (query: "${t.query}")`);
    }
  }

  console.log(`\nFound: ${found} / ${TARGETS.length}`);
  if (missing.length > 0) {
    console.log(`Missing (${missing.length}):`, missing);
  }
}

testAll();
