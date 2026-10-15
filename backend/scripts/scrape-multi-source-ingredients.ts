/**
 * Unified Multi-Source Ingredient Scraper & Importer for Mogu
 *
 * Scrapes and aggregates culinary ingredients from:
 * 1. WinMart / WinCommerce (api-crownx.winmart.vn) — fresh meat, produce, spices, essentials
 * 2. Bách Hóa Xanh (bachhoaxanh.com) — regional produce, fresh greens, seafood, local seasonings
 * 3. Vietnam Food Composition Table 2007 (Viện Dinh Dưỡng Quốc Gia) — authentic nutrition & English names
 * 4. Masterlist of Vietnamese Culinary Herbs & Staples — traditional aromatic herbs and pantry staples
 *
 * Cleans brand names, packaging, weights, origin fluff; deduplicates across sources into generic
 * culinary ingredients; assigns allergen codes and standard units; imports to PostgreSQL `ingredients`.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/scrape-multi-source-ingredients.ts [--dry-run] [--from-cache]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  IngredientStatus,
  IngredientCreatedVia,
  IngredientImageStatus,
} from '@prisma/client';
import { VIETNAM_FCT_2007 } from '../src/ai-import/nutrition/vietnam-fct-2007.data';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = path.join(__dirname, '../data');
const WINMART_RAW_CACHE = path.join(DATA_DIR, 'winmart-raw-products.json');
const BHX_RAW_CACHE = path.join(DATA_DIR, 'bhx-raw-products.json');
const MULTI_CLEAN_EXPORT = path.join(DATA_DIR, 'multi-source-clean-ingredients.json');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RawScrapedProduct {
  source: 'WINMART' | 'BHX' | 'VIETNAM_FCT' | 'MASTERLIST';
  externalId: string;
  name: string;
  fullName: string;
  brandName?: string;
  categoryName: string;
  groupLabel: string;
  unit: string;
  price?: number;
  imageUrl?: string;
  url?: string;
  nutrition?: {
    fctCode?: string;
    nameEn?: string;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sodiumMg: number;
  };
}

export interface CleanIngredientRecord {
  cleanName: string;
  nameEn?: string;
  identityNormalized: string;
  searchFolded: string;
  groupLabel: string;
  unit: string;
  allergenCode: string | null;
  imageUrl?: string;
  synonyms: string[];
  sources: string[];
  nutrition?: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sodiumMg: number;
  };
  samplePrices: { source: string; price: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN BRANDS & ORIGINS FOR VIETNAMESE FOOD CLEANING
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_BRANDS = [
  'MEATDELI',
  'MEAT DELI',
  'WINECO',
  'WIN-ECO',
  'WINMART GOOD',
  'WINMART HOME',
  'WINMART',
  'C.P',
  'C.P.',
  'CP',
  'MVP',
  'HDC',
  'KIAORA',
  'PACOW',
  'NATUR FISH',
  'CHOLIMEX',
  'CHINSU',
  'CHIN-SU',
  'DH FOODS',
  'MAGGI',
  'ÔNG CHÀ VÀ',
  'ONG CHA VA',
  'BARONA',
  'SG FOOD',
  'MEIZAN',
  'NEPTUNE',
  'NAM NGƯ',
  'NAM NGU',
  'KNORR',
  'AJI-NGON',
  'AJI-QUICK',
  'AJI-MAYO',
  'AJINOMOTO',
  'TƯỜNG AN',
  'TUONG AN',
  'VISSAN',
  'G KITCHEN',
  'HƯƠNG SEN',
  'ĐÀ LẠT GAP',
  'DALAT GAP',
  'BA HUÂN',
  'BA HUAN',
  'VĨNH THÀNH ĐẠT',
  'SIMPLY',
  'COOKY',
  'LEE KUM KEE',
  'GUYUMI',
  'BÁCH HOÁ XANH',
  'BÁCH HÓA XANH',
  'BHX',
  'CÂY THỊ',
  'VIỆT SIN',
  'VIFON',
  'THIÊN THÀNH',
  'VEDAN',
  'MIWON',
  'COZY',
  'ĐỨC VIỆT',
  'VINAMILK',
  'TH TRUE MILK',
  'TH TRUE',
  'MỘC CHÂU',
  'HẢI CHÂU',
  'HƯNG PHÁT',
  'KIM HƯNG',
  'HẢO HẢO',
  'OMACHI',
  'VIANCO',
  'THANH HÀ',
  'BIÊN HÒA',
  'NAKYDACO',
  'NAM DƯƠNG',
  'NAM DUONG',
  'THUẬN PHÁT',
  'THUAN PHAT',
  'VINABEE',
  'BARILLA',
  'NOBRAND',
  'MR.VIET',
  'LIX',
  'SAN HÀ',
  'SANHA',
  'CẦU TRE',
  'CAU TRE',
  'HẠ LONG',
  'HA LONG',
  'ACECOOK',
  'BÍCH CHI',
  'SA GIANG',
  'KOKOMI',
  'DABACO',
  '729 BA VÌ',
  'BA VÌ',
  'HAIDILAO',
  'HANUFOOD',
  'VIETCOCO',
  'AMUR PEARL',
  'LISA',
  'ORIFOOD',
  'ACEFOODS',
  'THIÊN NHIÊN XANH',
  'TINH NGUYÊN',
  'BÔNG LÚA VÀNG',
  'HOÀNG GIA',
  'SAFOCO',
  'THIÊN Ý',
  'A TUẤN KHANG',
  "O'FOOD",
  'OFOOD',
  'YOUNG POONG',
  'JIM WILLIE',
  'KEWPIE',
  'KIKKOMAN',
  'KIDDY',
  'LÊ GIA',
  'HẠNH PHÚC',
  'HỒNG HẠNH',
  'KHẢI HOÀN',
  'KIM BÔI',
  'MINH HÀ',
  'MINH TIẾN',
  'OATTA',
  'OLIVOILÀ',
  'OTOKI',
  'PHÚ HƯƠNG',
  'PHÚC THỊNH',
  'S&B',
  'SEMPIO',
  'SLOBODA',
  'TASAMI',
  'THABIFOOD',
  'THANH QUỐC',
  'THU DUNG',
  'TOHOGENKAI',
  'VINAFOOD1',
  'VINASEED',
  'VIPEP',
  'VISACO',
  'XUÂN AN',
  'ĐÔI ĐŨA VÀNG',
  'ĐỆ NHẤT',
  'CUNG ĐÌNH',
  'BẢO MINH',
  'BIBIGO',
  'BIOVEGI',
  'CÁI LÂN',
  'DUYẾN HẢI',
  'GOLDEN FARM',
  'GREEN WORLD',
  'HANOLI',
  'HAUSUBI',
  'HEINZ',
  'HERMESETAS',
  'HOA DOANH',
  'HOME FOOD',
  'ICHIBAN',
  'LC FOOD',
  'LENGER',
  'LÝ TƯỞNG',
  'NGỌC NƯƠNG',
  'ORCHID',
  'SONKA',
  'STFOOD',
  'SWALLOWGLOBE',
  'CALBEE',
  'CHUNGJUNGONE',
  'FROOT LOOPS',
  'GODBAWEE',
  'HONEY STARS',
  'HUMANWELL',
  'KRUNCH',
  'LATINO BELLA',
  'MAMRUKO',
  'MAMRUKOVSKOE',
  "KELLOGG'S",
  'O’LALA',
  'ÔNG KỲ',
  'THIÊN VƯƠNG',
  'ACE FOODS',
  'NESTLÉ',
  'DAESANG',
  'OTTOGI',
  'DASOL KIM',
  'GLOBALGAP',
  'VIETGAP',
  'LC FOODS',
  'DHFONT NATURAL',
  'DHFOODS',
  'DH FOOD',
  'KIMNORI',
  'THAIBIFOOD',
  'SLIM&FIT',
  'MEAT',
];

const KNOWN_ORIGINS = [
  'Nam Mỹ',
  'Đà Lạt',
  'Bến Tre',
  'Bạc Liêu',
  'Phú Quốc',
  'Na Uy',
  'Úc',
  'New Zealand',
  'Hàn Quốc',
  'Nhật Bản',
  'Thái Lan',
  'Đồng Tháp',
  'Bình Dương',
  'Hà Nội',
  'Sài Gòn',
  'Tây Bắc',
  'Mộc Châu',
  'Singapore',
  'Việt Nam',
];

// ─────────────────────────────────────────────────────────────────────────────
// DATA CLEANING & NORMALIZATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class MultiSourceCleaner {
  static cleanRawName(raw: string, brandName?: string): string {
    let s = raw || '';

    // 1. Bỏ phần trong ngoặc vuông và ngoặc đơn
    s = s.replace(/\[.*?\]/g, ' ');
    s = s.replace(/\(.*?\)/g, ' ');

    // 2. Bỏ các tiền tố combo / quảng cáo / lốc
    s = s.replace(
      /^(combo|khuyến mãi|tặng kèm|tiết kiệm|set|khay mix|gói mix|thùng|lốc\s*\d*)\b[^\n-]*/i,
      '',
    );
    s = s.replace(/(?<!\p{L})lốc\s*\d*\s*(gói|hộp|chai|lon|cây)?(?!\p{L})/giu, ' ');

    // 3. Chuẩn hóa hạt nêm từ thịt thăn -> Hạt nêm
    s = s.replace(/(?<!\p{L})từ thịt thăn[^\n]*/giu, ' ');

    // 4. Bỏ thương hiệu cụ thể từ sản phẩm (nếu có)
    if (brandName && brandName !== 'NOBRAND') {
      const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const bRegex = new RegExp(`(?<!\\p{L})${escapedBrand}(?!\\p{L})`, 'giu');
      s = s.replace(bRegex, ' ');
    }

    // 5. Bỏ tên các thương hiệu đã biết
    for (const b of KNOWN_BRANDS) {
      const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      s = s.replace(regex, ' ');
    }

    // 6. Bỏ xuất xứ địa danh (trừ 'Bắp Mỹ')
    for (const o of KNOWN_ORIGINS) {
      const escaped = o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      s = s.replace(regex, ' ');
    }
    s = s.replace(/(?<!bắp\s+)Mỹ(?!\p{L})/giu, ' ');

    // 7. Bỏ size và số đếm quy cách tôm/thịt/trái cây (vd: size 31 40, 16 20, 90 110)
    s = s.replace(/(?<!\p{L})size\s*\d*(\s*\d*)?(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})\d+\s*[-/]\s*\d+(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})(pet|tuýp|can|lọ|hũ|gói|chai|vỉ|khay|thanh|thùng|túi|hộp|giỏ|bát|ly|lưới)(?!\p{L})/giu, ' ');

    // 8. Bỏ khối lượng, thể tích, quy cách đóng gói
    s = s.replace(
      /(?<!\p{L})(khay|túi|hộp|gói|vỉ|chai|hũ|lon|bịch|thanh|thùng|nải|lọ|can|giỏ|bát|ly)\s+\d+([.,]\d+)?\s*(kg|g|gr|gram|ml|l|lít|lit|viên|quả|trái|con)?(?!\p{L})/giu,
      ' ',
    );
    s = s.replace(/(?<!\p{L})\d+([.,]\d+)?\s*(kg|g|gr|gram|ml|l|lít|lit)(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})vỉ\s+\d+\s*(quả|trái|trứng)?(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})\d+\s*(trái|quả|củ|bắp|con|%)(?!\p{L})/giu, ' ');

    // 9. Bỏ các thuật ngữ tiếp thị, cắt lát, quy cách
    s = s.replace(
      /(?<!\p{L})(cắt lát|cắt sẵn|thái lát|xắt lát|xay tươi|xay sẵn|ướp sẵn|nõn tự nhiên|bóc nõn|tự nhiên|tươi ngon|tươi sạch|tươi sống|tươi|sạch|hảo hạng|thượng hạng|loại 1|loại 2|loại đặc biệt|nhập khẩu|đông lạnh|thủy canh|hữu cơ|organic|an toàn|chế biến sẵn|hàng ngày|ngon|chín đỏ|vắt nước|không hạt|giống nhật|thảo mộc|thả vườn|nguyên con|làm sạch|nguyên chất|đậm đặc|tinh luyện|tinh khiết|sấy|sống|lớn|nhỏ|vừa|siêu mỏng|dày|chuyên dụng|pha sẵn|không biến đổi gen|lên men|chấm sốt sukiyaki|cắt cuộn|5 dưỡng chất|chuẩn)(?!\p{L})/giu,
      ' ',
    );
    s = s.replace(/(?<!bột\s+|bắp\s+|ngô\s+)ngọt(?!\p{L})/giu, ' ');

    // 9. Bỏ các từ tiếng Anh mô tả phần thịt hoặc phụ trợ
    s = s.replace(/(?<!\p{L})(flank|chuck|ribeye|sirloin|brisket|tenderloin|shank|tokpokki|topokki|light)(?!\p{L})/giu, ' ');

    // 10. Dọn dẹp khoảng trắng, dấu gạch nối và ký tự đặc biệt
    s = s
      .replace(/[-–—_+/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 11. Chuẩn hóa danh từ ẩm thực Việt Nam
    if (/^muối tinh\b/i.test(s)) s = 'Muối tinh';
    if (/^bột ngọt\b/i.test(s)) s = 'Bột ngọt';
    if (/^hạt nêm\b/i.test(s)) s = 'Hạt nêm';
    if (/^bột canh\b/i.test(s)) s = 'Bột canh';
    if (/^cary\b/i.test(s) || /cary$/i.test(s)) s = s.replace(/cary/gi, 'cà ri');
    if (/^tiêu đen\b/i.test(s)) s = 'Tiêu đen';
    if (/^tiêu sọ\b/i.test(s) || /^tiêu trắng\b/i.test(s)) s = 'Tiêu sọ';
    if (/^nước mắm\b/i.test(s)) s = 'Nước mắm';
    if (/^nước tương\b/i.test(s)) s = 'Nước tương';
    if (/^dầu ăn\b/i.test(s)) s = 'Dầu ăn';
    if (/^dầu hào\b/i.test(s)) s = 'Dầu hào';
    if (/^bánh đa nem\b/i.test(s)) s = 'Bánh đa nem';
    if (/^bánh đa cua\b/i.test(s)) s = 'Bánh đa cua';
    if (/^bánh tráng\b/i.test(s)) s = 'Bánh tráng';
    if (/^bánh phở khô\b/i.test(s)) s = 'Bánh phở khô';
    if (/^dấm gạo\b/i.test(s) || /^giấm gạo\b/i.test(s)) s = 'Giấm gạo';
    if (/^cốt lẩu tomyum\b/i.test(s)) s = 'Cốt lẩu Tomyum';
    if (/^bột chiên giòn\b/i.test(s)) s = 'Bột chiên giòn';
    if (/^bột tẩm khô chiên giòn\b/i.test(s)) s = 'Bột tẩm khô chiên giòn';
    if (/^bột tàu hủ\b/i.test(s)) s = 'Bột tàu hũ';
    if (/^trứng gà\b/i.test(s) && !/so\b/i.test(s)) s = 'Trứng gà';
    if (/^ba chỉ bò\b/i.test(s)) s = 'Ba chỉ bò';
    if (/^bắp cải trái tim\b/i.test(s)) s = 'Bắp cải trái tim';
    if (/^bột làm thạch\b/i.test(s) || /^bột rau câu\b/i.test(s)) s = 'Bột rau câu';
    if (/^bánh gạo\b/i.test(s)) s = 'Bánh gạo Hàn Quốc';
    if (/^tôm sú\b/i.test(s)) s = 'Tôm sú';
    if (/^tôm thẻ\b/i.test(s)) s = 'Tôm thẻ';
    if (/^tôm thịt\b/i.test(s)) s = 'Tôm thịt';
    if (/^cá basa cá tra\b/i.test(s)) s = 'Cá basa';
    if (/^cá rô phi cá diêu hồng\b/i.test(s)) s = 'Cá rô phi';
    if (/^cá trê cá bống\b/i.test(s)) s = 'Cá trê';
    if (/^tương ớt\b/i.test(s)) s = 'Tương ớt';
    if (/^tương cà\b/i.test(s)) s = 'Tương cà';
    if (/^dầu mè\b/i.test(s)) s = 'Dầu mè';
    if (/^xốt mayonnaise\b/i.test(s)) s = 'Xốt mayonnaise';
    if (/^ức gà\b/i.test(s)) s = 'Ức gà';

    // Xóa số lẻ ở cuối tên
    s = s.replace(/\s+\d+$/g, '').trim();

    // 12. Chuẩn hóa chữ hoa đầu từ
    if (s.length > 1) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }

    return s;
  }

  static refineGroupLabel(cleanName: string, defaultGroup: string): string {
    const lower = cleanName.toLowerCase();

    // Bánh đa / Bánh phở / Nông sản ngũ cốc
    if (/^bánh đa\b/i.test(cleanName) || /^bánh phở\b/i.test(cleanName) || /^bánh tráng\b/i.test(cleanName)) {
      return 'Nông sản & ngũ cốc';
    }

    // Thủy hải sản
    if (
      /(?<!\p{L})(cá|tôm|cua|mực|nghêu|sò|ốc|hến|ghẹ|hàu|bạch tuộc|chả cá|chả cua|tép|chả ốc|bào ngư)(?!\p{L})/iu.test(
        lower,
      ) &&
      !/(?<!\p{L})(dưa hấu|tiêu sọ|bánh phồng tôm|bánh đa cua)(?!\p{L})/iu.test(lower)
    ) {
      return 'Thủy hải sản';
    }

    // Thịt
    if (
      /(?<!\p{L})(thịt|heo|lợn|bò|gà|vịt|ngan|ngỗng|sườn|ba chỉ|ba rọi|bắp giò|chân giò|tai heo|tim heo|mề gà|da heo|gân bò|xương heo|xương bò|giò lụa|chả lụa|xúc xích|thịt xay|bít tết)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Thịt';
    }

    // Rau củ
    if (
      /(?<!\p{L})(bắp cải|bắp chuối|bí đao|bí đỏ|bí xanh|bầu|mướp|khổ qua|cà chua|cà tím|cà pháo|cải|rau|xà lách|su hào|su su|súp lơ|bông cải|đậu que|đậu bắp|đậu cô ve|đậu đũa|măng|dưa leo|dưa chuột|hành lá|ngò|húng|tía tô|kinh giới|lá lốt|cần tây|rau muống|rau ngót|mồng tơi|khoai tây|khoai lang|khoai môn|khoai sọ|cà rốt|củ cải|bông bí|bông điên điển|sả|nghệ|riềng|gừng|tỏi|hành tây|hành tím)(?!\p{L})/iu.test(
        lower,
      ) &&
      !/(?<!\p{L})(bánh|kẹo|dầu|nước)(?!\p{L})/iu.test(lower)
    ) {
      return 'Rau củ';
    }

    // Trái cây
    if (
      /(?<!\p{L})(cam|quýt|bưởi|chanh|chuối|táo|nho|dưa hấu|xoài|thanh long|ổi|đu đủ|dứa|thơm|khóm|chôm chôm|măng cụt|sầu riêng|mận|mơ|chanh dây|kiwi|dâu tây|bơ sáp|bơ 034|lê|vú sữa|hồng xiêm)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Trái cây';
    }

    // Bột & phụ gia
    if (
      /(?<!\p{L})(bột mì|bột năng|bột gạo|bột bắp|bột nếp|bột chiên|bột sắn|bột nở|bột rau câu|bột thạch|bột tàu hũ|bột bánh xèo|bột bánh rán|men nở)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Bột & phụ gia';
    }

    // Nông sản & ngũ cốc
    if (
      /(?<!\p{L})(bánh đa|bánh phở|bánh tráng|bánh phồng tôm|bún khô|miến|hủ tiếu|mì ý|nui|gạo|yến mạch|ngũ cốc|rong biển|tảo biển|hạt sen)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Nông sản & ngũ cốc';
    }

    // Dầu ăn & mỡ
    if (
      /(?<!\p{L})(dầu ăn|dầu đậu nành|dầu gạo|dầu hướng dương|dầu mè|dầu oliu|dầu dừa|dầu hạt cải|dầu hào|mỡ heo|bơ thực vật)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Dầu ăn & mỡ';
    }

    // Gia vị & nước chấm
    if (
      /(?<!\p{L})(bột canh|hạt nêm|bột ngọt|nước mắm|nước tương|xì dầu|muối|đường|tiêu|giấm|dấm|tương ớt|tương cà|tương đen|chao|mắm tôm|mắm ruốc|mắm nêm|sa tế|cốt lẩu|sốt)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Gia vị & nước chấm';
    }

    // Trứng & sữa
    if (
      /(?<!\p{L})(trứng gà|trứng vịt|trứng cút|lòng đỏ|lòng trắng|sữa tươi|sữa đặc|sữa chua|phô mai|pho mai)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'Trứng & sữa';
    }

    return defaultGroup;
  }

  static identityNormalized(name: string): string {
    return name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  static searchFolded(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  static slugCode(name: string): string {
    const base = this.searchFolded(name)
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base.substring(0, 80)}-${suffix}`;
  }

  static normalizeUnit(rawUnit: string, cleanName: string, groupLabel: string): string {
    const u = (rawUnit || '').trim().toLowerCase();
    const lowerClean = cleanName.toLowerCase();

    if (groupLabel === 'Thịt' || groupLabel === 'Thủy hải sản') {
      return 'KG';
    }

    if (/(trứng|hột)/i.test(lowerClean)) {
      return 'QUẢ';
    }

    if (/(hành lá|ngò|rau muống|rau cải|rau mồng tơi|rau đay|xà lách|cần tây)/i.test(lowerClean)) {
      return 'BÓ';
    }

    if (/(củ|tỏi|hành tây|khoai|gừng|riềng|cà rốt|củ cải)/i.test(lowerClean)) {
      return 'CỦ';
    }

    if (/(trái|quả|bí|mướp|cà tím|cà chua|chanh|ớt|bắp)/i.test(lowerClean)) {
      return 'QUẢ';
    }

    if (/(dầu|nước mắm|nước tương|giấm)/i.test(lowerClean)) {
      return 'ML';
    }

    if (/(đậu hũ|tàu hũ)/i.test(lowerClean)) {
      return 'MIẾNG';
    }

    if (u === 'kg' || u === 'kilogram') return 'KG';
    if (u === 'g' || u === 'gr' || u === 'gram') return 'G';
    if (u === 'trái' || u === 'quả') return 'QUẢ';
    if (u === 'củ') return 'CỦ';
    if (u === 'bó') return 'BÓ';
    if (u === 'tép') return 'TÉP';
    if (u === 'gói') return 'GÓI';
    if (u === 'chai') return 'CHAI';
    if (u === 'hũ' || u === 'lọ') return 'HŨ';

    return 'G';
  }

  static detectAllergen(cleanName: string): string | null {
    const lower = cleanName.toLowerCase();

    // Hải sản (chú ý trừ 'dưa hấu' và 'tiêu sọ')
    if (
      /(?<!\p{L})(tôm|cua|cá|mực|bạch tuộc|nghêu|sò|ốc|hến|ghẹ|hàu|ruốc|tép|chả cá|mắm tôm|mắm ruốc|mắm nêm)(?!\p{L})/iu.test(
        lower,
      ) &&
      !/(?<!\p{L})(dưa hấu|tiêu sọ)(?!\p{L})/iu.test(lower)
    ) {
      return 'SEAFOOD';
    }

    // Trứng
    if (/(?<!\p{L})(trứng|lòng đỏ|lòng trắng)(?!\p{L})/iu.test(lower)) {
      return 'EGG';
    }

    // Đậu nành
    if (
      /(?<!\p{L})(đậu nành|đậu hũ|đậu phụ|tàu hũ|chao|nước tương|xì dầu|tương bần|tương hột)(?!\p{L})/iu.test(
        lower,
      )
    ) {
      return 'SOY';
    }

    // Đậu phộng / Lạc
    if (/(?<!\p{L})(đậu phộng|lạc|bơ đậu phộng)(?!\p{L})/iu.test(lower)) {
      return 'PEANUT';
    }

    // Mè / Vừng
    if (/(?<!\p{L})(mè|vừng|dầu mè)(?!\p{L})/iu.test(lower)) {
      return 'SESAME';
    }

    // Bơ / Sữa: Kiểm tra chuỗi có dấu để không bao giờ nhầm "bò" với "bơ"!
    if (
      /(?<!\p{L})(sữa|bơ|phô mai|pho mai)(?!\p{L})/iu.test(lower) &&
      !/(?<!\p{L})(bò|thịt bò|bắp bò|gân bò|nạm bò|thăn bò|ba chỉ bò|bò viên)(?!\p{L})/iu.test(lower)
    ) {
      return 'DAIRY';
    }

    // Gluten
    if (/(?<!\p{L})(bột mì|mì căn|bánh mì)(?!\p{L})/iu.test(lower)) {
      return 'GLUTEN';
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WINMART CRAWLER
// ─────────────────────────────────────────────────────────────────────────────

const WINMART_CATEGORIES = [
  { slug: 'thit--c0111', groupLabel: 'Thịt', name: 'Thịt tươi sống' },
  { slug: 'hai-san--c0113', groupLabel: 'Thủy hải sản', name: 'Hải sản tươi' },
  { slug: 'rau-la--c01167', groupLabel: 'Rau củ', name: 'Rau Lá' },
  { slug: 'cu-qua--c01168', groupLabel: 'Rau củ', name: 'Củ, Quả' },
  { slug: 'trai-cay-tuoi--c01173', groupLabel: 'Trái cây', name: 'Trái cây tươi' },
  { slug: 'trung--c01165', groupLabel: 'Trứng & sữa', name: 'Trứng' },
  { slug: 'dau-hu--c01138', groupLabel: 'Đậu & hạt', name: 'Đậu hũ' },
  { slug: 'gao-nong-san-kho--c0120', groupLabel: 'Nông sản & ngũ cốc', name: 'Gạo & Nông sản khô' },
  { slug: 'bot-cac-loai--c0125', groupLabel: 'Bột & phụ gia', name: 'Bột Các Loại' },
  { slug: 'dau-an--c01149', groupLabel: 'Dầu ăn & mỡ', name: 'Dầu Ăn' },
  { slug: 'nuoc-mam-nuoc-cham--c01150', groupLabel: 'Gia vị & nước chấm', name: 'Nước Mắm & Nước Chấm' },
  { slug: 'duong--c01151', groupLabel: 'Gia vị & nước chấm', name: 'Đường' },
  { slug: 'nuoc-tuong--c01152', groupLabel: 'Gia vị & nước chấm', name: 'Nước Tương' },
  { slug: 'hat-nem--c01153', groupLabel: 'Gia vị & nước chấm', name: 'Hạt Nêm' },
  { slug: 'tuong-cac-loai--c01154', groupLabel: 'Gia vị & nước chấm', name: 'Tương Các Loại' },
  { slug: 'gia-vi-khac--c01155', groupLabel: 'Gia vị & nước chấm', name: 'Gia Vị Khác' },
  { slug: 'hai-san-dong-lanh--c0157', groupLabel: 'Thủy hải sản', name: 'Hải Sản Đông Lạnh' },
  { slug: 'thit-dong-lanh--c01158', groupLabel: 'Thịt', name: 'Thịt Đông Lạnh' },
  { slug: 'mien-hu-tiu-banh-canh--c01148', groupLabel: 'Nông sản & ngũ cốc', name: 'Miến, Hủ tíu, Bánh canh' },
  { slug: 'pho-bun--c01147', groupLabel: 'Nông sản & ngũ cốc', name: 'Phở & Bún' },
  { slug: 'rong-bien-tao-bien--c0124', groupLabel: 'Nông sản & ngũ cốc', name: 'Rong Biển & Tảo Biển' },
  { slug: 'ngu-coc-yen-mach--c0122', groupLabel: 'Nông sản & ngũ cốc', name: 'Ngũ Cốc & Yến Mạch' },
];

export async function scrapeWinMart(useCache = false): Promise<RawScrapedProduct[]> {
  if (useCache && fs.existsSync(WINMART_RAW_CACHE)) {
    console.log(`✓ Đọc dữ liệu WinMart từ file cache: ${WINMART_RAW_CACHE}`);
    return JSON.parse(fs.readFileSync(WINMART_RAW_CACHE, 'utf-8'));
  }

  console.log('\n======================================================');
  console.log('   BẮT ĐẦU CÀO DỮ LIỆU TỪ WINMART (api-crownx.winmart.vn)  ');
  console.log('======================================================');

  const products: RawScrapedProduct[] = [];
  const seenIds = new Set<string>();

  for (const cat of WINMART_CATEGORIES) {
    console.log(`\n→ Cào danh mục WinMart: [${cat.name}] (${cat.slug})...`);
    let pageNumber = 1;
    let totalPages = 1;
    let catItems = 0;

    while (pageNumber <= totalPages && pageNumber <= 10) {
      const url = `https://api-crownx.winmart.vn/it/api/web/v3/item/category?orderByDesc=true&pageNumber=${pageNumber}&pageSize=50&slug=${cat.slug}&storeCode=1535&storeGroupCode=1998`;
      try {
        const resp = await fetch(url, {
          headers: {
            'user-agent': USER_AGENT,
            accept: 'application/json, text/plain, */*',
            referer: 'https://winmart.vn/',
          },
        });

        if (!resp.ok) {
          console.warn(`  ! WinMart response status ${resp.status} for ${cat.slug} page ${pageNumber}`);
          break;
        }

        const json = await resp.json();
        totalPages = json.paging?.totalPages || 1;
        const items = json.data?.items || [];

        for (const item of items) {
          if (!item.name || seenIds.has(item.id)) continue;
          seenIds.add(item.id);

          products.push({
            source: 'WINMART',
            externalId: item.id,
            name: item.name.trim(),
            fullName: (item.description || item.shortDescription || item.name).trim(),
            brandName: item.brandName !== 'NOBRAND' ? item.brandName : undefined,
            categoryName: cat.name,
            groupLabel: cat.groupLabel,
            unit: item.uomName || 'G',
            price: item.salePrice || item.price,
            imageUrl: item.mediaUrl,
            url: `https://winmart.vn/${item.seoName}`,
          });
          catItems++;
        }
      } catch (err: any) {
        console.warn(`  ! Lỗi cào ${cat.slug} page ${pageNumber}:`, err.message);
        break;
      }

      pageNumber++;
      await sleep(300);
    }

    console.log(`  ✓ Đã thu thập ${catItems} sản phẩm từ danh mục [${cat.name}]`);
  }

  fs.writeFileSync(WINMART_RAW_CACHE, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`\n✓ Đã lưu ${products.length} sản phẩm thô WinMart vào: ${WINMART_RAW_CACHE}`);
  return products;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACH HOA XANH LOADER / INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

