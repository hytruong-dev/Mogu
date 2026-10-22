import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// ─── Local Caches ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../data');
const multiSource: any[] = fs.existsSync(path.join(DATA_DIR, 'multi-source-clean-ingredients.json'))
  ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'multi-source-clean-ingredients.json'), 'utf-8'))
  : [];
const winmart: any[] = fs.existsSync(path.join(DATA_DIR, 'winmart-raw-products.json'))
  ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'winmart-raw-products.json'), 'utf-8'))
  : [];
const bhx: any[] = fs.existsSync(path.join(DATA_DIR, 'bhx-clean-ingredients.json'))
  ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bhx-clean-ingredients.json'), 'utf-8'))
  : [];

// ─── English Dictionary for Unsplash / Wiki ──────────────────────────────────
const VI_TO_EN: Record<string, string> = {
  'quế thanh': 'cinnamon stick',
  'hoa hồi': 'star anise',
  'quế và hoa hồi': 'cinnamon and star anise',
  'măng chua': 'pickled bamboo shoots',
  'chả cốm': 'vietnamese green rice pork patty',
  'nem rán': 'fried spring roll',
  'đậu phụ rán': 'fried tofu cubes',
  'lạc rang': 'roasted peanuts',
  'ớt chưng': 'chili oil condiment',
  'chí chương': 'chili oil condiment',
  'rượu vang đỏ': 'red wine cooking',
  'thịt gấc': 'gac fruit pulp',
  'mỡ gà': 'chicken fat',
  'hành tím phi': 'crispy fried shallots',
  'chà bông': 'pork floss',
  'giò sống': 'raw seasoned pork paste',
  'bún sợi to': 'thick rice noodles',
  'khoanh giò heo': 'pork trotter shank',
  'chả cua': 'crab cake patty',
  'hạt điều màu': 'annatto seeds',
  'mì quảng': 'turmeric rice noodles',
  'bánh tráng mè': 'sesame rice cracker',
  'nước luộc gà': 'chicken broth',
  'nước mạ lòng mề gà': 'chicken liver gravy',
  'đu đủ chua': 'pickled green papaya',
  'cao lầu': 'cao lau noodles',
  'thịt nạc vai': 'pork shoulder meat',
  'tóp mỡ': 'crispy pork rinds',
  'chả cá thu': 'fried fish cake',
  'sứa tươi': 'edible jellyfish',
  'cá cờ': 'marlin fish fillet',
  'cá ngừ': 'tuna fish fillet',
  'tôm đất': 'fresh small shrimp',
  'mỡ hành': 'scallion oil',
  'gan heo': 'pork liver fresh',
  'gạo tấm': 'broken rice grains',
  'sườn cốt lết': 'pork chop cutlet',
  'bì heo': 'shredded pork skin',
  'chả trứng': 'steamed egg meatloaf',
  'đồ chua': 'vietnamese pickled vegetables',
  'sốt tương đen': 'hoisin sauce',
  'pa-tê gan': 'pork liver pate',
  'đùi gà': 'chicken thigh leg',
  'gia vị tỏi gừng': 'ginger garlic seasoning',
  'hủ tiếu mỹ tho': 'clear rice noodles',
  'thịt xá xíu': 'char siu bbq pork',
  'xương ống heo': 'pork marrow bones',
  'khô mực': 'dried squid',
  'tỏi phi': 'crispy fried garlic',
  'bánh canh bột lọc': 'tapioca thick noodles',
  'thịt ghẹ': 'blue crab meat',
  'gạch ghẹ': 'crab roe',
  'muối ớt xanh': 'green chili dipping sauce',
  'rau cải xanh': 'mustard greens',
  'mì trứng': 'fresh egg noodles',
  'hành khô': 'shallots onion',
  'xương bay heo': 'pork bone broth bones',
  'thịt ba chỉ': 'pork belly slices',
  'giò lụa': 'vietnamese pork roll sausage',
  'củ cải khô': 'preserved dried radish',
  'hành tím nướng': 'charred shallots and ginger',
  'hành lá rau răm': 'scallion and vietnamese coriander',
  'tinh dầu cà cuống': 'lethocerus indicus extract',
  'hành lá rau mùi': 'scallions and cilantro',
  'nước chấm nem': 'sweet and sour fish sauce',
  'thịt bò khô': 'beef jerky strips',
  'rau kinh giới': 'vietnamese balm perilla',
  'nước hầm xương': 'simmered bone broth',
  'phi lê cá rô': 'tilapia fish fillet',
  'quẩy giòn': 'chinese fried dough cruller',
  'xương cá': 'fish bones for stock',
  'nước me': 'tamarind paste juice',
  'hành lá thì là': 'dill and green onions',
  'bánh đa đỏ': 'red rice noodles',
  'hành lá mùi tàu': 'sawtooth herb culantro scallion',
  'xì dầu': 'dark soy sauce',
  'cơm nguội': 'cooked white rice',
  'hến tươi': 'baby clams fresh',
  'thân chuối non': 'shredded banana stem',
  'bóng bì': 'fried pork skin puffs',
  'lá dong': 'phrynium leaves',
  'bột tôm chấy': 'shrimp floss powder',
  'bánh canh bột gạo': 'rice drop noodles',
  'hành lá ngò rí': 'scallions and cilantro',
  'thịt má heo': 'pork jowl meat',
  'thính gạo': 'roasted rice powder',
  'lá ổi': 'guava leaves',
  'rau mầm': 'radish sprouts microgreens',
  'tỏi tép ớt hiểm': 'garlic cloves and red bird eye chili',
  'thịt heo quay': 'crispy roasted pork belly',
  'chả bò': 'beef roll sausage',
  'nem chua': 'fermented sour pork roll',
  'nấm bào ngư': 'grey oyster mushrooms',
  'ngải bún': 'fingerroot rhizome',
  'chanh ớt': 'fresh lime wedge red chili',
  'lạp xưởng': 'chinese sausage lap cheong',
  'rau lẩu mắm': 'water spinach banana flower herbs',
  'rau củ luộc': 'boiled assorted vegetables',
  'củ sắn': 'jicama tuber yam bean',
  'ruột bánh mì': 'bread crumbs',
  'phèo non': 'pork small intestines',
  'dồi sụn': 'vietnamese grilled pork sausage',
  'dưa leo cà chua': 'cucumber and tomato slices',
  'chả quế': 'cinnamon pork roll patty',
  'bột gia vị bò kho': 'beef stew seasoning spices',
  'tương đen': 'hoisin sauce sweet bean sauce',
  'rau sống': 'mixed fresh vietnamese herbs',
  'hủ tiếu dai': 'chewy tapioca glass noodles',
  'lá lốt': 'wild betel piper sarmentosum leaf',
  'khuôn chén sành': 'small ceramic sauce dish',
  'nước sốt trộn': 'asian savory seasoning sauce bowl',
};

