/**
 * Script cào dữ liệu nguyên liệu từ Bách Hóa Xanh (bachhoaxanh.com)
 *
 * Chức năng:
 * 1. Cào danh mục thực phẩm tươi sống + gia vị cơ bản từ Bách Hóa Xanh.
 * 2. Cache dữ liệu thô vào `backend/data/bhx-raw-products.json`.
 * 3. Làm sạch tên (loại bỏ thương hiệu, khối lượng, combo, tính từ tiếp thị).
 * 4. Phân loại group_label, unit, và tự động nhận diện allergenCode.
 * 5. Đối soát với bảng ingredients trong PostgreSQL:
 *    - Nếu nguyên liệu đã tồn tại: bổ sung imageUrl (nếu thiếu) và cập nhật synonyms.
 *    - Nếu nguyên liệu mới: thêm vào với status = PENDING_REVIEW, isActive = false, createdVia = FILE_IMPORT.
 *
 * Cách chạy:
 *   npx ts-node -r tsconfig-paths/register scripts/scrape-bhx-ingredients.ts [--dry-run] [--from-cache]
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

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = path.join(__dirname, '../data');
const RAW_CACHE_FILE = path.join(DATA_DIR, 'bhx-raw-products.json');
const CLEAN_EXPORT_FILE = path.join(DATA_DIR, 'bhx-clean-ingredients.json');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

interface BhxCategory {
  id: number;
  url: string;
  name: string;
  groupLabel: string;
}

const TARGET_CATEGORIES: BhxCategory[] = [
  // Thịt
  { id: 8781, url: 'thit-heo', name: 'Thịt heo', groupLabel: 'Thịt' },
  { id: 8139, url: 'thit-bo', name: 'Thịt bò', groupLabel: 'Thịt' },
  { id: 8790, url: 'thit-ga', name: 'Thịt gà, vịt', groupLabel: 'Thịt' },
  // Thủy hải sản
  { id: 8782, url: 'ca-tom-muc-ech', name: 'Cá, hải sản', groupLabel: 'Thủy hải sản' },
  { id: 8400, url: 'ca-hai-san-dong-lanh', name: 'Thủy hải sản đông', groupLabel: 'Thủy hải sản' },
  // Trứng
  { id: 8783, url: 'trung', name: 'Trứng', groupLabel: 'Trứng & sữa' },
  // Rau củ quả & Nấm
  { id: 8820, url: 'rau-sach', name: 'Rau lá', groupLabel: 'Rau củ' },
  { id: 8785, url: 'cu', name: 'Củ, quả', groupLabel: 'Rau củ' },
  { id: 8779, url: 'nam-tuoi', name: 'Nấm tươi', groupLabel: 'Nấm' },
  { id: 8788, url: 'trai-cay-tuoi-ngon', name: 'Trái cây', groupLabel: 'Trái cây' },
  // Dầu ăn & Mỡ
  { id: 2286, url: 'dau-an', name: 'Dầu ăn', groupLabel: 'Dầu ăn & mỡ' },
  { id: 3465, url: 'bo', name: 'Bơ & dầu hào', groupLabel: 'Dầu ăn & mỡ' },
  // Gia vị cơ bản
  { id: 2289, url: 'nuoc-mam', name: 'Nước mắm', groupLabel: 'Gia vị & nước chấm' },
  { id: 2683, url: 'nuoc-tuong', name: 'Nước tương', groupLabel: 'Gia vị & nước chấm' },
  { id: 2804, url: 'duong', name: 'Đường', groupLabel: 'Gia vị & nước chấm' },
  { id: 2803, url: 'muoi-an', name: 'Muối', groupLabel: 'Gia vị & nước chấm' },
  { id: 2809, url: 'tieu', name: 'Tiêu, ớt bột', groupLabel: 'Gia vị & nước chấm' },
  { id: 8275, url: 'bot-gia-vi', name: 'Bột nghệ, tỏi, gia vị', groupLabel: 'Gia vị & nước chấm' },
  { id: 2806, url: 'hat-nem', name: 'Hạt nêm, bột ngọt', groupLabel: 'Gia vị & nước chấm' },
];

export interface RawBhxProduct {
  id: number;
  name: string;
  fullName: string;
  url: string;
  avatar: string;
  unit: string;
  canonical: string;
  brandName?: string;
  price?: number;
  cateId: number;
  cateUrl: string;
  cateName: string;
  groupLabel: string;
}

export interface CleanIngredientItem {
  cleanName: string;
  identityNormalized: string;
  searchFolded: string;
  groupLabel: string;
  unit: string;
  allergenCode: string | null;
  imageUrl: string;
  originalSample: {
    bhxId: number;
    rawName: string;
    fullName: string;
    brandName?: string;
    price?: number;
    url: string;
  };
  synonyms: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class BhxScraper {
  private cookieHeader = '';

  private async initSessionCookies(sampleUrl: string): Promise<void> {
    try {
      const resp = await fetch(`https://www.bachhoaxanh.com/${sampleUrl}`, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const rawCookies = resp.headers.getSetCookie?.() || [];
      const cookieMap: Record<string, string> = {
        ck_bhx_us_is_new_flow: '1',
        ck_bhx_us_deviceId: 'mogu-crawler-' + Date.now(),
      };
      for (const c of rawCookies) {
        const parts = c.split(';')[0].split('=');
        if (parts[0] && parts[1]) {
          cookieMap[parts[0].trim()] = parts[1].trim();
        }
      }
      this.cookieHeader = Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      console.log('✓ Khởi tạo session cookie Bách Hóa Xanh thành công.');
    } catch (err: any) {
      console.warn('! Cảnh báo khởi tạo cookie:', err.message);
      this.cookieHeader = 'ck_bhx_us_is_new_flow=1';
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            'user-agent': USER_AGENT,
            referer: 'https://www.bachhoaxanh.com/',
            origin: 'https://www.bachhoaxanh.com',
            cookie: this.cookieHeader,
            ...(options.headers || {}),
          },
        });
        if (res.ok) return res;
        if (res.status === 404 || res.status === 400 || res.status === 500) {
          // Co the la het trang hoac khong ho tro pagination
          return res;
        }
      } catch (err: any) {
        if (attempt === retries) throw err;
      }
      console.log(`... Thử lại (${attempt}/${retries}) cho ${url.slice(0, 70)}`);
      await sleep(2000 * attempt);
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  async scrapeAllCategories(): Promise<RawBhxProduct[]> {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    await this.initSessionCookies('thit-heo');

    const allProducts: RawBhxProduct[] = [];
    const seenIds = new Set<number>();

    for (const cate of TARGET_CATEGORIES) {
      console.log(`\n▶ Đang quét danh mục [${cate.name}] (${cate.url}, ID ${cate.id})...`);
      let cateCount = 0;

      // 1. Lấy dữ liệu qua GetCate (GET)
      try {
        const getUrl = `https://api.bachhoaxanh.com/gw/Category/V2/GetCate?provinceId=1027&wardId=0&districtId=0&storeId=2546&categoryUrl=${cate.url}&isMobile=true&isV2=true&pageSize=50`;
        const resGet = await this.fetchWithRetry(getUrl, { method: 'GET' });
        if (resGet.ok) {
          const jsonGet = await resGet.json();
          const prods = jsonGet?.data?.products || [];
          for (const p of prods) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allProducts.push({
                id: p.id,
                name: p.name,
                fullName: p.fullName || p.name,
                url: p.url,
                avatar: p.avatar,
                unit: p.unit,
                canonical: p.canonical,
                brandName: p.brandName,
                price: p.productPrices?.[0]?.price,
                cateId: cate.id,
                cateUrl: cate.url,
                cateName: cate.name,
                groupLabel: cate.groupLabel,
              });
              cateCount++;
            }
          }
        }
      } catch (err: any) {
        console.warn(`  ! Lỗi GetCate danh mục ${cate.url}:`, err.message);
      }

      await sleep(1200 + Math.random() * 600);

      // 2. Lấy các trang tiếp theo qua AjaxProduct (POST) cho đến khi hết
      let pageIndex = 1;
      let emptyPages = 0;

      while (pageIndex <= 15 && emptyPages < 2) {
        try {
          const postBody = {
            provinceId: 1027,
            wardId: 0,
            districtId: 0,
            storeId: 2546,
            CategoryId: cate.id,
            SelectedBrandId: '',
            PropertyIdList: '',
            PageIndex: pageIndex,
            PageSize: 10,
            SortStr: '',
            PriorityProductIds: '',
            PropertySelected: [],
            LastShowProductId: 0,
          };

          const resPost = await this.fetchWithRetry(
            'https://api.bachhoaxanh.com/gw/Category/AjaxProduct',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(postBody),
            },
          );

          if (!resPost.ok) {
            break;
          }

          const jsonPost = await resPost.json();
          const postProds = jsonPost?.data?.products || [];

          if (!postProds.length) {
            emptyPages++;
          } else {
            emptyPages = 0;
            for (const p of postProds) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                allProducts.push({
                  id: p.id,
                  name: p.name,
                  fullName: p.fullName || p.name,
                  url: p.url,
                  avatar: p.avatar,
                  unit: p.unit,
                  canonical: p.canonical,
                  brandName: p.brandName,
                  price: p.productPrices?.[0]?.price,
                  cateId: cate.id,
                  cateUrl: cate.url,
                  cateName: cate.name,
                  groupLabel: cate.groupLabel,
                });
                cateCount++;
              }
            }
          }
        } catch (err: any) {
          break;
        }

        pageIndex++;
        await sleep(1000 + Math.random() * 500);
      }

      console.log(`  ✓ Thu thập được ${cateCount} sản phẩm.`);
    }

    fs.writeFileSync(RAW_CACHE_FILE, JSON.stringify(allProducts, null, 2), 'utf-8');
    console.log(`\n✓ Đã lưu toàn bộ ${allProducts.length} sản phẩm thô vào file ${RAW_CACHE_FILE}`);

    return allProducts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA CLEANING & NORMALIZATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_BRANDS = [
  'C.P',
  'C.P.',
  'CP',
  'MVP',
  'Cholimex',
  'Chinsu',
  'Chin-su',
  'Dh Foods',
  'Maggi',
  'Ông Chà Và',
  'Barona',
  'SG Food',
  'Meizan',
  'Neptune',
  'Nam Ngư',
  'Knorr',
  'Aji-ngon',
  'Ajinomoto',
  'Tường An',
  'Vissan',
  'G Kitchen',
  'Hương Sen',
  'Đà Lạt Gap',
  'Ba Huân',
  'Vĩnh Thành Đạt',
  'Simply',
  'Cooky',
  'Lee Kum Kee',
  'Guyumi',
  'Bách hoá XANH',
  'Bách hóa XANH',
  'BHX',
  'Cây Thị',
  'Việt Sin',
  'Vifon',
  'Thiên Thành',
  'Vedan',
  'Miwon',
  'Cozy',
  'Đức Việt',
  'Anlene',
  'TH True',
  'Vinamilk',
  'Hải Châu',
  'Hưng Phát',
  'Kim Hưng',
  'Trung Nguyên',
  'Hảo Hảo',
  'Omachi',
  'Pacow',
  'Vianco',
  'Thanh Hà',
  'Biên Hòa',
  'Nakydaco',
  'Daily',
  'Pro',
];

// Các địa danh xuất xứ phổ biến thường đi kèm tên sản phẩm
const KNOWN_ORIGINS = [
  'Nam Mỹ',
  'Đà Lạt',
  'Bến Tre',
  'Bạc Liêu',
  'Phú Quốc',
  'Na Uy',
  'Úc',
  'Hàn Quốc',
  'Nhật Bản',
  'Thái Lan',
  'Đồng Tháp',
  'Bình Dương',
  'Hà Nội',
  'Sài Gòn',
];

export class IngredientCleaner {
  static cleanRawName(raw: string): string {
    let s = raw || '';

    // 1. Bỏ phần trong ngoặc đơn nếu có: "(cần ta)", "(Dưa leo + ...)"
    s = s.replace(/\(.*?\)/g, ' ');

    // 2. Bỏ các tiền tố combo / quảng cáo
    s = s.replace(
      /^(combo|khuyến mãi|tặng kèm|tiết kiệm|set|khay mix|gói mix)\b[^\n-]*/i,
      '',
    );

    // 3. Chuẩn hóa hạt nêm từ thịt thăn -> Hạt nêm
    s = s.replace(/(?<!\p{L})từ thịt thăn[^\n]*/giu, ' ');

    // 4. Bỏ tên các thương hiệu đã biết (dùng Unicode word boundary (?<!\p{L})...(?!\p{L}))
    for (const b of KNOWN_BRANDS) {
      const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      s = s.replace(regex, ' ');
    }

    // 5. Bỏ xuất xứ địa danh (trừ trường hợp 'Bắp Mỹ' giữ nguyên)
    for (const o of KNOWN_ORIGINS) {
      const escaped = o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      s = s.replace(regex, ' ');
    }
    // Bỏ chữ 'Mỹ' riêng rẽ nếu KHÔNG phải 'Bắp Mỹ'
    s = s.replace(/(?<!bắp\s+)Mỹ(?!\p{L})/giu, ' ');

    // 6. Bỏ khối lượng, thể tích, quy cách đóng gói
    s = s.replace(
      /(?<!\p{L})(khay|túi|hộp|gói|vỉ|chai|hũ|lon|bịch|thanh|thùng|nải)\s+\d+([.,]\d+)?\s*(kg|g|gr|gram|ml|l|lít|lit|viên|quả|trái|con)?(?!\p{L})/giu,
      ' ',
    );
    s = s.replace(/(?<!\p{L})\d+([.,]\d+)?\s*(kg|g|gr|gram|ml|l|lít|lit)(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})vỉ\s+\d+\s*(quả|trái|trứng)?(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})(khay|túi|hộp|gói|chai|hũ|lon|nải)(?!\p{L})/giu, ' ');
    s = s.replace(/(?<!\p{L})\d+\s*(trái|quả|củ|bắp|con)(?!\p{L})/giu, ' ');

    // 7. Bỏ tính từ tiếp thị & từ bổ trợ không đổi bản chất nguyên liệu
    // Chú ý: KHÔNG bỏ 'ngọt' nếu đứng sau 'bột' (Bột ngọt) hoặc sau 'bắp' (Bắp ngọt)
    s = s.replace(
      /(?<!\p{L})(tươi ngon|tươi sạch|tươi sống|tươi|sạch|thượng hạng|loại 1|loại 2|nhập khẩu|đông lạnh|thủy canh|hữu cơ|organic|an toàn|chế biến sẵn|hàng ngày|ngon|chín đỏ|vắt nước|không hạt|giống nhật|thảo mộc|thả vườn|nguyên con|làm sạch|cuộn|nguyên chất|đậm đặc|tinh luyện|hạt lớn|hạt mịn|hạt nhỏ|hạt tiêu|sấy|thơm|sống)(?!\p{L})/giu,
      ' ',
    );
    s = s.replace(/(?<!bột\s+|bắp\s+|ngô\s+)ngọt(?!\p{L})/giu, ' ');

    // 8. Dọn dẹp khoảng trắng, dấu gạch nối và ký tự đặc biệt
    s = s
      .replace(/[-–—_+/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 9. Chuẩn hóa một số danh từ ghép đặc thù
    if (/^muối tinh\b/i.test(s)) s = 'Muối tinh';
    if (/^bột ngọt\b/i.test(s)) s = 'Bột ngọt';
    if (/^hạt nêm\b/i.test(s)) s = 'Hạt nêm';

    // 10. Chuẩn hóa chữ hoa đầu từ
    if (s.length > 1) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }

    return s;
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

  static normalizeUnit(bhxUnit: string, cleanName: string, groupLabel: string): string {
    const u = (bhxUnit || '').trim().toLowerCase();
    const foldedName = this.searchFolded(cleanName);

    // Thịt và thủy hải sản luôn có đơn vị KG hoặc G (không được là BẮP dù là bắp bò)
    if (groupLabel === 'Thịt' || groupLabel === 'Thủy hải sản') {
      return 'KG';
    }

    if (u === 'kg' || u === 'kilogram') return 'KG';
    if (u === 'g' || u === 'gam' || u === 'gram') return 'G';
    if (u === 'trái' || u === 'trai' || u === 'quả' || u === 'qua') return 'QUẢ';
    if (u === 'củ' || u === 'cu') return 'CỦ';
    if (u === 'bắp' || u === 'bap') return 'BẮP';
    if (u === 'cây' || u === 'cay') return 'CÂY';
    if (u === 'chai') return 'CHAI';
    if (u === 'gói' || u === 'goi') return 'GÓI';
    if (u === 'hộp' || u === 'hop') return 'HỘP';

    if (foldedName.includes('bap') || foldedName.includes('ngo')) return 'BẮP';
    if (foldedName.includes('cu ') || foldedName.includes('khoai') || foldedName.includes('ca rot'))
      return 'CỦ';
    if (groupLabel === 'Gia vị & nước chấm') return 'G';
    if (groupLabel === 'Rau củ') return 'G';
    if (groupLabel === 'Trứng & sữa') return 'QUẢ';

    return 'G';
  }

  static detectAllergen(cleanName: string): string | null {
    const folded = this.searchFolded(cleanName);
    const lowerWithAccents = cleanName.toLowerCase();

    // Hải sản
    if (
      /(?<!\p{L})(tôm|cua|mực|ghẹ|nghêu|ngao|sò|ốc|hàu|bạch tuộc|cá hồi|cá thu|cá ngừ|cá tra|cá basa|cá điêu hồng|cá diêu hồng|cá lóc|cá chép|cá hú|cá chim|cá trích|cá nục)(?!\p{L})/iu.test(
        lowerWithAccents,
      ) &&
      !/(?<!\p{L})(dưa hấu|tiêu sọ|cà chua|cà rốt|cà tím|cà pháo)(?!\p{L})/iu.test(lowerWithAccents)
    ) {
      return 'SEAFOOD';
    }

    // Trứng
    if (/(?<!\p{L})(trứng|lòng đỏ|lòng trắng)(?!\p{L})/iu.test(lowerWithAccents)) {
      return 'EGG';
    }

    // Đậu nành
    if (
      /(?<!\p{L})(đậu nành|đậu hũ|đậu phụ|tàu hũ|chao|nước tương|tương bần)(?!\p{L})/iu.test(
        lowerWithAccents,
      )
    ) {
      return 'SOY';
    }

    // Đậu phộng / Lạc
    if (/(?<!\p{L})(đậu phộng|lạc)(?!\p{L})/iu.test(lowerWithAccents)) {
      return 'PEANUT';
    }

    // Mè / Vừng
    if (/(?<!\p{L})(mè|vừng|dầu mè)(?!\p{L})/iu.test(lowerWithAccents)) {
      return 'SESAME';
    }

    // Bơ / Sữa: Kiểm tra chuỗi CÓ DẤU để không bao giờ nhầm "bò" với "bơ"!
    if (
      /(?<!\p{L})(sữa|bơ|phô mai|pho mai)(?!\p{L})/iu.test(lowerWithAccents) &&
      !/(?<!\p{L})(bò|thịt bò|bắp bò|gân bò|nạm bò|thăn bò|ba chỉ bò)(?!\p{L})/iu.test(
        lowerWithAccents,
      )
    ) {
      return 'DAIRY';
    }

    return null;
  }

  static cleanAndDeduplicate(rawProducts: RawBhxProduct[]): CleanIngredientItem[] {
    const map = new Map<string, CleanIngredientItem>();

    for (const raw of rawProducts) {
      const clean = this.cleanRawName(raw.name);

      // Bỏ qua nếu sau khi dọn dẹp tên quá ngắn hoặc rỗng hoặc là combo sót
      if (!clean || clean.length < 2 || /^combo/i.test(clean)) continue;

      const identity = this.identityNormalized(clean);
      const folded = this.searchFolded(clean);

      const unit = this.normalizeUnit(raw.unit, clean, raw.groupLabel);
      const allergenCode = this.detectAllergen(clean);

      const synonymCandidate = (raw.fullName || raw.name).trim();

      if (!map.has(identity)) {
        map.set(identity, {
          cleanName: clean,
          identityNormalized: identity,
          searchFolded: folded,
          groupLabel: raw.groupLabel,
          unit,
          allergenCode,
          imageUrl: raw.avatar,
          originalSample: {
            bhxId: raw.id,
            rawName: raw.name,
            fullName: raw.fullName,
            brandName: raw.brandName,
            price: raw.price,
            url: raw.url,
          },
          synonyms:
            synonymCandidate && synonymCandidate.toLowerCase() !== clean.toLowerCase()
              ? [synonymCandidate]
              : [],
        });
      } else {
        const item = map.get(identity)!;
        if (
          synonymCandidate &&
          synonymCandidate.toLowerCase() !== clean.toLowerCase() &&
          !item.synonyms.includes(synonymCandidate) &&
          item.synonyms.length < 5
        ) {
          item.synonyms.push(synonymCandidate);
        }
        // Giữ ảnh avatar tốt hơn nếu ảnh hiện tại chưa có
        if (!item.imageUrl && raw.avatar) {
          item.imageUrl = raw.avatar;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.cleanName.localeCompare(b.cleanName, 'vi'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE UPSERT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

async function executeDbUpsert(cleanItems: CleanIngredientItem[]) {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('\n--- Đang kết nối cơ sở dữ liệu PostgreSQL ---');
    const existingIngredients = await prisma.ingredient.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        identityNormalized: true,
        imageUrl: true,
        synonyms: true,
        status: true,
      },
    });

    console.log(`✓ Hiện có ${existingIngredients.length} nguyên liệu trong database.`);

    const existingByIdentity = new Map<string, typeof existingIngredients[0]>();
    for (const ing of existingIngredients) {
      existingByIdentity.set(ing.identityNormalized, ing);
    }

    let newlyInsertedCount = 0;
    let enrichedImageCount = 0;
    let existingMatchedCount = 0;

    for (const item of cleanItems) {
      const match = existingByIdentity.get(item.identityNormalized);

      if (match) {
        existingMatchedCount++;
        const updateData: any = {};
        // Cập nhật ảnh nếu nguyên liệu cũ trong DB chưa có ảnh
        if (!match.imageUrl && item.imageUrl) {
          updateData.imageUrl = item.imageUrl;
          updateData.imageStatus = IngredientImageStatus.APPROVED;
          enrichedImageCount++;
        }
        // Bổ sung synonyms nếu có tên phụ mới
        const currentSyns = match.synonyms || [];
        const newSyns = item.synonyms.filter(
          (s) => !currentSyns.some((cs) => cs.toLowerCase() === s.toLowerCase()),
        );
        if (newSyns.length > 0) {
          updateData.synonyms = [...currentSyns, ...newSyns].slice(0, 10);
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.ingredient.update({
            where: { id: match.id },
            data: updateData,
          });
        }
      } else {
        // Tạo mới nguyên liệu với trạng thái PENDING_REVIEW & isActive=false
        const code = IngredientCleaner.slugCode(item.cleanName);
        await prisma.ingredient.create({
          data: {
            code,
            name: item.cleanName,
            identityNormalized: item.identityNormalized,
            searchFolded: item.searchFolded,
            groupLabel: item.groupLabel,
            unit: item.unit,
            allergenCode: item.allergenCode,
            imageUrl: item.imageUrl || null,
            imageStatus: item.imageUrl
              ? IngredientImageStatus.APPROVED
              : IngredientImageStatus.NOT_REQUESTED,
            synonyms: item.synonyms,
            status: IngredientStatus.PENDING_REVIEW,
            isActive: false,
            createdVia: IngredientCreatedVia.FILE_IMPORT,
            enrichment: {
              source: 'bachhoaxanh',
              bhxId: item.originalSample.bhxId,
              originalName: item.originalSample.fullName || item.originalSample.rawName,
              originalPrice: item.originalSample.price,
              bhxUrl: item.originalSample.url,
              importedAt: new Date().toISOString(),
            },
          },
        });
        newlyInsertedCount++;
      }
    }

    console.log('\n======================================================');
    console.log('              KẾT QUẢ IMPORT DATABASE                ');
    console.log('======================================================');
    console.log(`- Tổng số nguyên liệu sau chuẩn hóa: ${cleanItems.length}`);
    console.log(`- Nguyên liệu đã tồn tại trong DB:   ${existingMatchedCount}`);
    console.log(`- Nguyên liệu cũ được bổ sung ảnh:   ${enrichedImageCount}`);
    console.log(`- Nguyên liệu mới được tạo mới:      ${newlyInsertedCount}`);
    console.log(`- Trạng thái các mục mới:            PENDING_REVIEW (isActive=false)`);
    console.log('======================================================\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const fromCache = args.includes('--from-cache');

  console.log('======================================================');
  console.log('   MOGU - CÀO NGUYÊN LIỆU TỪ BÁCH HÓA XANH (BHX)     ');
  console.log('======================================================');
  console.log(`Chế độ: ${isDryRun ? 'DRY-RUN (Không ghi vào DB)' : 'THỰC THI GHI VÀO DB'}`);
  console.log(`Nguồn:  ${fromCache ? 'Từ file cache cục bộ' : 'Cào trực tiếp từ bachhoaxanh.com'}`);

  let rawProducts: RawBhxProduct[] = [];

  if (fromCache && fs.existsSync(RAW_CACHE_FILE)) {
    console.log(`\n✓ Đang đọc dữ liệu thô từ cache ${RAW_CACHE_FILE}...`);
    rawProducts = JSON.parse(fs.readFileSync(RAW_CACHE_FILE, 'utf-8'));
    console.log(`✓ Đã nạp ${rawProducts.length} sản phẩm thô từ cache.`);
  } else {
    try {
      const scraper = new BhxScraper();
      rawProducts = await scraper.scrapeAllCategories();
    } catch (e: any) {
      if (fs.existsSync(RAW_CACHE_FILE)) {
        console.warn(
          `! Không thể kết nối trực tiếp đến bachhoaxanh.com (${e.message}). Tự động dùng cache ${RAW_CACHE_FILE}...`,
        );
        rawProducts = JSON.parse(fs.readFileSync(RAW_CACHE_FILE, 'utf-8'));
      } else {
        throw e;
      }
    }
  }

  console.log(`\n--- Bắt đầu chuẩn hóa và lọc trùng lặp ---`);
  const cleanItems = IngredientCleaner.cleanAndDeduplicate(rawProducts);

  fs.writeFileSync(CLEAN_EXPORT_FILE, JSON.stringify(cleanItems, null, 2), 'utf-8');
  console.log(
    `✓ Đã chuẩn hóa thành ${cleanItems.length} nguyên liệu sạch. Lưu tại ${CLEAN_EXPORT_FILE}`,
  );

  // In mẫu 20 nguyên liệu đầu tiên
  console.log('\n--- Mẫu 15 nguyên liệu sau chuẩn hóa ---');
  console.table(
    cleanItems.slice(0, 15).map((c) => ({
      'Tên chuẩn': c.cleanName,
      'Nhóm': c.groupLabel,
      'ĐVT': c.unit,
      'Dị ứng': c.allergenCode || '-',
      'Tên gốc BHX': c.originalSample.rawName,
    })),
  );

  if (isDryRun) {
    console.log('\n[DRY RUN HOÀN TẤT] Không có thay đổi nào được ghi vào DB.');
    console.log('Chạy lại không có --dry-run để nạp dữ liệu vào PostgreSQL.');
    return;
  }

  await executeDbUpsert(cleanItems);
}

main().catch((err) => {
  console.error('\n❌ Lỗi thực thi script:', err);
  process.exit(1);
});
