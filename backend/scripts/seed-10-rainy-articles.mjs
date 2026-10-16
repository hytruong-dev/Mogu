import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const RAIN_ARTICLES = [
  {
    slug: 'lau-ga-la-e-phu-yen-ngay-mua',
    title: 'Lẩu gà lá é Phú Yên: Nồi lẩu the cay sưởi ấm chiều mưa rả rích',
    summary: 'Vị cay the nồng của lá é giã dập quyện cùng thịt gà đồi ngọt chắc và ớt xiêm xanh – món lẩu ấm bụng trứ danh của xứ sở hoa vàng cỏ xanh.',
    coverImageUrl: 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 6,
    viewCount: 1240,
    likeCount: 185,
    commentCount: 24,
    tags: ['món ngon mùa mưa', 'lẩu gà', 'lá é', 'ẩm thực miền Trung', 'ấm bụng'],
    content: `Khi những cơn mưa rào bất chợt kéo đến làm không khí se lạnh, không gì tuyệt vời hơn cảm giác ngồi quây quần quanh nồi lẩu gà lá é bốc khói nghi ngút, hít hà làn khói thơm the the lan tỏa trong từng góc nhỏ.

## 1. Nét quyến rũ khó cưỡng của lá é và ớt xiêm rừng

Lá é là một phân loài thuộc họ húng quế, có mùi tinh dầu cay thơm nhẹ thoang thoảng mùi sả và chanh. Khi thả vào nồi nước dùng gà đang sôi sùng sục, lá é lập tức tiết ra vị thơm the thanh khiết, làm dịu đi vị béo của thịt gà và làm ấm khoang họng ngay ngụm nước đầu tiên.

Đi cùng lá é bắt buộc phải là ớt xiêm xanh (ớt hiểm rừng) để nguyên trái hoặc giã dập nhẹ. Vị cay của ớt xiêm không nồng gắt mà cay dịu, ấm lâu, kích thích tuyến mồ hôi giúp cơ thể nhẹ nhõm sau khi đi mưa về.

## 2. Bí quyết chọn thịt và nấu nước dùng ngọt tự nhiên

- **Chọn gà:** Ngon nhất là gà thả vườn hoặc gà tre miền Trung, thịt chắc, da giòn, khi hầm không bị nát hay bở.
- **Nấu nước dùng:** Hầm xương gà cùng củ cải trắng và măng chua giòn từ 35-45 phút để lấy vị ngọt thanh.
- **Canh lửa:** Khi ăn mới thả lá é sống vào nước sôi 5–10 giây rồi vớt ăn ngay để giữ trọn màu xanh non mướt và độ giòn thơm, tránh đun quá lâu làm đắng nước.

## 3. Thưởng thức chuẩn vị người sành ăn

Ăn lẩu gà lá é nhất định phải chấm cùng muối hạt rang khô giã nhuyễn với ớt xiêm xanh và vắt thêm chút tắc. Thả ít bún tươi vào chén, chan muỗng nước dùng the ngọt, cắn miếng thịt gà dai giòn sần sật – cái lạnh ngày mưa dường như tan biến hoàn toàn.`,
  },
  {
    slug: 'chao-suon-sun-nong-hoi-ngay-mua',
    title: 'Cháo sườn sụn nóng hổi: Món ăn vỗ về chiếc bụng đói ngày mưa gió',
    summary: 'Hạt gạo sánh mịn như nhung, sườn sụn non ninh mềm giòn sần sật, phủ thêm tiêu sọ cay nồng và quẩy giòn tan – món ăn đường phố ấm lòng bậc nhất.',
    coverImageUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    viewCount: 980,
    likeCount: 142,
    commentCount: 18,
    tags: ['cháo sườn', 'món ấm ngày mưa', 'hà nội', 'ăn vặt', 'ấm lòng'],
    content: `Trời mưa xối xả bên ngoài cửa sổ, được bưng trên tay bát cháo sườn sụn nóng bỏng tay, rắc thêm chút hành hoa, ớt bột và hạt tiêu xay thơm nức mũi là trải nghiệm ẩm thực khiến bất kỳ ai cũng phải xiêu lòng.

## 1. Kết cấu cháo bột sánh mịn đặc trưng

Khác với cháo hoa nấu nguyên hạt, cháo sườn sụn đúng điệu được nấu từ bột gạo tẻ xay mịn kết hợp một phần nhỏ bột gạo nếp để tạo độ sánh dẻo tự nhiên. Khi quấy trên nồi gang lửa nhỏ, từng thìa cháo sánh mượt như lụa, không bị tách nước hay khê đáy nồi.

## 2. Phần sườn sụn non ninh mềm vừa tới

- Sườn được chọn phải là phần sụn sườn non trắng mềm, nhiều nạc xen chút gân mỡ béo thơm.
- Trần sườn qua nước sôi gừng rồi ninh nhỏ lửa 1 giờ để sụn mềm dẻo nhưng vẫn giữ được độ sần sật đặc trưng khi nhai.
- Nước ninh sườn chính là cốt ngọt tự nhiên để hòa cùng bột gạo khuấy cháo.

## 3. Topping ăn kèm không thể thiếu

Một tô cháo sườn hoàn chỉnh ngày mưa phải có:
1. Ruốc thịt (chà bông) sao vàng tơi xốp, đậm vị mặn ngọt.
2. Vài chiếc quẩy giòn vừa rán xong, cắt khúc thả ngập vào lòng bát cháo.
3. Rắc hào phóng tiêu sọ cay nồng và một chút ớt bột để cơ thể ấm sực từ trong ra ngoài.`,
  },
  {
    slug: 'ca-kho-tieu-to-dat-dua-com-ngay-mua',
    title: 'Cá kho tiêu tộ đất: Món cơm đưa miệng số một trong những ngày mưa',
    summary: 'Từng thớ cá săn chắc, nước sốt kho kẹo màu cánh gián thơm nồng vị tiêu sọ và ớt hiểm, ăn cùng cơm trắng nóng hổi khiến nồi cơm cạn đáy lúc nào không hay.',
    coverImageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 6,
    viewCount: 1450,
    likeCount: 210,
    commentCount: 31,
    tags: ['cá kho tiêu', 'cơm nhà', 'mùa mưa', 'món ngon mỗi ngày', 'ẩm thực Việt'],
    content: `Tiếng mưa rơi lộp độp trên mái tôn kết hợp với mùi cá kho tiêu bốc khói ngào ngạt từ gian bếp nhỏ luôn là hình ảnh thân thương gợi nhắc về bữa cơm gia đình đầm ấm của mỗi người con đất Việt.

## 1. Nồi đất – linh hồn của món kho truyền thống

Nồi đất giữ nhiệt sâu và truyền nhiệt đều, giúp nước sốt ngấm từ từ vào tận xương cá mà không làm vỡ thớ thịt. Thịt cá sau 2 lần lửa sẽ săn chắc, dẻo quánh và đượm vị mặn ngọt hài hòa.

## 2. Bí quyết ướp cá không tanh và màu cánh gián óng ả

- **Thắng nước màu:** Dùng đường thốt nốt hoặc đường mía thắng lửa nhỏ đến khi chuyển màu nâu cánh gián hổ phách, nhanh tay phi thơm hành tỏi tím và tóp mỡ giòn.
- **Ướp gia vị:** Ướp cá với nước mắm ngon nguyên chất, tiêu đen giã dập, ớt hiểm đỏ, xíu đường và nước cốt gừng tối thiểu 30 phút trước khi bắc lên bếp.
- **Kho hai lửa:** Lửa một đun sôi bùng cho săn cá, lửa hai hạ liu riu đến khi nước kho sền sệt kẹo lại bao quanh từng khúc cá.

## 3. Mâm cơm mưa bão hoàn hảo

Bữa cơm chiều mưa chỉ cần:
- Một âu cơm gạo mới nóng hổi hạt dẻo thơm.
- Đĩa rau lang hoặc cải thìa luộc xanh mướt chấm ngập nước cá kho tiêu.
- Thêm chén canh cải nấu gừng thanh ruột là đủ trọn vẹn phong vị mùa mưa.`,
  },
  {
    slug: 'bo-kho-banh-mi-dam-da-ngay-mua',
    title: 'Bò kho bánh mì: Đậm đà nước sốt quế hồi sưởi ấm những ngày mưa dầm',
    summary: 'Nạm bò mềm thơm béo ngậy, cà rốt ngọt bùi quyện trong nước sốt sánh mịn đậm hương sả quế hồi, chấm cùng bánh mì nướng giòn rụm.',
    coverImageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    viewCount: 1120,
    likeCount: 168,
    commentCount: 19,
    tags: ['bò kho', 'bánh mì', 'món nước', 'mùa mưa', 'ấm áp'],
    content: `Bò kho là món ăn kỳ diệu kết hợp giữa kỹ thuật hầm kiểu Tây và hương vị thảo mộc phương Đông. Vào những ngày mưa dầm gió bấc, hương thơm ấm nồng của quế chi, hoa hồi và sả tươi từ nồi bò kho sẽ xua tan mọi mỏi mệt.

## 1. Chọn phần thịt nạm gân bò lý tưởng

Phần thịt hoàn hảo nhất cho món bò kho là nạm gân hoặc bắp bò hoa. Lớp gân trong veo khi hầm nhừ sẽ dẻo mềm giòn sần sật, mỡ bò ngậy nhẹ làm nước dùng sánh mịn mà không hề ngấy ngán.

## 2. Hầm thảo mộc bằng nước dừa tươi

- Rang sơ một bông hồi nhỏ và khúc quế thanh để tinh dầu bung tỏa trọn vẹn mùi thơm.
- Đập dập 4-5 cây sả bó lại cho vào nồi.
- Hầm thịt bằng nước dừa xiêm ngọt thanh tự nhiên thay vì chỉ dùng nước lọc, giúp miếng thịt mềm tơi từ bên trong và có màu nâu đỏ hạt dẻ cực kỳ bắt mắt.

## 3. Thưởng thức nóng hổi

Bẻ miếng bánh mì đặc ruột nóng giòn, chấm ngập vào bát sốt bò kho sánh đậm, thêm chút ngò gai, húng quế và lát ớt hiểm – vị giác như được đánh thức với tầng tầng lớp lớp hương vị phong phú.`,
  },
  {
    slug: 'canh-chua-ca-bong-lau-ngay-mua',
    title: 'Canh chua cá bông lau dọc mùng: Vị chua ngọt thanh kích thích vị giác',
    summary: 'Vị chua dịu của cốt me chín, béo ngậy từ cá bông lau tươi sông Hậu kết hợp cùng ngò om cay thơm giải nhiệt và giải cảm tuyệt vời mùa mưa ẩm ướt.',
    coverImageUrl: 'https://images.unsplash.com/photo-1569058242252-623df46b5025?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    viewCount: 890,
    likeCount: 135,
    commentCount: 14,
    tags: ['canh chua', 'miền Tây', 'mùa mưa', 'món giải cảm', 'ẩm thực dân dã'],
    content: `Trời mưa kéo dài thường khiến không khí ẩm ướt và khẩu vị trở nên uể oải. Lúc này, một bát canh chua cá bông lau thơm phức với vị chua thanh sảng khoái chính là liều thuốc kích thích vị giác tốt nhất.

## 1. Sự kết hợp nguyên liệu kinh điển miền Tây

Cá bông lau sông thịt trắng phau, béo ngọt tự nhiên mà không tanh, khi nấu cùng các loại rau củ đồng quê tạo nên một bức tranh ẩm thực đa sắc:
- **Cốt me chín:** Tạo độ chua dịu êm, không chua gắt như giấm hay chanh.
- **Dọc mùng (bạc hà) & đậu bắp:** Giòn xốp, thấm đẫm vị nước dùng thanh mát.
- **Cà chua & thơm (dứa):** Đem lại màu đỏ vàng rực rỡ và hương thơm hoa quả dịu ngọt.
- **Rau nêm ngò om, ngò gai:** Tinh dầu thảo mộc làm bừng tỉnh khứu giác.

## 2. Sơ chế dọc mùng sạch ngứa

Tước sạch vỏ xơ xanh bên ngoài, thái vát chéo, bóp kỹ với muối hạt rồi rửa sạch qua nước lạnh 2-3 lần và vắt ráo. Thả vào nồi canh sau cùng ngay trước khi tắt bếp để giữ độ giòn sần sật.

## 3. Chấm cá với nước mắm ớt nguyên chất

Gắp khúc cá bông lau ra đĩa riêng, dầm thêm một trái ớt hiểm cay vào chén nước mắm nhĩ thơm lừng. Vị béo ngọt của cá hòa cùng vị mặn mà cay nồng của nước mắm khiến bát cơm trắng hết veo trong tích tắc.`,
  },
  {
    slug: 'vi-sao-troi-mua-lai-them-banh-xeo-gion-rum',
    title: 'Bánh xèo giòn rụm: Vì sao người Việt mê mẩn đúc bánh xèo mỗi độ mưa về?',
    summary: 'Tiếng mỡ reo "xèo xèo" trên chảo gang, vành bánh vàng ươm giòn tan cuốn cải xanh non và chấm nước mắm chua ngọt – hương vị tuổi thơ không thể quên.',
    coverImageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 6,
    viewCount: 1380,
    likeCount: 195,
    commentCount: 26,
    tags: ['bánh xèo', 'ẩm thực đường phố', 'mùa mưa', 'món ngon', 'tuổi thơ'],
    content: `Hễ trời bắt đầu đổ cơn mưa rào mát lạnh, ở khắp các nẻo đường từ miền Trung đến Nam Bộ, người ta lại thèm được nghe tiếng mỡ reo tí tách và mùi bột nghệ thơm lừng tỏa ra từ những căn bếp đúc bánh xèo.

## 1. Nguồn gốc của tiếng reo "xèo xèo"

Tên gọi "bánh xèo" bắt nguồn chính từ âm thanh bột gạo hòa nước cốt dừa va chạm với lòng chảo gang đang bốc khói rực mỡ. Tiếng xèo vui tai mang đến cảm giác ấm cúng, xua tan cái lạnh ẩm ướt và sự vắng vẻ của những buổi chiều mưa.

## 2. Bí quyết bột bánh giòn tan không ngấy

- Pha bột gạo với một chút bột bắp hoặc bột năng và bột nghệ nguyên chất cho màu vàng óng ả.
- Thêm một lon bia lạnh hoặc nước có ga vào âu bột giúp vỏ bánh xốp phồng và giữ độ giòn lâu hơn gấp 3 lần.
- Nhân tôm đất tươi ngọt, thịt ba chỉ áp chảo cháy cạnh và giá đỗ ngọt giòn rắc đều giữa lòng bánh.

## 3. Nghệ thuật cuốn rau rừng và nước mắm chua ngọt

Ăn bánh xèo chuẩn điệu là dùng tay cuộn chiếc bánh vàng rụm trong lá cải bẹ xanh cay nồng, thêm lá cóc non, đọt xoài, rau xà lách và dưa leo giòn mát. Chấm ngập cuốn bánh vào bát nước mắm tỏi ớt chua ngọt ngâm đu đủ bào giòn – vừa cắn một miếng đã nghe rôm rốp rộn ràng trong khoang miệng.`,
  },
  {
    slug: 'tra-gung-mat-ong-sa-tac-giu-am-mua-mua',
    title: 'Trà gừng mật ong sả tắc: Thức uống giữ ấm và tăng sức đề kháng mùa mưa',
    summary: 'Ly trà nghi ngút khói thơm nồng vị gừng già, ngọt dịu mật ong rừng và thanh mát sả tắc – bài thuốc dân gian bảo vệ đường hô hấp và giữ ấm cơ thể.',
    coverImageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 4,
    viewCount: 820,
    likeCount: 115,
    commentCount: 11,
    tags: ['trà gừng', 'đồ uống giữ ấm', 'tăng đề kháng', 'sức khỏe', 'thảo mộc'],
    content: `Những đợt thay đổi thời tiết đột ngột và gió lạnh mùa mưa là nguyên nhân hàng đầu gây cảm lạnh, ho khan và viêm họng. Một tách trà gừng mật ong sả tắc nóng mỗi sáng không chỉ sưởi ấm dạ dày mà còn là lá chắn miễn dịch tự nhiên cho cả gia đình.

## 1. Công dụng kỳ diệu của gừng già và thảo mộc tự nhiên

- **Gừng già nướng thơm:** Chứa hoạt chất gingerol kháng viêm mạnh mẽ, thúc đẩy tuần hoàn máu và làm ấm cơ thể nhanh chóng.
- **Sả tươi đập dập:** Chứa tinh dầu citral giúp thư giãn hệ thần kinh, thông thoáng mũi họng và khử khuẩn đường hô hấp.
- **Mật ong nguyên chất:** Cung cấp enzyme tự nhiên, làm dịu niêm mạc cổ họng và bổ sung năng lượng tức thì.
- **Tắc (quất) tươi:** Giàu Vitamin C hỗ trợ tăng cường hệ miễn dịch.

## 2. Cách pha chế giữ trọn vẹn dưỡng chất

1. Nướng sơ một củ gừng già trên lửa nhỏ cho vỏ sém thơm, đập dập cùng 2 nhánh sả.
2. Hãm gừng sả với 300ml nước sôi 95°C trong 10-15 phút.
3. **Lưu ý quan trọng:** Đợi nước trà nguội bớt xuống khoảng 45-50°C mới cho mật ong và nước cốt tắc vào khuấy đều. Không cho mật ong vào nước quá sôi vì nhiệt độ cao sẽ phá hủy các vi chất dinh dưỡng quý giá.

## 3. Thời điểm vàng để thưởng thức

Uống một tách trà gừng ấm vào sáng sớm sau khi thức dậy hoặc sau khi đi ngoài trời mưa lạnh về sẽ giúp cơ thể điều hòa nhiệt độ, đào thải khí lạnh và phòng ngừa cảm cúm tối ưu.`,
  },
  {
    slug: 'oc-luoc-la-buoi-sa-ot-ngay-mua',
    title: 'Ốc luộc lá bưởi & sả ớt: Thú vui tụ tập nhâm nhi ngày mưa của người Việt',
    summary: 'Bát ốc nóng bốc khói ngào ngạt hương tinh dầu bưởi sả, con ốc béo giòn bùi chấm ngập trong chén nước mắm gừng ớt cay xé lưỡi.',
    coverImageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    viewCount: 1040,
    likeCount: 156,
    commentCount: 22,
    tags: ['ốc luộc', 'nước mắm gừng', 'món nhâm nhi', 'mùa mưa', 'ẩm thực vỉa hè'],
    content: `Không hẹn mà gặp, những chiều mưa lạnh trời xầm xì cũng là lúc các quán ốc vỉa hè nghi ngút khói trở nên nhộn nhịp nhất. Bát ốc luộc thơm nồng tinh dầu lá bưởi đã trở thành nét văn hóa thưởng thức độc đáo của người Việt.

## 1. Mùi hương tinh dầu đặc trưng

Điểm nhấn làm nên sự khác biệt của ốc luộc Việt Nam là việc sử dụng các loại lá thơm đồng nội:
- **Lá bưởi tươi hoặc lá chanh bánh tẻ:** Khử sạch mùi tanh bùn, mang lại hương vị thanh tao tự nhiên.
- **Sả cây đập dập lót đáy nồi:** Tinh dầu sả bốc lên bao phủ lấy từng con ốc trong quá trình hấp chín.
- **Gừng thái lát mỏng:** Trung hòa tính hàn của ốc, giúp ấm bụng dễ tiêu.

## 2. Kỹ thuật luộc ốc chín tới giòn ngọt

Luộc ốc đòi hỏi sự chính xác về thời gian:
- Chỉ cho rất ít nước (hoặc không cần nước) vì bản thân ốc sẽ tự tiết ra nước ngọt.
- Đậy vung kín đun lửa thật lớn. Khi thấy nắp vung rung bần bật và hơi nước bốc lên mù mịt, mở nắp đảo đều một lượt.
- Ốc bung mày (vảy) là tắt bếp ngay lập tức. Luộc quá lâu sẽ làm thịt ốc dai quắt và thụt sâu vào trong vỏ rất khó khêu.

## 3. Chén nước chấm "linh hồn"

Ốc luộc ngon 5 phần thì nước chấm quyết định 5 phần còn lại:
- Nước mắm nhĩ pha cùng nước ấm, đường, nước cốt quất, gừng giã nhuyễn, ớt chỉ thiên cay nồng và lá chanh thái chỉ mỏng như sợi tơ.
- Vị cay xuýt xoa làm ấm sực cơ thể giữa tiết trời mưa dầm giá lạnh.`,
  },
  {
    slug: 'sup-ga-ngo-non-nam-huong-ngay-mua',
    title: 'Súp gà ngô non nấm hương: Bát súp sánh mịn bồi bổ năng lượng ngày trở gió',
    summary: 'Vị ngọt thanh từ nước hầm ức gà, hạt ngô giòn ngọt và nấm hương thơm lừng trong làn súp sóng sánh hoa trứng bồng bềnh.',
    coverImageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 5,
    viewCount: 760,
    likeCount: 98,
    commentCount: 8,
    tags: ['súp gà', 'dinh dưỡng', 'món ấm', 'cho cả nhà', 'dễ tiêu hóa'],
    content: `Vào những ngày trời mưa se lạnh, một bát súp gà ngô non nấm hương nóng hổi, sánh mượt vừa dễ ăn lại vừa cung cấp nguồn năng lượng dồi dào, rất thích hợp làm bữa sáng hoặc món ăn xế cho trẻ nhỏ và người lớn tuổi.

## 1. Nguồn dinh dưỡng dồi dào và dễ tiêu hóa

- **Ức gà xé sợi:** Nguồn đạm nạc chất lượng cao, dễ hấp thu, giúp tái tạo năng lượng nhanh chóng.
- **Ngô ngọt (bắp Mỹ):** Cung cấp chất xơ tự nhiên và vị ngọt lành, giòn sần sật vui miệng.
- **Nấm hương tươi:** Giàu beta-glucan tăng cường hệ thống miễn dịch, tạo mùi thơm thanh nhã khó lẫn.
- **Lòng trắng trứng gà:** Tạo thành các dải vân mây mềm mại làm bát súp thêm phần bắt mắt.

## 2. Bí quyết nấu súp không bị vữa nước

- Hòa bột năng (hoặc bột bắp) với nước lạnh rồi từ từ rót vào nồi nước dùng gà đang sôi lăn tăn, khuấy đều tay theo một chiều cho đến khi đạt độ sánh mong muốn.
- Đánh tan trứng gà, đổ qua rây lọc từ từ vào nồi kết hợp khuấy nhẹ theo chiều kim đồng hồ để tạo vân trứng hoa mỏng mịn như lụa.
- Tránh dùng muỗng khuấy đảo liên tục khi súp đã nguội để súp giữ được độ sánh đặc nguyên bản.

## 3. Hoàn thiện hương vị

Múc súp ra bát sứ trắng, rắc thêm chút tiêu đen xay mịn, vài cọng ngò rí và vài giọt dầu mè thơm nức. Bát súp sánh mịn trôi nhẹ qua cổ họng, để lại cảm giác êm dịu và ấm áp dài lâu.`,
  },
  {
    slug: 'che-troi-nuoc-gung-nong-chieu-mua',
    title: 'Chè trôi nước gừng nóng: Viên chè mềm dẻo ngọt bùi sưởi ấm chiều mưa',
    summary: 'Vỏ nếp dẻo thơm bọc nhân đậu xanh bùi bùi, ngập trong nước đường thốt nốt vàng óng thơm ngát vị gừng cay và nước cốt dừa béo bùi.',
    coverImageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=1200&q=80',
    readMinutes: 6,
    viewCount: 1190,
    likeCount: 172,
    commentCount: 20,
    tags: ['chè trôi nước', 'món ngọt', 'gừng ấm', 'mùa mưa', 'món tráng miệng'],
    content: `Những hạt mưa rào tí tách rơi ngoài hiên, được ngồi trong gian bếp ấm cúng thưởng thức bát chè trôi nước gừng nóng hổi là một trong những niềm hạnh phúc bình dị và ngọt ngào nhất của ẩm thực Á Đông.

## 1. Kết cấu tròn đầy viên mãn

Từng viên chè tròn xoe với lớp vỏ bột nếp trắng mịn, dẻo quánh mà không dính răng, ôm trọn lấy phần nhân đậu xanh xay nhuyễn béo bùi xào cùng hành tím phi thơm lừng. Khi cắn nhẹ, vị bùi ngọt lan tỏa kết hợp hoàn hảo cùng nước đường gừng ấm nồng.

## 2. Nước đường thốt nốt thơm hương gừng già

- Dùng đường thốt nốt An Giang nguyên chất để nước chè có màu hổ phách óng ánh tự nhiên và vị ngọt thanh tao không khé cổ.
- Gừng già thái sợi mỏng nấu sôi liu riu cùng nước đường để tinh dầu gừng ngấm đượm vào từng giọt nước chè.
- Thêm một nắm viên bột ỉ nhỏ li ti (viên không nhân) thả kèm tạo sự phong phú khi thưởng thức.

## 3. Thêm nước cốt dừa và mè rang thơm lừng

Trước khi ăn, rưới nhẹ một thìa canh nước cốt dừa béo ngậy được nấu sánh mịn với chút muối và lá dứa, rắc thêm nhúm mè trắng rang vàng thơm phức. Vị ngọt ấm của gừng, vị béo của dừa và vị dẻo thơm của nếp tạo nên một bản hòa tấu hương vị tuyệt diệu xua tan mọi giá lạnh ngày mưa.`,
  },
];