const EXACT_FALLBACKS: Record<string, string> = {
  'khuôn chén sành làm bánh bèo': 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  'nước sốt trộn': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  'nước sốt trộn hủ tiếu': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
};


// ─── Search Wikipedia VI ──────────────────────────────────────────────────────
async function searchWikiVI(name: string): Promise<string | null> {
  try {
    const searchUrl = `https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=2&format=json&origin=*`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'MoguApp/1.0' } });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const hits = json?.query?.search ?? [];
    if (!hits.length) return null;

    const pageTitle = hits[0].title;
    const imgUrl = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=600&format=json&origin=*`;
    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'MoguApp/1.0' } });
    if (!imgRes.ok) return null;
    const imgJson = await imgRes.json() as any;
    const pages = imgJson?.query?.pages ?? {};
    for (const p of Object.values(pages) as any[]) {
      if (p.thumbnail?.source) return p.thumbnail.source;
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Search Unsplash ──────────────────────────────────────────────────────────
async function searchUnsplash(keyword: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=squarish`, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.results?.[0]?.urls?.small || data.results?.[0]?.urls?.regular || null;
  } catch {
    return null;
  }
}

// ─── Search Local Supermarket Caches ──────────────────────────────────────────
function searchLocalSupermarkets(name: string): string | null {
  const clean = name.toLowerCase().replace(/[()]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2);

  // 1. Exact match in multi-source
  for (const item of multiSource) {
    if (item.name && item.image_url && item.name.toLowerCase() === clean) {
      return item.image_url;
    }
  }

  // 2. Partial match in multi-source
  for (const item of multiSource) {
    if (item.name && item.image_url) {
      const lower = item.name.toLowerCase();
      if (lower.includes(clean) || clean.includes(lower)) {
        return item.image_url;
      }
    }
  }

  // 3. WinMart match
  for (const item of winmart) {
    const img = item.avatar || item.image_url;
    if (item.name && img) {
      const lower = item.name.toLowerCase();
      if (lower.includes(clean) || clean.includes(lower)) {
        return img;
      }
    }
  }

  // 4. BHX match
  for (const item of bhx) {
    const img = item.image_url || item.avatar;
    if (item.name && img) {
      const lower = item.name.toLowerCase();
      if (lower.includes(clean) || clean.includes(lower)) {
        return img;
      }
    }
  }

  return null;
}

export async function resolveImageForIngredient(name: string): Promise<{ url: string; source: string } | null> {
  const lowerName = name.toLowerCase().trim();
  if (EXACT_FALLBACKS[lowerName]) {
    return { url: EXACT_FALLBACKS[lowerName], source: 'curated_fallback' };
  }

  // 1. Local Supermarket Cache
  const local = searchLocalSupermarkets(name);
  if (local) return { url: local, source: 'supermarket_cache' };

  // 2. Wikipedia VI (Authentic Vietnamese food/produce)
  const wiki = await searchWikiVI(name);
  if (wiki) return { url: wiki, source: 'wikipedia_vi' };

  // 3. Unsplash using English query
  const lower = name.toLowerCase();
  let enQuery: string | null = null;
  for (const [viKey, enVal] of Object.entries(VI_TO_EN)) {
    if (lower.includes(viKey)) {
      enQuery = enVal;
      break;
    }
  }
  if (enQuery) {
    const unsplash = await searchUnsplash(enQuery);
    if (unsplash) return { url: unsplash, source: 'unsplash' };
  }

  // Fallback to name without diacritics
  const fallback = await searchUnsplash(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd') + ' food ingredient');
  if (fallback) return { url: fallback, source: 'unsplash_fallback' };

  return null;
}


