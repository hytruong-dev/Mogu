import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export interface ProvinceSpecialty {
  provinceCode: string;
  provinceName: string;
  regionCode: 'north' | 'central' | 'south';
  dishName: string;
  dishDescription: string;
  existingInDb: boolean;
  relatedKeywords: string[];
}

export const VIETNAM_63_SPECIALTIES: ProvinceSpecialty[] = [
  // ── MIỀN BẮC (25 tỉnh thành) ────────────────────────────────────────────────
  {
    provinceCode: 'hanoi',
    provinceName: 'Hà Nội',
    regionCode: 'north',
    dishName: 'Phở bò',
    dishDescription: 'Phở bò truyền thống Hà Nội với nước dùng trong ngọt từ xương bò, quế hồi và bánh phở dẻo mềm.',
    existingInDb: true,
    relatedKeywords: ['phở bò Hà Nội', 'phở tái nạm', 'phở truyền thống']
  },
  {
    provinceCode: 'haiphong',
    provinceName: 'Hải Phòng',
    regionCode: 'north',
    dishName: 'Bánh đa cua Hải Phòng',
    dishDescription: 'Bánh đa đỏ sợi dai, gạch cua đồng béo ngậy, chả lá lốt thơm lừng và rau muống giòn.',
    existingInDb: true,
    relatedKeywords: ['bánh đa đỏ Hải Phòng', 'bánh đa cua bể', 'bánh đa cua đồng']
  },
  {
    provinceCode: 'quangninh',
    provinceName: 'Quảng Ninh',
    regionCode: 'north',
    dishName: 'Bún bề bề Hạ Long',
    dishDescription: 'Bún hải sản Hạ Long ngọt lịm với thịt bề bề tươi bóc nõn, chả mực nang giòn sần sật và nước dùng tôm thơm phức.',
    existingInDb: false,
    relatedKeywords: ['bún bề bề Hạ Long', 'bún tôm bề bề Quảng Ninh', 'bún hải sản Hạ Long chả mực']
  },
  {
    provinceCode: 'namdinh',
    provinceName: 'Nam Định',
    regionCode: 'north',
    dishName: 'Bún đũa Nam Định',
    dishDescription: 'Sợi bún to tròn như chiếc đũa giòn dai, ngập tràn riêu cua đồng vàng óng, rau muống chần và nước riêu thanh ngọt.',
    existingInDb: false,
    relatedKeywords: ['bún đũa thành Nam', 'bún đũa riêu cua Nam Định', 'đặc sản bún đũa']
  },
  {
    provinceCode: 'ninhbinh',
    provinceName: 'Ninh Bình',
    regionCode: 'north',
    dishName: 'Cơm cháy sốt thịt dê Ninh Bình',
    dishDescription: 'Cơm cháy nếp hương giòn rụm vàng ruộm ăn kèm nước sốt thịt dê núi xào hành tây, cà rốt đậm đà thơm ngậy.',
    existingInDb: false,
    relatedKeywords: ['cơm cháy thịt dê Ninh Bình', 'cơm cháy dê núi sốt cay', 'đặc sản cơm cháy Ninh Bình']
  },
  {
    provinceCode: 'hanam',
    provinceName: 'Hà Nam',
    regionCode: 'north',
    dishName: 'Cá kho làng Vũ Đại',
    dishDescription: 'Cá trắm đen kho niêu đất 16 tiếng với riềng, nước cốt cua đồng, thịt chắc thơm mục xương.',
    existingInDb: true,
    relatedKeywords: ['cá kho làng Vũ Đại', 'cá trắm đen kho niêu đất', 'cá kho Đại Hoàng']
  },
  {
    provinceCode: 'haiduong',
    provinceName: 'Hải Dương',
    regionCode: 'north',
    dishName: 'Chả rươi Tứ Kỳ',
    dishDescription: 'Món đặc sản tiến vua làm từ con rươi béo ngậy, thịt heo băm, trứng gà, vỏ quýt và thì là nướng thơm lừng.',
    existingInDb: true,
    relatedKeywords: ['chả rươi Tứ Kỳ', 'rươi Hải Dương', 'chả rươi vỏ quýt']
  },
  {
    provinceCode: 'hungyen',
    provinceName: 'Hưng Yên',
    regionCode: 'north',
    dishName: 'Bún thang lươn Hưng Yên',
    dishDescription: 'Bát bún thang trứ danh Phố Hiến với lươn đồng xào giòn đậm đà, trứng thái chỉ, giò lụa và nước dùng xương ngọt thanh.',
    existingInDb: false,
    relatedKeywords: ['bún thang lươn Phố Hiến', 'bún thang lươn Hưng Yên', 'bún lươn Hưng Yên']
  },
  {
    provinceCode: 'thaibinh',
    provinceName: 'Thái Bình',
    regionCode: 'north',
    dishName: 'Canh cá Quỳnh Côi',
    dishDescription: 'Canh cá nấu bánh đa Quỳnh Côi dai mềm, thịt cá quả nướng săn rồi rán vàng, nước dùng ninh từ xương cá ngọt mát.',
    existingInDb: false,
    relatedKeywords: ['canh cá Quỳnh Côi Thái Bình', 'canh cá rô đồng Quỳnh Côi', 'bánh đa cá Thái Bình']
  },
  {
    provinceCode: 'bacninh',
    provinceName: 'Bắc Ninh',
    regionCode: 'north',
    dishName: 'Cháo cá Tích Nghi',
    dishDescription: 'Bát cháo cá nóng hổi xứ Kinh Bắc với thịt cá chép/cá quả tươi ngọt xào nghệ vàng ruộm, rắc hành ngò thơm lừng.',
    existingInDb: false,
    relatedKeywords: ['cháo cá Tích Nghi Bắc Ninh', 'cháo cá Kinh Bắc', 'cháo cá chép Bắc Ninh']
  },
  {
    provinceCode: 'bacgiang',
    provinceName: 'Bắc Giang',
    regionCode: 'north',
    dishName: 'Gà đồi Yên Thế hấp lá chanh',
    dishDescription: 'Gà đồi Yên Thế thả vườn da giòn thịt săn chắc ngọt lịm, hấp cùng lá chanh chấm muối tiêu ớt rừng cay nồng.',
    existingInDb: false,
    relatedKeywords: ['gà đồi Yên Thế Bắc Giang', 'gà Yên Thế hấp lá chanh', 'gà đồi luộc Bắc Giang']
  },
  {
    provinceCode: 'vinhphuc',
    provinceName: 'Vĩnh Phúc',
    regionCode: 'north',
    dishName: 'Cá thính Lập Thạch chiên giòn',
    dishDescription: 'Cá sông ủ muối thính ngô rang thơm nức chua dịu, chiên vàng ươm ăn cùng cơm nóng đưa cơm khó cưỡng.',
    existingInDb: false,
    relatedKeywords: ['cá thính Lập Thạch Vĩnh Phúc', 'cá muối chua Vĩnh Phúc', 'cá thính chiên']
  },
  {
    provinceCode: 'phutho',
    provinceName: 'Phú Thọ',
    regionCode: 'north',
    dishName: 'Cá lăng nướng than hoa sông Đà',
    dishDescription: 'Cá lăng tươi sông Đà béo ngọt ướp mẻ nghệ, riềng mẻ nướng trên than hoa thơm phức chấm mắm tôm thì là.',
    existingInDb: false,
    relatedKeywords: ['cá lăng nướng sông Đà Phú Thọ', 'cá lăng nướng than hoa', 'cá lăng Việt Trì']
  },
  {
    provinceCode: 'tuyenquang',
    provinceName: 'Tuyên Quang',
    regionCode: 'north',
    dishName: 'Gỏi cá bỗng sông Lô',
    dishDescription: 'Đặc sản trứ danh sông Lô với cá bỗng ngọt thịt trộn thính xương cá rang vàng giòn rụm cuốn lá rừng chấm nước chấm hạt xót.',
    existingInDb: false,
    relatedKeywords: ['gỏi cá bỗng sông Lô Tuyên Quang', 'cá bỗng Tuyên Quang', 'gỏi cá bỗng nướng thính']
  },
  {
    provinceCode: 'thainguyen',
    provinceName: 'Thái Nguyên',
    regionCode: 'north',
    dishName: 'Bánh chưng Bờ Đậu',
    dishDescription: 'Bánh chưng nếp nương Định Hóa xanh mướt vỏ đỗ vàng ươm, thịt ba chỉ hạt tiêu dẻo thơm trứ danh làng nghề Bờ Đậu.',
    existingInDb: false,
    relatedKeywords: ['bánh chưng Bờ Đậu Thái Nguyên', 'đặc sản bánh chưng Bờ Đậu', 'bánh chưng nếp nương']
  },
  {
    provinceCode: 'backan',
    provinceName: 'Bắc Kạn',
    regionCode: 'north',
    dishName: 'Tôm chua Ba Bể cuốn thịt luộc',
    dishDescription: 'Tôm hồ Ba Bể lên men chua cay cùng tỏi ớt xôi nếp, cuốn thịt ba chỉ luộc, chuối xanh và khế chua.',
    existingInDb: false,
    relatedKeywords: ['tôm chua Ba Bể Bắc Kạn', 'tôm chua hồ Ba Bể', 'đặc sản Bắc Kạn']
  },
  {
    provinceCode: 'caobang',
    provinceName: 'Cao Bằng',
    regionCode: 'north',
    dishName: 'Bánh cuốn canh Cao Bằng',
    dishDescription: 'Bánh cuốn nóng tráng mỏng nhân thịt băm mộc nhĩ ăn kèm bát canh xương hầm ngọt lịm, chả lụa và ớt ngâm mác mật.',
    existingInDb: false,
    relatedKeywords: ['bánh cuốn canh Cao Bằng', 'bánh cuốn nước xương Cao Bằng', 'bánh cuốn nóng Cao Bằng']
  },
  {
    provinceCode: 'langson',
    provinceName: 'Lạng Sơn',
    regionCode: 'north',
    dishName: 'Vịt quay lá móc mật Lạng Sơn',
    dishDescription: 'Vịt bầu Thất Khê nhồi lá móc mật nướng lu than hoa da giòn bóng màu mật ong, thịt mềm ngọt đậm đà.',
    existingInDb: false,
    relatedKeywords: ['vịt quay Lạng Sơn lá móc mật', 'vịt quay Thất Khê', 'vịt quay da giòn xứ Lạng']
  },
  {
    provinceCode: 'hagiang',
    provinceName: 'Hà Giang',
    regionCode: 'north',
    dishName: 'Thắng cố ngựa Đồng Văn',
    dishDescription: 'Nồi thắng cố thịt và lòng ngựa hầm nhừ nghi ngút khói thơm nức thảo quả, hoa hồi, sả ớt của đồng bào vùng cao.',
    existingInDb: false,
    relatedKeywords: ['thắng cố ngựa Đồng Văn Hà Giang', 'thắng cố chợ phiên Hà Giang', 'thắng cố Mèo Vạc']
  },
  {
    provinceCode: 'laocai',
    provinceName: 'Lào Cai',
    regionCode: 'north',
    dishName: 'Lẩu cá hồi Sa Pa',
    dishDescription: 'Cá hồi vân Sa Pa tươi rói nhúng nước lẩu chua cay măng chua lá giang, ăn kèm cải mèo vùng cao giòn ngọt.',
    existingInDb: false,
    relatedKeywords: ['lẩu cá hồi Sa Pa Lào Cai', 'cá hồi tươi Sa Pa', 'lẩu cá hồi măng chua']
  },
  {
    provinceCode: 'yenbai',
    provinceName: 'Yên Bái',
    regionCode: 'north',
    dishName: 'Xôi ngũ sắc Mù Cang Chải',
    dishDescription: 'Xôi nếp Tú Lệ dẻo thơm ngào ngạt nhuộm 5 màu tự nhiên từ lá cây rừng, ăn cùng thịt lợn bản nướng thơm ngậy.',
    existingInDb: false,
    relatedKeywords: ['xôi ngũ sắc Mù Cang Chải Yên Bái', 'xôi nếp Tú Lệ ngũ sắc', 'xôi nếp nương Mù Cang Chải']
  },
  {
    provinceCode: 'sonla',
    provinceName: 'Sơn La',
    regionCode: 'north',
    dishName: 'Thịt trâu gác bếp Sơn La',
    dishDescription: 'Thịt bắp trâu tươi ướp ớt khô, gừng, mắc khén hun khói củi nhãn, từng thớ thịt đỏ hồng xé sợi chấm chẩm chéo cay tê.',
    existingInDb: false,
    relatedKeywords: ['thịt trâu gác bếp Sơn La', 'thịt trâu hun khói Tây Bắc', 'thịt trâu gác bếp chấm chẩm chéo']
  },
  {
    provinceCode: 'hoabinh',
    provinceName: 'Hoà Bình',
    regionCode: 'north',
    dishName: 'Thịt lợn mán nướng Bản Mường',
    dishDescription: 'Thịt lợn mán cắp nách ướp hạt dổi, sả, mắc khén nướng than hoa vàng ươm giòn bì thơm lừng ăn kèm cơm lam.',
    existingInDb: false,
    relatedKeywords: ['thịt lợn mán nướng Hòa Bình', 'thịt lợn cắp nách nướng hạt dổi', 'lợn mán nướng bản Mường']
  },
  {
    provinceCode: 'dienbien',
    provinceName: 'Điện Biên',
    regionCode: 'north',
    dishName: 'Gà đen Tủa Chùa nướng mắc khén',
    dishDescription: 'Gà xương đen Tủa Chùa thịt thơm ngọt săn chắc nướng than hoa ướp mắc khén thơm nức, chấm muối ớt chanh.',
    existingInDb: false,
    relatedKeywords: ['gà đen Tủa Chùa Điện Biên', 'gà đen nướng mắc khén', 'gà xương đen Tủa Chùa']
  },
  {
    provinceCode: 'laichau',
    provinceName: 'Lai Châu',
    regionCode: 'north',
    dishName: 'Pa pỉnh tộp Lai Châu',
    dishDescription: 'Cá suối tươi ướp mắc khén, hạt dổi, thì là, hành hoa rồi gập đôi kẹp tre nướng than hồng thơm ngọt nguyên vị.',
    existingInDb: false,
    relatedKeywords: ['pa pỉnh tộp Lai Châu', 'cá nướng gập Tây Bắc', 'cá suối nướng mắc khén Lai Châu']
  },

  // ── MIỀN TRUNG & TÂY NGUYÊN (19 tỉnh thành) ──────────────────────────────────
  {
    provinceCode: 'thanhhoa',
    provinceName: 'Thanh Hóa',
    regionCode: 'central',
    dishName: 'Nem chua Thanh Hóa nướng',
    dishDescription: 'Nem chua gói lá chuối nướng xém cạnh trên than hoa bốc khói thơm lừng, chấm tương ớt cay nồng đậm đà.',
    existingInDb: false,
    relatedKeywords: ['nem chua nướng Thanh Hóa', 'nem chua Thanh Hóa', 'nem nướng xứ Thanh']
  },
  {
    provinceCode: 'nghean',
    provinceName: 'Nghệ An',
    regionCode: 'central',
    dishName: 'Súp lươn Nghệ An bánh mì',
    dishDescription: 'Bát súp lươn đồng xào săn đậm đà với hành tăm, nghệ, ớt cay nồng béo ngậy ăn kèm bánh mì giòn rụm.',
    existingInDb: false,
    relatedKeywords: ['súp lươn Nghệ An bánh mì', 'súp lươn cay thành Vinh', 'đặc sản súp lươn Nghệ An']
  },
  {
    provinceCode: 'hatinh',
    provinceName: 'Hà Tĩnh',
    regionCode: 'central',
    dishName: 'Bánh mướt ram giò Hà Tĩnh',
    dishDescription: 'Bánh mướt tráng mỏng mềm mướt cuốn cùng chiếc ram chiên giòn rụm nhân thịt mộc nhĩ chấm nước mắm tỏi ớt chanh.',
    existingInDb: false,
    relatedKeywords: ['bánh mướt ram giò Hà Tĩnh', 'ram bánh mướt Hà Tĩnh', 'đặc sản ram bánh mướt']
  },
  {
    provinceCode: 'quangbinh',
    provinceName: 'Quảng Bình',
    regionCode: 'central',
    dishName: 'Cháo canh cá lóc Quảng Bình',
    dishDescription: 'Tô cháo canh sợi mì mềm dai nấu cá lóc đồng ngọt thịt, nước lèo xương đậm đà ăn kèm ram giòn và rau cải xanh.',
    existingInDb: false,
    relatedKeywords: ['cháo canh cá lóc Quảng Bình', 'bánh canh cá lóc Đồng Hới', 'cháo canh Quảng Bình']
  },
  {
    provinceCode: 'quangtri',
    provinceName: 'Quảng Trị',
    regionCode: 'central',
    dishName: 'Thịt trâu xào lá trơng Quảng Trị',
    dishDescription: 'Thịt trâu non ngọt mềm xào cùng lá trơng rừng có vị cay nồng the the và tiêu xanh thơm nức mũi.',
    existingInDb: false,
    relatedKeywords: ['thịt trâu lá trơng Quảng Trị', 'thịt trâu nướng lá trơng', 'đặc sản Quảng Trị thịt trâu']
  },
  {
    provinceCode: 'hue',
    provinceName: 'Thừa Thiên Huế',
    regionCode: 'central',
    dishName: 'Bún bò Huế',
    dishDescription: 'Bún bò giò heo chuẩn vị cố đô Huế với nước dùng thơm lừng sả mắm ruốc, chả cua, tiết heo và bắp bò.',
    existingInDb: true,
    relatedKeywords: ['bún bò Huế', 'bún bò giò heo Huế', 'bún bò cố đô']
  },
  {
    provinceCode: 'danang',
    provinceName: 'Đà Nẵng',
    regionCode: 'central',
    dishName: 'Bánh tráng cuốn thịt heo Đà Nẵng',
    dishDescription: 'Thịt heo luộc hai đầu da mỡ màng, rau rừng đủ loại cuốn bánh tráng Đại Lộc chấm mắm nêm cá cơm đậm đà.',
    existingInDb: true,
    relatedKeywords: ['bánh tráng cuốn thịt heo Đà Nẵng', 'thịt heo hai đầu da', 'bánh tráng cuốn mắm nêm']
  },
  {
    provinceCode: 'quangnam',
    provinceName: 'Quảng Nam',
    regionCode: 'central',
    dishName: 'Mì Quảng tôm thịt',
    dishDescription: 'Sợi mì gạo cán vàng nghệ, tôm đồng thịt ba chỉ kho đậm đà, nước nhưn xâm xấp thơm lừng ăn kèm bánh tráng mè nướng.',
    existingInDb: true,
    relatedKeywords: ['mì Quảng tôm thịt', 'mì Quảng xứ Quảng', 'đặc sản mì Quảng']
  },
  {
    provinceCode: 'quangngai',
    provinceName: 'Quảng Ngãi',
    regionCode: 'central',
    dishName: 'Cơm niêu cá bống kho tiêu',
    dishDescription: 'Cá bống sông Trà kho tiêu cay mặn đậm đà trong niêu đất, ăn kèm cơm niêu đập cháy giòn thơm phức.',
    existingInDb: true,
    relatedKeywords: ['cá bống sông Trà kho tiêu', 'cơm niêu cá bống Quảng Ngãi', 'cá bống kho tiêu']
  },
  {
    provinceCode: 'binhdinh',
    provinceName: 'Bình Định',
    regionCode: 'central',
    dishName: 'Bánh xèo tôm nhảy Bình Định',
    dishDescription: 'Bánh xèo vỏ giòn rụm đúc bằng khuôn đất với tôm đất tươi sống nhảy tanh tách, ăn kèm rau mầm và bánh tráng cuốn.',
    existingInDb: true,
    relatedKeywords: ['bánh xèo tôm nhảy Bình Định', 'bánh xèo tôm đất Quy Nhơn', 'bánh xèo tôm nhảy']
  },
  {
    provinceCode: 'phuyen',
    provinceName: 'Phú Yên',
    regionCode: 'central',
    dishName: 'Bánh canh hẹ Phú Yên',
    dishDescription: 'Tô bánh canh chả cá thu/cá nhồng ngập tràn hẹ sẻ xanh mướt, nước lèo trong veo ngọt thanh từ cá biển.',
    existingInDb: true,
    relatedKeywords: ['bánh canh hẹ Phú Yên', 'bánh canh hẹ Tuy Hòa', 'bánh canh chả cá hẹ']
  },
  {
    provinceCode: 'khanhhoa',
    provinceName: 'Khánh Hòa',
    regionCode: 'central',
    dishName: 'Bún chả cá Nha Trang',
    dishDescription: 'Bún chả cá thu chiên hấp thơm phức, nước dùng nấu cá ngừ trong thanh ngọt tự nhiên, ăn kèm rau sống mắm ớt.',
    existingInDb: true,
    relatedKeywords: ['bún chả cá Nha Trang', 'bún cá dầm Nha Trang', 'bún sứa chả cá Khánh Hòa']
  },
  {
    provinceCode: 'ninhthuan',
    provinceName: 'Ninh Thuận',
    regionCode: 'central',
    dishName: 'Cơm gà Phan Rang',
    dishDescription: 'Gà thả đồi da vàng giòn thịt săn chắc, cơm nấu nước luộc gà hạt óng ả chấm muối ớt đỏ cay nồng chua ngọt.',
    existingInDb: false,
    relatedKeywords: ['cơm gà Phan Rang Ninh Thuận', 'cơm gà luộc Phan Rang', 'cơm gà xé Ninh Thuận']
  },
  {
    provinceCode: 'binhthuan',
    provinceName: 'Bình Thuận',
    regionCode: 'central',
    dishName: 'Bánh căn Phan Thiết',
    dishDescription: 'Bánh căn đất nung giòn xốp đáy ăn cùng nước súp cá kho dầm cà chua, xíu mại viên béo ngậy và xoài băm chua dịu.',
    existingInDb: false,
    relatedKeywords: ['bánh căn Phan Thiết Bình Thuận', 'bánh căn xíu mại cá nục', 'bánh căn Bình Thuận']
  },
  {
    provinceCode: 'kontum',
    provinceName: 'Kon Tum',
    regionCode: 'central',
    dishName: 'Gỏi lá Kon Tum',
    dishDescription: 'Món gỏi cuốn hơn 40 loại lá rừng Tây Nguyên với thịt heo ba chỉ luộc, tôm sông chấm nước sốt mắm mẻ nấu cay đậm đà.',
    existingInDb: false,
    relatedKeywords: ['gỏi lá Kon Tum', 'đặc sản gỏi lá Tây Nguyên', 'gỏi 40 loại lá rừng Kon Tum']
  },
  {
    provinceCode: 'gialai',
    provinceName: 'Gia Lai',
    regionCode: 'central',
    dishName: 'Phở khô Gia Lai (Phở hai tô)',
    dishDescription: 'Tô bánh phở sợi săn trộn tóp mỡ, hành phi, thịt băm tương nâu ăn kèm tô súp bò bắp gầu ngọt lịm từ xương hầm.',
    existingInDb: false,
    relatedKeywords: ['phở khô Gia Lai', 'phở hai tô Pleiku', 'phở khô Pleiku bò tái']
  },
  {
    provinceCode: 'daklak',
    provinceName: 'Đắk Lắk',
    regionCode: 'central',
    dishName: 'Cơm lam gà nướng Tây Nguyên',
    dishDescription: 'Gà đồi nướng than hoa ướp sả ớt lá é thơm nức mũi, ăn kèm ống nứa cơm lam nướng giòn vỏ dẻo ngọt.',
    existingInDb: true,
    relatedKeywords: ['gà nướng cơm lam Buôn Ma Thuột', 'gà nướng Bản Đôn Đắk Lắk', 'cơm lam gà nướng']
  },
  {
    provinceCode: 'daknong',
    provinceName: 'Đắk Nông',
    regionCode: 'central',
    dishName: 'Cá lăng nướng đọt mây Đắk Nông',
    dishDescription: 'Cá lăng sông Sêrêpôk ngọt béo ướp muối ớt nướng than hồng ăn kèm đọt mây nướng đắng ngọt thảo dã.',
    existingInDb: false,
    relatedKeywords: ['cá lăng nướng Đắk Nông', 'cá lăng nướng đọt mây Sêrêpôk', 'đặc sản Đắk Nông']
  },
  {
    provinceCode: 'lamdong',
    provinceName: 'Lâm Đồng',
    regionCode: 'central',
    dishName: 'Lẩu gà lá é Đà Lạt',
    dishDescription: 'Thịt gà đồi chặt miếng đượm vị nấu cùng măng tươi, nấm và lá é trắng thảo mộc thơm the cay nồng xứ lạnh.',
    existingInDb: true,
    relatedKeywords: ['lẩu gà lá é Đà Lạt', 'lẩu gà lá é Tao Ngộ', 'đặc sản lẩu gà Đà Lạt']
  },

  // ── MIỀN NAM & TÂY NAM BỘ (19 tỉnh thành) ──────────────────────────────────
  {
    provinceCode: 'hochiminh',
    provinceName: 'TP. Hồ Chí Minh',
    regionCode: 'south',
    dishName: 'Cơm tấm sườn bì chả',
    dishDescription: 'Hạt gạo tấm thơm dẻo, miếng sườn nướng mỡ hành óng ả thơm nức mũi, bì heo trộn thính và chả trứng hấp béo bùi.',
    existingInDb: true,
    relatedKeywords: ['cơm tấm sườn bì chả Sài Gòn', 'cơm tấm đêm', 'cơm tấm sườn nướng']
  },
  {
    provinceCode: 'bariavungtau',
    provinceName: 'Bà Rịa - Vũng Tàu',
    regionCode: 'south',
    dishName: 'Bánh khọt Vũng Tàu',
    dishDescription: 'Chiếc bánh chiên khuôn giòn rụm vàng ươm nhân tôm biển tươi tôm chấy, cuốn rau xà lách cải bẹ chấm nước mắm chua ngọt.',
    existingInDb: false,
    relatedKeywords: ['bánh khọt Vũng Tàu tôm tươi', 'bánh khọt Cô Ba Vũng Tàu', 'bánh khọt giòn rụm']
  },
  {
    provinceCode: 'binhduong',
    provinceName: 'Bình Dương',
    regionCode: 'south',
    dishName: 'Gỏi măng cụt gà xé Bình Dương',
    dishDescription: 'Măng cụt Lái Thiêu xanh giòn chua ngọt trộn thịt gà ta luộc xé phay, rau răm, đậu phộng và nước mắm chua ngọt.',
    existingInDb: false,
    relatedKeywords: ['gỏi gà măng cụt Lái Thiêu', 'gỏi măng cụt Bình Dương', 'gỏi gà măng cụt chua ngọt']
  },
  {
    provinceCode: 'binhphuoc',
    provinceName: 'Bình Phước',
    regionCode: 'south',
    dishName: 'Gà thả vườn nướng đọt mây Bình Phước',
    dishDescription: 'Gà thả vườn nướng than hoa ướp muối ớt hạt điều thơm béo ngậy, ăn kèm đọt mây nướng đắng ngọt.',
    existingInDb: false,
    relatedKeywords: ['gà nướng đọt mây Bình Phước', 'gà thả vườn Bình Phước', 'gà nướng hạt điều']
  },
  {
    provinceCode: 'tayninh',
    provinceName: 'Tây Ninh',
    regionCode: 'south',
    dishName: 'Bánh tráng phơi sương cuốn thịt luộc Trảng Bàng',
    dishDescription: 'Bánh tráng phơi sương dẻo dai cuốn thịt bắp giò heo luộc, đĩa rau rừng hơn 10 loại chấm nước mắm tỏi ớt chanh.',
    existingInDb: false,
    relatedKeywords: ['bánh tráng phơi sương Trảng Bàng', 'bánh tráng cuốn thịt heo Tây Ninh', 'bánh tráng phơi sương rau rừng']
  },
  {
    provinceCode: 'dongnai',
    provinceName: 'Đồng Nai',
    regionCode: 'south',
    dishName: 'Gỏi cá Biên Hòa',
    dishDescription: 'Cá tươi sông Đồng Nai phi lê trộn thính gạo mè rang, cuốn hơn 20 loại lá thảo dược rưới nước sốt sền sệt béo cay đậm đà.',
    existingInDb: false,
    relatedKeywords: ['gỏi cá Biên Hòa Đồng Nai', 'gỏi cá Tân Mai', 'gỏi cá sông Đồng Nai']
  },
  {
    provinceCode: 'longan',
    provinceName: 'Long An',
    regionCode: 'south',
    dishName: 'Lẩu cua đồng miền Tây',
    dishDescription: 'Nồi lẩu riêu cua đồng béo ngậy vàng óng, ăn kèm tôm càng, mồng tơi, bông súng và hột vịt lộn thơm ngon.',
    existingInDb: true,
    relatedKeywords: ['lẩu cua đồng Long An', 'lẩu cua đồng miền Tây', 'lẩu riêu cua đồng tôm']
  },
  {
    provinceCode: 'tiengiang',
    provinceName: 'Tiền Giang',
    regionCode: 'south',
    dishName: 'Hủ tiếu Mỹ Tho',
    dishDescription: 'Sợi hủ tiếu dai Mỹ Tho danh tiếng chan nước súp xương hầm tôm khô thanh ngọt, tôm thịt xá xíu trứng cút đậm đà.',
    existingInDb: true,
    relatedKeywords: ['hủ tiếu Mỹ Tho Tiền Giang', 'hủ tiếu Mỹ Tho khô', 'đặc sản hủ tiếu Mỹ Tho']
  },
  {
    provinceCode: 'bentre',
    provinceName: 'Bến Tre',
    regionCode: 'south',
    dishName: 'Bánh xèo củ hũ dừa Bến Tre',
    dishDescription: 'Bánh xèo miền Tây vàng giòn rụm với nhân củ hũ dừa giòn ngọt độc đáo, tôm đất và thịt ba rọi béo thơm.',
    existingInDb: true,
    relatedKeywords: ['bánh xèo củ hũ dừa Bến Tre', 'bánh xèo củ hũ dừa tôm thịt', 'đặc sản Bến Tre']
  },
  {
    provinceCode: 'dongthap',
    provinceName: 'Đồng Tháp',
    regionCode: 'south',
    dishName: 'Hủ tiếu Sa Đéc',
    dishDescription: 'Sợi hủ tiếu bột gạo làng bột Sa Đéc dẻo dai trắng muốt, sốt trộn tôm thịt lòng heo thơm béo ăn kèm chén súp ngọt thanh.',
    existingInDb: true,
    relatedKeywords: ['hủ tiếu Sa Đéc Đồng Tháp', 'hủ tiếu khô Sa Đéc', 'hủ tiếu Sa Đéc tôm thịt']
  },
  {
    provinceCode: 'vinhlong',
    provinceName: 'Vĩnh Long',
    regionCode: 'south',
    dishName: 'Cá tai tượng chiên xù Vĩnh Long',
    dishDescription: 'Cá tai tượng tươi nguyên con chiên vàng vảy dựng giòn rụm, cuốn bánh tráng rau thơm chuối chát chấm mắm me chua ngọt.',
    existingInDb: false,
    relatedKeywords: ['cá tai tượng chiên xù Vĩnh Long', 'cá tai tượng chiên xù cuốn bánh tráng', 'đặc sản Vĩnh Long']
  },
  {
    provinceCode: 'angiang',
    provinceName: 'An Giang',
    regionCode: 'south',
    dishName: 'Bún cá Châu Đốc',
    dishDescription: 'Tô bún cá lóc đồng nấu ngải bún thơm nức, màu vàng nghệ sóng sánh ăn kèm thịt cá xào nghệ, bông điên điển và rau đắng.',
    existingInDb: false,
    relatedKeywords: ['bún cá Châu Đốc An Giang', 'bún cá lóc Châu Đốc', 'bún cá ngải bún Châu Đốc']
  },
  {
    provinceCode: 'cantho',
    provinceName: 'Cần Thơ',
    regionCode: 'south',
    dishName: 'Lẩu vịt nấu chao Cần Thơ',
    dishDescription: 'Vịt xiêm ngọt mềm ướp chao đỏ béo ngậy nấu khoai môn dẻo bùi, nhúng rau muống rau muống chấm sốt chao pha cay ngọt.',
    existingInDb: true,
    relatedKeywords: ['lẩu vịt nấu chao Cần Thơ', 'lẩu vịt xiêm nấu chao Thành Giao', 'vịt nấu chao']
  },
  {
    provinceCode: 'haugiang',
    provinceName: 'Hậu Giang',
    regionCode: 'south',
    dishName: 'Chả cá thác lác Hậu Giang',
    dishDescription: 'Cá cườm sông Hậu quết dai giòn sần sật chiên vàng thơm phức, hoặc nhúng lẩu khổ qua thanh mát ngọt đậm đà.',
    existingInDb: false,
    relatedKeywords: ['chả cá thác lác Hậu Giang', 'cá thác lác rút xương Hậu Giang', 'lẩu khổ qua chả cá thác lác']
  },
  {
    provinceCode: 'soctrang',
    provinceName: 'Sóc Trăng',
    regionCode: 'south',
    dishName: 'Bánh cóng Sóc Trăng',
    dishDescription: 'Vỏ bánh bột gạo đậu nành giòn rụm nhân thịt băm, đậu xanh bùi bùi và tôm đất nguyên con tươi ngọt trên mặt.',
    existingInDb: true,
    relatedKeywords: ['bánh cóng Sóc Trăng', 'bánh cống Sóc Trăng', 'đặc sản bánh cống']
  },
  {
    provinceCode: 'baclieu',
    provinceName: 'Bạc Liêu',
    regionCode: 'south',
    dishName: 'Bánh tằm bì nước cốt dừa',
    dishDescription: 'Bánh tằm se tay sợi to dai mềm, bì heo thính gạo rưới nước cốt dừa béo mặn ngọt hài hòa đặc trưng Bạc Liêu.',
    existingInDb: true,
    relatedKeywords: ['bánh tằm bì Bạc Liêu', 'bánh tằm bì nước cốt dừa', 'đặc sản Bạc Liêu']
  },
  {
    provinceCode: 'kiengiang',
    provinceName: 'Kiên Giang',
    regionCode: 'south',
    dishName: 'Bún kèn Kiên Giang',
    dishDescription: 'Bún cá biển xay nhuyễn nấu nước cốt dừa sả nghệ vàng óng béo thơm, ăn cùng đu đủ bào giòn và rau răm cay the.',
    existingInDb: true,
    relatedKeywords: ['bún kèn Hà Tiên Kiên Giang', 'bún kèn Phú Quốc', 'đặc sản bún kèn']
  },
  {
    provinceCode: 'travinh',
    provinceName: 'Trà Vinh',
    regionCode: 'south',
    dishName: 'Bún nước lèo Trà Vinh',
    dishDescription: 'Nước lèo nấu từ mắm bò hóc thơm dịu, cá lóc đồng và ngải bún, ăn kèm thịt heo quay giòn bì và bắp chuối thái mỏng.',
    existingInDb: false,
    relatedKeywords: ['bún nước lèo Trà Vinh', 'bún nước lèo mắm bò hóc', 'bún nước lèo heo quay Trà Vinh']
  },
  {
    provinceCode: 'camau',
    provinceName: 'Cà Mau',
    regionCode: 'south',
    dishName: 'Cua Cà Mau rang me',
    dishDescription: 'Cua biển Năm Căn Cà Mau nổi tiếng thịt chắc nịch gạch son béo ngậy xào sốt me chua ngọt đậm đà chấm bánh mì nóng giòn.',
    existingInDb: false,
    relatedKeywords: ['cua Cà Mau rang me', 'cua biển Năm Căn sốt me', 'cua Cà Mau']
  }
];

