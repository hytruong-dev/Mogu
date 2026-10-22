import * as fs from 'fs';
import * as path from 'path';

const activeList = JSON.parse(fs.readFileSync(path.join(__dirname, 'active-ingredients-full.json'), 'utf8'));

// All 40 pending items:
const pendingList = [
  { code: 'bi-heo-tron-thinh-gao-04aqb', name: 'Bì heo trộn thính gạo', dishes: ['Cơm tấm sườn bì chả'] },
  { code: 'bot-gia-vi-bo-kho-iayya', name: 'Bột gia vị bò kho', dishes: ['Bò kho bánh mì'] },
  { code: 'bot-tom-chay-hue-ruoc-tom-8dwof', name: 'Bột tôm chấy Huế (Ruốc tôm)', dishes: ['Bánh ram ít Huế'] },
  { code: 'cha-bo-da-nang-hkz0k', name: 'Chả bò Đà Nẵng', dishes: ['Bún mắm nêm Đà Nẵng'] },
  { code: 'cha-ca-thu-chien-hap-6ki89', name: 'Chả cá thu chiên hấp', dishes: ['Bún chả cá Nha Trang', 'Bún cá cay Hải Phòng', 'Bánh canh ghẹ', 'Bún sứa Quy Nhơn'] },
  { code: 'cha-com-ha-noi-0jqaq', name: 'Chả cốm Hà Nội', dishes: ['Bún đậu mắm tôm'] },
  { code: 'cha-trung-hap-thit-viwuf', name: 'Chả trứng hấp thịt', dishes: ['Cơm tấm sườn bì chả'] },
  { code: 'chi-chuong-hai-phong-ot-chung-095en', name: 'Chí chương Hải Phòng (Ớt chưng)', dishes: ['Bún cá cay Hải Phòng'] },
  { code: 'cu-cai-muoi-kho-xa-bau-tq7as', name: 'Củ cải muối khô xá bấu', dishes: ['Bún thang Hà Nội'] },
  { code: 'cu-ngai-bun-tuoi-lmv3l', name: 'Củ ngải bún tươi', dishes: ['Bún mắm miền Tây'] },
  { code: 'dau-phu-ran-vang-h6kub', name: 'Đậu phụ rán vàng', dishes: ['Lẩu riêu cua bắp bò', 'Bún ốc Hà Nội', 'Bún riêu cua đồng'] },
  { code: 'do-chua-ie01z', name: 'Đồ chua', dishes: ['Gỏi cuốn tôm thịt', 'Bún mắm nêm Đà Nẵng'] },
  { code: 'doi-sun-chien-mien-nam-o9mmm', name: 'Dồi sụn chiên miền Nam', dishes: ['Cháo lòng miền Nam'] },
  { code: 'du-du-chua-ngam-gion-k9s9r', name: 'Đu đủ chua ngâm giòn', dishes: ['Cơm gà Hội An'] },
  { code: 'gan-heo-tuoi-zones', name: 'Gan heo tươi', dishes: ['Nem lụi nướng', 'Hủ tiếu Nam Vang', 'Cháo lòng miền Nam'] },
  { code: 'gio-song-moc-66b6u', name: 'Giò sống (Mọc)', dishes: ['Bún mọc sườn chua'] },
  { code: 'hu-tieu-dai-iksax', name: 'Hủ tiếu dai', dishes: ['Hủ tiếu Nam Vang'] },
  { code: 'la-dong-goi-banh-tuoi-wowmt', name: 'Lá dong gói bánh tươi', dishes: ['Bánh nậm Huế'] },
  { code: 'la-oi-banh-te-tuoi-6uu83', name: 'Lá ổi bánh tẻ tươi', dishes: ['Tré Bình Định'] },
  { code: 'lap-xuong-mai-que-lo-eaogu', name: 'Lạp xưởng Mai Quế Lộ', dishes: ['Cơm chiên Dương Châu'] },
  { code: 'mi-trung-tuoi-soi-tron-2ji9y', name: 'Mì trứng tươi sợi tròn', dishes: ['Mì xào hải sản'] },
  { code: 'mo-ga-thang-yd9pe', name: 'Mỡ gà thắng', dishes: ['Xôi xéo Hà Nội'] },
  { code: 'muoi-ot-xanh-cham-hai-san-7dr3s', name: 'Muối ớt xanh chấm hải sản', dishes: ['Bánh canh ghẹ'] },
  { code: 'nem-chua-cay-gu1vh', name: 'Nem chua cây', dishes: ['Bún mắm nêm Đà Nẵng'] },
  { code: 'nem-ran-cha-gio-pqzw3', name: 'Nem rán (Chả giò)', dishes: ['Bún đậu mắm tôm'] },
  { code: 'nuoc-ma-long-me-ga-fmrpt', name: 'Nước mạ lòng mề gà', dishes: ['Cơm gà Hội An'] },
  { code: 'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf', name: 'Rau củ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)', dishes: ['Cơm cháy kho quẹt'] },
  { code: 'ruou-vang-do-nau-an-5yg6f', name: 'Rượu vang đỏ nấu ăn', dishes: ['Bò sốt vang bánh mì'] },
  { code: 'soi-banh-canh-bot-loc-mzaqg', name: 'Sợi bánh canh bột lọc', dishes: ['Bánh canh ghẹ'] },
  { code: 'soi-hu-tieu-my-tho-botuy', name: 'Sợi hủ tiếu Mỹ Tho', dishes: ['Hủ tiếu Mỹ Tho'] },
  { code: 'soi-mi-cao-lau-tuoi-dulqb', name: 'Sợi mì Cao lầu tươi', dishes: ['Cao lầu Hội An'] },
  { code: 'soi-mi-quang-vang-c5wl5', name: 'Sợi mì Quảng vàng', dishes: ['Mì Quảng tôm thịt'] },
  { code: 'sot-tuong-den-cay-gb19u', name: 'Sốt tương đen cay', dishes: ['Bánh mì thịt nướng'] },
  { code: 'sua-bien-tuoi-lam-sach-0r7x5', name: 'Sứa biển tươi làm sạch', dishes: ['Bún chả cá Nha Trang', 'Bún sứa Quy Nhơn'] },
  { code: 'thinh-gao-rang-min-w4wsm', name: 'Thính gạo rang mịn', dishes: ['Tré Bình Định'] },
  { code: 'thit-bo-kho-mieng-soi-tam-vi-xkvmb', name: 'Thịt bò khô miếng sợi tẩm vị', dishes: ['Nộm bò khô Hà Nội'] },
  { code: 'thit-heo-quay-gion-bi-kop4s', name: 'Thịt heo quay giòn bì', dishes: ['Bún mắm miền Tây', 'Bún mắm nêm Đà Nẵng'] },
  { code: 'thit-ma-dau-heo-tah6a', name: 'Thịt má đầu heo', dishes: ['Tré Bình Định'] },
  { code: 'thit-xa-xiu-ikscz', name: 'Thịt xá xíu', dishes: ['Hủ tiếu Mỹ Tho', 'Hủ tiếu Nam Vang'] },
  { code: 'tinh-dau-ca-cuong-nguyen-chat-gwho4', name: 'Tinh dầu cà cuống nguyên chất', dishes: ['Bún thang Hà Nội', 'Bánh cuốn Thanh Trì'] },
];

console.log(`Kiểm tra toàn bộ 40 mục:\n`);
for (const p of pendingList) {
  console.log(`-----------------------------------------------`);
  console.log(`PENDING: [${p.code}] "${p.name}"`);
  console.log(`Dishes: ${p.dishes.join(', ')}`);
}