export function loadBhxProducts(): RawScrapedProduct[] {
  if (!fs.existsSync(BHX_RAW_CACHE)) {
    console.warn(`! Không tìm thấy cache BHX tại ${BHX_RAW_CACHE}`);
    return [];
  }

  const rawList: any[] = JSON.parse(fs.readFileSync(BHX_RAW_CACHE, 'utf-8'));
  console.log(`✓ Tải ${rawList.length} sản phẩm Bách Hóa Xanh từ cache...`);

  return rawList.map((p) => ({
    source: 'BHX',
    externalId: String(p.id),
    name: p.name,
    fullName: p.fullName || p.name,
    brandName: p.brandName,
    categoryName: p.cateName,
    groupLabel: p.groupLabel,
    unit: p.unit || 'Kg',
    price: p.price,
    imageUrl: p.avatar,
    url: p.url ? `https://www.bachhoaxanh.com${p.url}` : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// VIETNAM FCT 2007 (VIỆN DINH DƯỠNG QUỐC GIA) LOADER
// ─────────────────────────────────────────────────────────────────────────────

export function loadVietnamFctProducts(): RawScrapedProduct[] {
  console.log(`✓ Tải ${VIETNAM_FCT_2007.length} thực phẩm chuẩn từ Bảng Thành phần Thực phẩm Việt Nam 2007 (Viện Dinh Dưỡng)...`);

  return VIETNAM_FCT_2007.map((fct) => {
    let group = 'Rau củ';
    const codePrefix = fct.fctCode.split('.')[0];
    if (codePrefix === '1') group = 'Nông sản & ngũ cốc';
    else if (codePrefix === '2') group = 'Đậu & hạt';
    else if (codePrefix === '3') group = 'Rau củ';
    else if (codePrefix === '4') group = 'Trái cây';
    else if (codePrefix === '5') group = 'Dầu ăn & mỡ';
    else if (codePrefix === '6') group = 'Thủy hải sản';
    else if (codePrefix === '7') group = 'Thịt';
    else if (codePrefix === '8') group = 'Trứng & sữa';
    else if (codePrefix === '9') group = 'Gia vị & nước chấm';

    return {
      source: 'VIETNAM_FCT',
      externalId: fct.fctCode,
      name: fct.nameVi,
      fullName: fct.nameEn ? `${fct.nameVi} (${fct.nameEn})` : fct.nameVi,
      categoryName: 'Viện Dinh Dưỡng Quốc Gia 2007',
      groupLabel: group,
      unit: 'G',
      nutrition: {
        fctCode: fct.fctCode,
        nameEn: fct.nameEn,
        kcal: fct.kcal,
        protein: fct.protein,
        fat: fct.fat,
        carbs: fct.carbs,
        fiber: fct.fiber,
        sodiumMg: fct.sodiumMg,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VIETNAMESE CULINARY HERBS & TRADITIONAL STAPLES MASTERLIST
// ─────────────────────────────────────────────────────────────────────────────

const VIETNAMESE_CULINARY_MASTERLIST: Array<{
  name: string;
  nameEn: string;
  groupLabel: string;
  unit: string;
  allergenCode?: string;
  imageUrl?: string;
  synonyms: string[];
}> = [
  {
    name: 'Ngò gai',
    nameEn: 'Culantro / Sawtooth herb',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Mùi tàu', 'Rau mùi tàu', 'Ngò tàu'],
    imageUrl: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/Products/8785/214300/ngo-gai-tui-100g_202607291530188989.jpg',
  },
  {
    name: 'Ngò rí',
    nameEn: 'Coriander / Cilantro',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau mùi', 'Rau ngò'],
    imageUrl: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/Products/8785/214299/ngo-ri-tui-100g_202607291530188989.jpg',
  },
  {
    name: 'Húng quế',
    nameEn: 'Thai basil',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau húng quế', 'Húng chó'],
    imageUrl: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/Products/8785/214301/hung-que-tui-100g_202607291530188989.jpg',
  },
  {
    name: 'Kinh giới',
    nameEn: 'Vietnamese balm',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau kinh giới'],
  },
  {
    name: 'Tía tô',
    nameEn: 'Perilla leaves',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Lá tía tô'],
    imageUrl: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/Products/8785/214303/tia-to-tui-100g_202607291530188989.jpg',
  },
  {
    name: 'Thì là',
    nameEn: 'Dill',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau thì là'],
  },
  {
    name: 'Rau răm',
    nameEn: 'Vietnamese coriander',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau răm tươi'],
  },
  {
    name: 'Lá lốt',
    nameEn: 'Wild betel leaf / Piper sarmentosum',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Lá lốt tươi'],
  },
  {
    name: 'Diếp cá',
    nameEn: 'Fish mint',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Rau diếp cá', 'Dấp cá'],
  },
  {
    name: 'Củ nén',
    nameEn: 'White shallot / Allium odorum',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'CỦ',
    synonyms: ['Hành tăm'],
  },
  {
    name: 'Riềng',
    nameEn: 'Galangal',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'CỦ',
    synonyms: ['Củ riềng', 'Riềng tươi'],
  },
  {
    name: 'Nghệ tươi',
    nameEn: 'Fresh turmeric',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'CỦ',
    synonyms: ['Củ nghệ vàng'],
  },
  {
    name: 'Sả cây',
    nameEn: 'Lemongrass stalks',
    groupLabel: 'Rau củ',
    unit: 'BÓ',
    synonyms: ['Sả tươi', 'Cây sả'],
    imageUrl: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/Products/8785/214305/sa-cay-tui-200g_202607291530188989.jpg',
  },
  {
    name: 'Hoa hồi',
    nameEn: 'Star anise',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'G',
    synonyms: ['Đại hồi', 'Bông hồi'],
  },
  {
    name: 'Quế chi',
    nameEn: 'Cinnamon bark',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'G',
    synonyms: ['Vỏ quế', 'Thanh quế'],
  },
  {
    name: 'Thảo quả',
    nameEn: 'Black cardamom',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'G',
    synonyms: ['Đò ho'],
  },
  {
    name: 'Sa tế',
    nameEn: 'Satay chili sauce',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    synonyms: ['Ớt sa tế'],
  },
  {
    name: 'Mắm tôm',
    nameEn: 'Fermented shrimp paste',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    allergenCode: 'SEAFOOD',
    synonyms: ['Mắm tôm Bắc'],
  },
  {
    name: 'Mắm ruốc',
    nameEn: 'Vietnamese fermented krill paste',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    allergenCode: 'SEAFOOD',
    synonyms: ['Mắm ruốc Huế'],
  },
  {
    name: 'Mắm nêm',
    nameEn: 'Fermented anchovy sauce',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'CHAI',
    allergenCode: 'SEAFOOD',
    synonyms: ['Mắm nêm pha sẵn', 'Mắm cái'],
  },
  {
    name: 'Chao trắng',
    nameEn: 'Fermented white tofu',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    allergenCode: 'SOY',
    synonyms: ['Đậu phụ nhự'],
  },
  {
    name: 'Chao đỏ',
    nameEn: 'Fermented red tofu',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    allergenCode: 'SOY',
    synonyms: ['Chao môn đỏ'],
  },
  {
    name: 'Nước dừa tươi',
    nameEn: 'Fresh coconut water',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'ML',
    synonyms: ['Nước dừa xiêm', 'Nước dừa'],
  },
  {
    name: 'Cơm mẻ',
    nameEn: 'Fermented rice batch',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'HŨ',
    synonyms: ['Mẻ chua'],
  },
  {
    name: 'Me vắt',
    nameEn: 'Tamarind pulp',
    groupLabel: 'Gia vị & nước chấm',
    unit: 'GÓI',
    synonyms: ['Me chua', 'Thịt me'],
  },
];

export function loadMasterlistProducts(): RawScrapedProduct[] {
  console.log(`✓ Tải ${VIETNAMESE_CULINARY_MASTERLIST.length} thảo mộc và gia vị cổ truyền Việt Nam...`);

  return VIETNAMESE_CULINARY_MASTERLIST.map((m) => ({
    source: 'MASTERLIST',
    externalId: m.name,
    name: m.name,
    fullName: `${m.name} (${m.nameEn})`,
    categoryName: 'Thảo mộc & Gia vị truyền thống',
    groupLabel: m.groupLabel,
    unit: m.unit,
    imageUrl: m.imageUrl,
    nutrition: {
      nameEn: m.nameEn,
      kcal: 25,
      protein: 1.5,
      fat: 0.3,
      carbs: 4.0,
      fiber: 1.2,
      sodiumMg: 10,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED AGGREGATION & DEDUPLICATION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export function aggregateAllSources(allRaw: RawScrapedProduct[]): CleanIngredientRecord[] {
  console.log(`\n--- Đang làm sạch và gom nhóm ${allRaw.length} nguyên liệu từ các nguồn ---`);
  const recordMap = new Map<string, CleanIngredientRecord>();

  for (const raw of allRaw) {
    const clean = MultiSourceCleaner.cleanRawName(raw.name, raw.brandName);

    if (!clean || clean.length < 2 || /^combo/i.test(clean)) continue;

    const refinedGroup = MultiSourceCleaner.refineGroupLabel(clean, raw.groupLabel);
    const identity = MultiSourceCleaner.identityNormalized(clean);
    const folded = MultiSourceCleaner.searchFolded(clean);
    const unit = MultiSourceCleaner.normalizeUnit(raw.unit, clean, refinedGroup);
    const allergenCode = MultiSourceCleaner.detectAllergen(clean);

    const synonymCandidate = (raw.fullName || raw.name).trim();

    if (!recordMap.has(identity)) {
      const rec: CleanIngredientRecord = {
        cleanName: clean,
        nameEn: raw.nutrition?.nameEn,
        identityNormalized: identity,
        searchFolded: folded,
        groupLabel: refinedGroup,
        unit,
        allergenCode,
        imageUrl: raw.imageUrl,
        synonyms:
          synonymCandidate && synonymCandidate.toLowerCase() !== clean.toLowerCase()
            ? [synonymCandidate]
            : [],
        sources: [raw.source],
        samplePrices: raw.price ? [{ source: raw.source, price: raw.price }] : [],
      };

      if (raw.nutrition) {
        rec.nutrition = {
          kcal: raw.nutrition.kcal,
          protein: raw.nutrition.protein,
          fat: raw.nutrition.fat,
          carbs: raw.nutrition.carbs,
          fiber: raw.nutrition.fiber,
          sodiumMg: raw.nutrition.sodiumMg,
        };
      }

      recordMap.set(identity, rec);
    } else {
      const existing = recordMap.get(identity)!;

      // Ghi nhận nguồn
      if (!existing.sources.includes(raw.source)) {
        existing.sources.push(raw.source);
      }

      // Bổ sung nameEn nếu chưa có
      if (!existing.nameEn && raw.nutrition?.nameEn) {
        existing.nameEn = raw.nutrition.nameEn;
      }

      // Bổ sung dinh dưỡng nếu nguồn này có (đặc biệt từ FCT)
      if (!existing.nutrition && raw.nutrition) {
        existing.nutrition = {
          kcal: raw.nutrition.kcal,
          protein: raw.nutrition.protein,
          fat: raw.nutrition.fat,
          carbs: raw.nutrition.carbs,
          fiber: raw.nutrition.fiber,
          sodiumMg: raw.nutrition.sodiumMg,
        };
      }

      // Ưu tiên ảnh chất lượng cao
      if (!existing.imageUrl && raw.imageUrl) {
        existing.imageUrl = raw.imageUrl;
      } else if (
        raw.imageUrl &&
        (raw.imageUrl.includes('removebg-preview') || raw.imageUrl.includes('s3-hcmc02')) &&
        !existing.imageUrl?.includes('removebg-preview')
      ) {
        existing.imageUrl = raw.imageUrl;
      }

      // Lưu giá tham khảo
      if (raw.price && !existing.samplePrices.some((p) => p.source === raw.source)) {
        existing.samplePrices.push({ source: raw.source, price: raw.price });
      }

      // Thêm synonym mới
      if (
        synonymCandidate &&
        synonymCandidate.toLowerCase() !== clean.toLowerCase() &&
        !existing.synonyms.includes(synonymCandidate) &&
        existing.synonyms.length < 6
      ) {
        existing.synonyms.push(synonymCandidate);
      }

      // Bổ sung allergen nếu nguồn mới phát hiện
      if (!existing.allergenCode && allergenCode) {
        existing.allergenCode = allergenCode;
      }
    }
  }

  const cleanList = Array.from(recordMap.values()).sort((a, b) =>
    a.cleanName.localeCompare(b.cleanName, 'vi'),
  );

  fs.writeFileSync(MULTI_CLEAN_EXPORT, JSON.stringify(cleanList, null, 2), 'utf-8');
  console.log(`✓ Đã xuất ${cleanList.length} nguyên liệu sạch vào: ${MULTI_CLEAN_EXPORT}`);

  return cleanList;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRESQL DATABASE IMPORT ENGINE
// ─────────────────────────────────────────────────────────────────────────────

async function executeDbImport(cleanItems: CleanIngredientRecord[], dryRun: boolean) {
  console.log('\n======================================================');
  console.log(`   TIẾN TRÌNH IMPORT DATABASE ${dryRun ? '(DRY-RUN - KHÔNG GHI DB)' : '(GHI VÀO DB THỰC TẾ)'}   `);
  console.log('======================================================');

  if (dryRun) {
    console.log('✓ Chế độ Dry-Run: Bỏ qua ghi vào cơ sở dữ liệu.');
    return;
  }

  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('→ Đang kết nối cơ sở dữ liệu PostgreSQL qua Prisma...');
    const existingIngredients = await prisma.ingredient.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        identityNormalized: true,
        imageUrl: true,
        synonyms: true,
      },
    });

    const existingMap = new Map<string, (typeof existingIngredients)[0]>();
    for (const ex of existingIngredients) {
      existingMap.set(ex.identityNormalized, ex);
    }

    console.log(`  (Số lượng nguyên liệu hiện tại trong DB: ${existingIngredients.length})`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of cleanItems) {
      const existing = existingMap.get(item.identityNormalized);

      const enrichmentPayload = {
        scrapedSources: item.sources,
        samplePrices: item.samplePrices,
        nutritionPer100g: item.nutrition,
        synonyms: item.synonyms,
        importedAt: new Date().toISOString(),
      };

      if (!existing) {
        const code = MultiSourceCleaner.slugCode(item.cleanName);
        await prisma.ingredient.create({
          data: {
            code,
            name: item.cleanName,
            nameEn: item.nameEn || null,
            groupLabel: item.groupLabel,
            identityNormalized: item.identityNormalized,
            searchFolded: item.searchFolded,
            unit: item.unit,
            allergenCode: item.allergenCode,
            status: IngredientStatus.PENDING_REVIEW,
            isActive: false,
            createdVia: IngredientCreatedVia.FILE_IMPORT,
            imageUrl: item.imageUrl || null,
            imageStatus: item.imageUrl
              ? IngredientImageStatus.APPROVED
              : IngredientImageStatus.NOT_REQUESTED,
            synonyms: item.synonyms,
            enrichment: enrichmentPayload as any,
          },
        });
        createdCount++;
      } else {
        const updateData: any = {};
        if (!existing.imageUrl && item.imageUrl) {
          updateData.imageUrl = item.imageUrl;
          updateData.imageStatus = IngredientImageStatus.APPROVED;
        }

        const mergedSynonyms = Array.from(
          new Set([...existing.synonyms, ...item.synonyms]),
        ).slice(0, 10);

        if (mergedSynonyms.length > existing.synonyms.length) {
          updateData.synonyms = mergedSynonyms;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.ingredient.update({
            where: { id: existing.id },
            data: updateData,
          });
          updatedCount++;
        }
      }
    }

    console.log('\n======================================================');
    console.log('            BÁO CÁO THỰC THI DATABASE                 ');
    console.log('======================================================');
    console.log(`  ✓ Số nguyên liệu MỚI được thêm vào:      ${createdCount}`);
    console.log(`  ✓ Số nguyên liệu CŨ được cập nhật ảnh/synonyms: ${updatedCount}`);
    console.log(`  ✓ Tổng nguyên liệu trong DB hiện tại:    ${existingIngredients.length + createdCount}`);
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('❌ Lỗi khi import vào PostgreSQL:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICAL REPORT
// ─────────────────────────────────────────────────────────────────────────────

function printSummaryReport(items: CleanIngredientRecord[]) {
  console.log('\n======================================================');
  console.log('       THỐNG KÊ CHI TIẾT TẬP NGUYÊN LIỆU ĐÃ LÀM SẠCH   ');
  console.log('======================================================');
  console.log(`→ Tổng số nguyên liệu sau khi gom nhóm & chuẩn hóa: ${items.length}`);

  // Phân bổ theo nhóm ngành (groupLabel)
  const groupStats: Record<string, number> = {};
  for (const it of items) {
    groupStats[it.groupLabel] = (groupStats[it.groupLabel] || 0) + 1;
  }
  console.log('\n[Phân bổ theo nhóm thực phẩm (groupLabel)]:');
  for (const [group, count] of Object.entries(groupStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${group.padEnd(25)}: ${count} nguyên liệu`);
  }

  // Phân bổ theo dị ứng
  const allergenStats: Record<string, number> = {};
  for (const it of items) {
    const code = it.allergenCode || 'NONE (An toàn)';
    allergenStats[code] = (allergenStats[code] || 0) + 1;
  }
  console.log('\n[Phân bổ nhận diện dị ứng (Allergens)]:');
  for (const [code, count] of Object.entries(allergenStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${code.padEnd(20)}: ${count} nguyên liệu`);
  }

  // Phân bổ nguồn dữ liệu
  const sourceStats: Record<string, number> = {};
  for (const it of items) {
    for (const src of it.sources) {
      sourceStats[src] = (sourceStats[src] || 0) + 1;
    }
  }
  console.log('\n[Tần suất đóng góp từ các nguồn]:');
  for (const [src, count] of Object.entries(sourceStats)) {
    console.log(`  - ${src.padEnd(20)}: ${count} lần xuất hiện`);
  }

  // Thống kê ảnh
  const withImages = items.filter((it) => !!it.imageUrl).length;
  const imgPct = ((withImages / items.length) * 100).toFixed(1);
  console.log(`\n[Tỷ lệ nguyên liệu có ảnh minh họa HD]: ${withImages}/${items.length} (${imgPct}%)`);

  // Top 15 mẫu nguyên liệu sạch
  console.log('\n[15 nguyên liệu đại diện]:');
  items.slice(0, 15).forEach((it, idx) => {
    const allergy = it.allergenCode ? ` [Dị ứng: ${it.allergenCode}]` : '';
    const imgMark = it.imageUrl ? '📷' : '❌';
    console.log(`  ${String(idx + 1).padStart(2)}. ${imgMark} ${it.cleanName.padEnd(25)} (${it.groupLabel}, ĐVT: ${it.unit})${allergy}`);
  });
  console.log('======================================================\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fromCache = args.includes('--from-cache');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 1. Cào / tải từ WinMart
  const winmartProducts = await scrapeWinMart(fromCache);

  // 2. Tải từ Bách Hóa Xanh cache
  const bhxProducts = loadBhxProducts();

  // 3. Tải từ Viện Dinh Dưỡng Quốc Gia (Vietnam FCT 2007)
  const fctProducts = loadVietnamFctProducts();

  // 4. Tải từ Masterlist Thảo mộc & Gia vị truyền thống
  const masterlistProducts = loadMasterlistProducts();

  // 5. Gom toàn bộ và khử trùng lặp
  const allRawProducts = [
    ...winmartProducts,
    ...bhxProducts,
    ...fctProducts,
    ...masterlistProducts,
  ];

  const cleanItems = aggregateAllSources(allRawProducts);

  // 6. Báo cáo thống kê
  printSummaryReport(cleanItems);

  // 7. Thực hiện import vào DB
  await executeDbImport(cleanItems, dryRun);
}

main().catch((err) => {
  console.error('Fatal error in multi-source scraper:', err);
  process.exit(1);
});
