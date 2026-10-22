import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Mapping rules from raw dish ingredient to clean ingredient name and category
export interface ProvisionTarget {
  name: string;
  groupLabel: string;
  unit: string;
  allergenCode?: string;
  description?: string;
}

export function mapRawToTarget(rawText: string, parsedName?: string | null): ProvisionTarget {
  const raw = rawText.trim();
  const lower = raw.toLowerCase();

  // 1. Existing Pending exact or close matches
  if (/bột gia vị bò kho/i.test(lower)) {
    return { name: 'Bột gia vị bò kho', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/tương đen/i.test(lower) && !lower.includes('ớt')) {
    return { name: 'Tương đen', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/sốt tương đen và ớt/i.test(lower)) {
    return { name: 'Sốt tương đen cay', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/đồ chua/i.test(lower)) {
    return { name: 'Đồ chua (Cà rốt & Củ cải)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/rau sống/i.test(lower) && !lower.includes('búp chuối') && !lower.includes('chuối chát')) {
    return { name: 'Rau sống ăn kèm', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/hủ tiếu dai/i.test(lower)) {
    return { name: 'Hủ tiếu dai', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/thịt xá xíu|xá xíu/i.test(lower)) {
    return { name: 'Thịt xá xíu', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/nước sốt trộn/i.test(lower)) {
    return { name: 'Nước sốt trộn hủ tiếu', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/nước hầm xương|nước dùng xương heo/i.test(lower)) {
    return { name: 'Nước hầm xương heo', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/lá lốt và tía tô/i.test(lower)) {
    return { name: 'Lá lốt và tía tô', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }

  // 2. Specific ingredients
  if (/măng chua/i.test(lower)) {
    return { name: 'Măng chua', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/chả cốm/i.test(lower)) {
    return { name: 'Chả cốm Hà Nội', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/nem rán/i.test(lower)) {
    return { name: 'Nem rán (Chả giò)', groupLabel: 'Món ăn kèm', unit: 'cái' };
  }
  if (/đậu phụ rán|đậu hũ rán/i.test(lower)) {
    return { name: 'Đậu phụ rán vàng', groupLabel: 'Món ăn kèm', unit: 'g' };
  }
  if (/đậu phộng rang|lạc rang/i.test(lower)) {
    return { name: 'Đậu phộng rang (Lạc rang)', groupLabel: 'Các loại hạt & Đậu', unit: 'g', allergenCode: 'PEANUT' };
  }
  if (/ớt chưng cay kiểu hải phòng|chí chương/i.test(lower)) {
    return { name: 'Chí chương Hải Phòng (Ớt chưng)', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/ớt chưng/i.test(lower)) {
    return { name: 'Ớt chưng sa tế', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/rượu vang đỏ/i.test(lower)) {
    return { name: 'Rượu vang đỏ nấu ăn', groupLabel: 'Gia vị & Nước sốt', unit: 'ml', allergenCode: 'ALCOHOL' };
  }
  if (/quế và hoa hồi|quế hồi/i.test(lower)) {
    return { name: 'Hoa hồi và quế thanh', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/quế\s*(nhỏ|thanh)?/i.test(lower)) {
    return { name: 'Quế thanh cạo vỏ', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/thịt gấc/i.test(lower)) {
    return { name: 'Thịt quả gấc tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/mỡ gà/i.test(lower)) {
    return { name: 'Mỡ gà thắng', groupLabel: 'Dầu mỡ & Bơ', unit: 'ml' };
  }
  if (/hành tím phi|hành phi/i.test(lower)) {
    return { name: 'Hành tím phi giòn', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/chà bông|ruốc thịt/i.test(lower)) {
    return { name: 'Chà bông thịt heo (Ruốc)', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/giò sống/i.test(lower)) {
    return { name: 'Giò sống (Mọc)', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/bún sợi to huế/i.test(lower)) {
    return { name: 'Bún sợi to Bún Bò Huế', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/khoanh giò heo|giò heo/i.test(lower)) {
    return { name: 'Khoanh giò heo', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/chả cua huế|chả cua/i.test(lower)) {
    return { name: 'Chả cua Huế', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/hạt điều màu/i.test(lower)) {
    return { name: 'Hạt điều màu (Hạt cà ri)', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/sợi mì quảng/i.test(lower)) {
    return { name: 'Sợi mì Quảng vàng', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/bánh tráng mè nướng|bánh tráng nướng mè/i.test(lower)) {
    return { name: 'Bánh tráng mè nướng', groupLabel: 'Món ăn kèm', unit: 'cái', allergenCode: 'SESAME' };
  }
  if (/rau sống búp chuối/i.test(lower)) {
    return { name: 'Rau sống hoa chuối búp non', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/nước mạ lòng mề gà/i.test(lower)) {
    return { name: 'Nước mạ lòng mề gà', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/đu đủ chua ngâm/i.test(lower)) {
    return { name: 'Đu đủ chua ngâm giòn', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/sợi cao lầu/i.test(lower)) {
    return { name: 'Sợi mì Cao lầu tươi', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/thịt nạc vai heo|thịt nạc vai xay|thịt nạc vai/i.test(lower)) {
    return { name: 'Thịt nạc vai heo', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/tóp mỡ/i.test(lower)) {
    return { name: 'Tóp mỡ chiên giòn', groupLabel: 'Món ăn kèm', unit: 'g' };
  }
  if (/chả cá thu/i.test(lower)) {
    return { name: 'Chả cá thu chiên hấp', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'FISH' };
  }
  if (/sứa tươi|sứa biển/i.test(lower)) {
    return { name: 'Sứa biển tươi làm sạch', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SEAFOOD' };
  }
  if (/thịt cá cờ hoặc cá ngừ/i.test(lower)) {
    return { name: 'Thịt cá ngừ (hoặc cá cờ)', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'FISH' };
  }
  if (/tôm đất/i.test(lower)) {
    return { name: 'Tôm đất tươi', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/mỡ hành/i.test(lower)) {
    return { name: 'Mỡ hành lá', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/chén sành nhỏ/i.test(lower)) {
    // Note: chén sành is a utensil mentioned in Bánh bèo, but let's label it or skip
    return { name: 'Khuôn chén sành làm bánh bèo', groupLabel: 'Dụng cụ & Đóng gói', unit: 'cái' };
  }
  if (/gan heo/i.test(lower)) {
    return { name: 'Gan heo tươi', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/rau sống chuối chát khế chua/i.test(lower)) {
    return { name: 'Rau sống chuối chát khế chua', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/gạo tấm/i.test(lower)) {
    return { name: 'Gạo tấm thơm', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/sườn cốt lết/i.test(lower)) {
    return { name: 'Sườn cốt lết heo tươi', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/bì heo/i.test(lower)) {
    return { name: 'Bì heo trộn thính gạo', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/chả trứng/i.test(lower)) {
    return { name: 'Chả trứng hấp thịt', groupLabel: 'Thịt & Gia cầm', unit: 'g', allergenCode: 'EGG' };
  }
  if (/pa-tê/i.test(lower)) {
    return { name: 'Pa-tê gan heo béo', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/đùi gà/i.test(lower)) {
    return { name: 'Đùi gà góc tư', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/gia vị ướp tỏi gừng/i.test(lower)) {
    return { name: 'Gia vị ướp tỏi gừng', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/hủ tiếu mỹ tho/i.test(lower)) {
    return { name: 'Sợi hủ tiếu Mỹ Tho', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/xương ống heo/i.test(lower)) {
    return { name: 'Xương ống heo hầm canh', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/khô mực/i.test(lower)) {
    return { name: 'Khô mực mini nướng nấu nước dùng', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'MOLLUSK' };
  }
  if (/tỏi phi/i.test(lower)) {
    return { name: 'Tỏi phi vàng thơm', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/bánh canh bột lọc/i.test(lower)) {
    return { name: 'Sợi bánh canh bột lọc', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/thịt ghẹ/i.test(lower) || /ghẹ biển/i.test(lower)) {
    return { name: 'Thịt ghẹ tươi bóc sẵn', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/gạch ghẹ/i.test(lower)) {
    return { name: 'Gạch ghẹ xào dầu điều', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/muối tiêu chanh hoặc muối ớt xanh/i.test(lower)) {
    return { name: 'Muối ớt xanh chấm hải sản', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/rau cải xanh/i.test(lower)) {
    return { name: 'Rau cải xanh (Cải cay)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/mì trứng tươi/i.test(lower)) {
    return { name: 'Mì trứng tươi sợi tròn', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g', allergenCode: 'EGG' };
  }
  if (/hành khô/i.test(lower)) {
    return { name: 'Hành khô (Hành củ tím)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/xương bay heo|xương gà/i.test(lower)) {
    return { name: 'Xương bay heo hầm nước dùng', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/thịt ba chỉ/i.test(lower)) {
    return { name: 'Thịt ba chỉ heo tươi', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/giò lụa/i.test(lower)) {
    return { name: 'Giò lụa truyền thống', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/củ cải khô/i.test(lower)) {
    return { name: 'Củ cải muối khô xá bấu', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/hành tím nướng|gừng đập dập/i.test(lower)) {
    return { name: 'Hành tím và gừng nướng', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/hành lá và rau răm/i.test(lower)) {
    return { name: 'Hành lá và rau răm tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/hành lá và vài nhánh rau mùi/i.test(lower) || /hành lá và rau mùi/i.test(lower)) {
    return { name: 'Hành lá và rau mùi (Ngò rí)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/nước chấm chua ngọt/i.test(lower) || /nước mắm, 1 thìa canh đường/i.test(lower)) {
    return { name: 'Nước chấm nem chua ngọt', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/thịt bò khô/i.test(lower)) {
    return { name: 'Thịt bò khô miếng sợi tẩm vị', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/kinh giới và rau mùi/i.test(lower)) {
    return { name: 'Rau kinh giới và rau mùi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/phi lê cá rô/i.test(lower)) {
    return { name: 'Phi lê cá rô phi tươi', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'FISH' };
  }
  if (/quẩy giòn/i.test(lower)) {
    return { name: 'Bánh quẩy giòn', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'cái' };
  }
  if (/xương cá và đầu cá/i.test(lower)) {
    return { name: 'Xương cá và đầu cá nấu nước dùng', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'FISH' };
  }
  if (/nước me chua/i.test(lower)) {
    return { name: 'Nước cốt me chua', groupLabel: 'Gia vị & Nước sốt', unit: 'ml' };
  }
  if (/hành lá và thì là/i.test(lower)) {
    return { name: 'Hành lá và thì là tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/gia vị thông dụng/i.test(lower)) {
    return { name: 'Gia vị nấu ăn tổng hợp', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/bánh đa đỏ/i.test(lower)) {
    return { name: 'Bánh đa đỏ Hải Phòng tươi', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/hành lá và mùi tàu/i.test(lower)) {
    return { name: 'Hành lá và mùi tàu (Ngò gai)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/xì dầu/i.test(lower)) {
    return { name: 'Xì dầu (Nước tương đen)', groupLabel: 'Gia vị & Nước sốt', unit: 'ml', allergenCode: 'SOY' };
  }
  if (/cơm trắng nguội|cơm nguội/i.test(lower)) {
    return { name: 'Cơm trắng (Cơm nguội)', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/hến tươi/i.test(lower)) {
    return { name: 'Thịt hến tươi luộc sẵn', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'MOLLUSK' };
  }
  if (/thân cây chuối non/i.test(lower)) {
    return { name: 'Thân chuối non bào mỏng', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/bóng bì/i.test(lower)) {
    return { name: 'Bóng bì lợn chiên phồng', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/lá dong/i.test(lower)) {
    return { name: 'Lá dong gói bánh tươi', groupLabel: 'Rau củ & Quả', unit: 'lá' };
  }
  if (/bột tôm chấy/i.test(lower)) {
    return { name: 'Bột tôm chấy Huế (Ruốc tôm)', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/bánh canh bột gạo/i.test(lower)) {
    return { name: 'Sợi bánh canh bột gạo', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g' };
  }
  if (/hành lá và ngò rí/i.test(lower)) {
    return { name: 'Hành lá và ngò rí', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/thịt má heo|thịt đầu heo/i.test(lower)) {
    return { name: 'Thịt má đầu heo', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/thính gạo/i.test(lower)) {
    return { name: 'Thính gạo rang mịn', groupLabel: 'Gia vị & Nước sốt', unit: 'g' };
  }
  if (/lá ổi/i.test(lower)) {
    return { name: 'Lá ổi bánh tẻ tươi', groupLabel: 'Rau củ & Quả', unit: 'lá' };
  }
  if (/rau mầm/i.test(lower)) {
    return { name: 'Rau mầm củ cải trắng', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/tép tỏi và 1 quả ớt/i.test(lower) || /tỏi và ớt/i.test(lower)) {
    return { name: 'Tỏi tép và ớt hiểm', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/thịt heo quay/i.test(lower)) {
    return { name: 'Thịt heo quay giòn bì', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/chả bò đà nẵng|chả bò/i.test(lower)) {
    return { name: 'Chả bò Đà Nẵng', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/nem chua/i.test(lower)) {
    return { name: 'Nem chua cây', groupLabel: 'Thịt & Gia cầm', unit: 'cái' };
  }
  if (/xà lách và rau húng lủi/i.test(lower)) {
    return { name: 'Rau xà lách và húng lủi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/nấm bào ngư xám/i.test(lower)) {
    return { name: 'Nấm bào ngư xám tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/ngải bún/i.test(lower)) {
    return { name: 'Củ ngải bún tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/ớt hiểm và 1 miếng chanh/i.test(lower) || /chanh ớt/i.test(lower)) {
    return { name: 'Chanh tươi và ớt hiểm', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/thịt cua gỡ/i.test(lower) || /thịt cua/i.test(lower)) {
    return { name: 'Thịt cua biển tươi gỡ sẵn', groupLabel: 'Thủy hải sản', unit: 'g', allergenCode: 'SHELLFISH' };
  }
  if (/lạp xưởng/i.test(lower)) {
    return { name: 'Lạp xưởng Mai Quế Lộ', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/rau ăn lẩu mắm/i.test(lower) || /rau ăn kèm tổng hợp/i.test(lower)) {
    return { name: 'Rau ăn lẩu mắm thập cẩm (Kèo nèo, rau đắng, điên điển, bông súng)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/rau củ các loại|rau củ ăn kèm/i.test(lower)) {
    return { name: 'Rau củ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/củ sắn/i.test(lower)) {
    return { name: 'Củ sắn tươi (Củ đậu)', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/ruột bánh mì/i.test(lower)) {
    return { name: 'Ruột bánh mì xé vụn', groupLabel: 'Tinh bột & Ngũ cốc', unit: 'g', allergenCode: 'WHEAT' };
  }
  if (/phèo non/i.test(lower)) {
    return { name: 'Phèo non heo tươi (Lòng non)', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/dồi trường|dồi chiên/i.test(lower)) {
    return { name: 'Dồi sụn chiên miền Nam', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/dưa leo và cà chua/i.test(lower)) {
    return { name: 'Dưa leo và cà chua tươi', groupLabel: 'Rau củ & Quả', unit: 'g' };
  }
  if (/chả quế/i.test(lower)) {
    return { name: 'Chả quế nướng thơm', groupLabel: 'Thịt & Gia cầm', unit: 'g' };
  }
  if (/tinh dầu cà cuống/i.test(lower)) {
    return { name: 'Tinh dầu cà cuống nguyên chất', groupLabel: 'Gia vị & Nước sốt', unit: 'giọt' };
  }

  // Fallback
  return {
    name: parsedName || raw.replace(/^[\d.,/–—\s-]+\s*(g|kg|ml|l)?\s*/i, '').trim(),
    groupLabel: 'Khác',
    unit: 'g',
  };
}