async function main() {
  console.log(`=== BẢNG PHÂN BỔ 63 MÓN ĐẶC SẢN ĐẠI DIỆN CHO 63 TỈNH THÀNH VIỆT NAM ===\n`);
  console.log(`Tổng số món lập kế hoạch: ${VIETNAM_63_SPECIALTIES.length}`);

  const existingDishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, provinceId: true }
  });
  const dishMap = new Map(existingDishes.map(d => [d.name.toLowerCase().trim(), d]));

  let matchedExisting = 0;
  let needToImport = 0;

  for (const s of VIETNAM_63_SPECIALTIES) {
    const province = await prisma.province.findFirst({
      where: { code: s.provinceCode }
    });
    if (!province) {
      console.log(`❌ Không tìm thấy tỉnh thành: ${s.provinceCode} (${s.provinceName})`);
      continue;
    }

    const inDb = dishMap.get(s.dishName.toLowerCase().trim());
    if (inDb) {
      matchedExisting++;
      console.log(`✅ [ĐÃ CÓ] ${s.provinceName} -> "${s.dishName}" (Dish ID: ${inDb.id})`);
    } else {
      needToImport++;
      console.log(`🆕 [CẦN NHẬP MỚI] ${s.provinceName} -> "${s.dishName}" (${s.dishDescription})`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`TỔNG KẾT BẢNG MÓN 63 TỈNH THÀNH:`);
  console.log(`- Đã có sẵn trong hệ thống: ${matchedExisting} món (chỉ cần gán chuẩn provinceId)`);
  console.log(`- Cần nhập mới qua AI Import pipeline: ${needToImport} món`);
  console.log(`======================================================`);
}

main().finally(() => prisma.$disconnect());