async function main() {
  console.log('--- BẮT ĐẦU TẠO 10 BÀI VIẾT VỀ MÙA MƯA ---');
  const client = await pool.connect();
  try {
    // 1. Lấy thông tin topic "Món ngon mùa mưa"
    const topicRes = await client.query("SELECT id, title FROM topics WHERE slug = 'mon-ngon-mua-mua' LIMIT 1");
    let topicId = topicRes.rows[0]?.id;
    if (!topicId) {
      console.log('Tạo mới topic Món ngon mùa mưa...');
      const newTopic = await client.query(`
        INSERT INTO topics (id, slug, title, description, display_order, is_active, created_at, updated_at)
        VALUES ($1, 'mon-ngon-mua-mua', 'Món ngon mùa mưa', 'Món ấm bụng cho những ngày mưa', 1, true, NOW(), NOW())
        RETURNING id
      `, [randomUUID()]);
      topicId = newTopic.rows[0].id;
    }
    console.log(`Topic ID: ${topicId}`);

    // 2. Lấy thông tin tác giả (Author)
    let authorId;
    const authorRes = await client.query("SELECT user_id FROM profiles WHERE display_name ILIKE '%Mogo%' OR display_name ILIKE '%Mogu%' LIMIT 1");
    if (authorRes.rows.length > 0) {
      authorId = authorRes.rows[0].user_id;
    } else {
      const anyUser = await client.query("SELECT user_id FROM profiles LIMIT 1");
      authorId = anyUser.rows[0]?.user_id;
    }
    console.log(`Author ID: ${authorId}`);

    // 3. Tạo hoặc cập nhật từng bài viết
    let count = 0;
    for (const item of RAIN_ARTICLES) {
      const existing = await client.query("SELECT id FROM articles WHERE slug = $1", [item.slug]);
      let articleId;
      if (existing.rows.length > 0) {
        articleId = existing.rows[0].id;
        await client.query(`
          UPDATE articles
          SET title = $1,
              summary = $2,
              content = $3,
              cover_image_url = $4,
              read_minutes = $5,
              view_count = $6,
              like_count = $7,
              comment_count = $8,
              status = 'PUBLISHED',
              topic_id = $9,
              author_id = $10,
              updated_at = NOW()
          WHERE id = $11
        `, [
          item.title,
          item.summary,
          item.content,
          item.coverImageUrl,
          item.readMinutes,
          item.viewCount,
          item.likeCount,
          item.commentCount,
          topicId,
          authorId,
          articleId,
        ]);
        console.log(`[${count + 1}/10] Cập nhật bài viết: "${item.title}"`);
      } else {
        articleId = randomUUID();
        await client.query(`
          INSERT INTO articles (
            id, slug, title, summary, content, cover_image_url,
            status, read_minutes, view_count, like_count, comment_count,
            topic_id, author_id, is_pinned, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            'PUBLISHED', $7, $8, $9, $10,
            $11, $12, false, NOW(), NOW()
          )
        `, [
          articleId,
          item.slug,
          item.title,
          item.summary,
          item.content,
          item.coverImageUrl,
          item.readMinutes,
          item.viewCount,
          item.likeCount,
          item.commentCount,
          topicId,
          authorId,
        ]);
        console.log(`[${count + 1}/10] Tạo mới bài viết: "${item.title}"`);
      }

      // Xóa và ghi lại tags
      await client.query("DELETE FROM article_tags WHERE article_id = $1", [articleId]);
      for (const tag of item.tags) {
        await client.query(`
          INSERT INTO article_tags (id, article_id, tag)
          VALUES ($1, $2, $3)
          ON CONFLICT (article_id, tag) DO NOTHING
        `, [randomUUID(), articleId, tag]);
      }
      count++;
    }

    console.log(`\n Hoàn thành tạo thành công ${count} bài viết về mùa mưa!`);
  } catch (err) {
    console.error('Lỗi khi seed bài viết:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
