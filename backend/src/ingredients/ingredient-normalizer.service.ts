import { Injectable } from '@nestjs/common';

/**
 * Từ đồng nghĩa theo token (dạng folded, không dấu) — chuẩn hoá về 1 token
 * canonical trước khi so khớp. Chỉ gồm các cặp tuyệt đối tương đương trong
 * ngữ cảnh ẩm thực Việt (khác vùng miền, cùng một thứ).
 */
const TOKEN_SYNONYMS: Record<string, string> = {
  // heo / lợn — chỉ thay ở mức cụm để không đụng "lớn" (to) khi fold mất dấu.
  'thit lon': 'thit heo',
  'suon lon': 'suon heo',
  'gio lon': 'gio heo',
  'chan gio lon': 'chan gio heo',
  'mong lon': 'mong heo',
  'chan lon': 'chan heo',
  'mo lon': 'mo heo',
  'xuong lon': 'xuong heo',
  'ba chi lon': 'ba chi heo',
  'ba roi': 'ba chi',
  'thit ba roi': 'thit ba chi',
  'long lon': 'long heo',
  'tim lon': 'tim heo',
  'gan lon': 'gan heo',
  'da lon': 'da heo',
  'bi lon': 'bi heo',
  // ngô / bắp — "bắp bò" là bắp (thịt) nên chỉ thay các cụm rõ nghĩa hạt ngô.
  'bap my': 'ngo my',
  'bap ngot': 'ngo ngot',
  'bap nep': 'ngo nep',
  'hat bap': 'hat ngo',
  'trai bap': 'trai ngo',
  'bot bap': 'bot ngo',
  // đậu / hạt
  lac: 'dau phong',
  'dau phong rang': 'dau phong rang',
  vung: 'me',
  'dau phu': 'dau hu',
  'tau hu': 'dau hu',
  'dau co ve': 'dau que',
  'dau dua': 'dau que',
  // rau thơm / gia vị
  'hanh hoa': 'hanh la',
  'rau mui': 'ngo ri',
  'rau ngo': 'ngo ri',
  'ngo rí': 'ngo ri',
  'mui tau': 'ngo gai',
  'rau mui tau': 'ngo gai',
  'rau que': 'hung que',
  'cu hanh tim': 'hanh tim',
  'hanh cu': 'hanh tim',
  'cu hanh tay': 'hanh tay',
  'cu toi': 'toi',
  'tep toi': 'toi',
  'cu gung': 'gung',
  'cu nghe': 'nghe',
  'cu rieng': 'rieng',
  'cay sa': 'sa',
  'sa cay': 'sa',
  xa: 'sa',
  'ngo om': 'rau om',
  'rau ngo om': 'rau om',
  // dứa/dừa cùng fold "dua" → KHÔNG quy về "dua"; dùng "thom" cho dứa.
  'trai thom': 'thom',
  khom: 'thom',
  'trai khom': 'thom',
  // củ quả
  'cu san': 'khoai mi',
  'khoai san': 'khoai mi',
  'dua chuot': 'dua leo',
  'qua dua chuot': 'dua leo',
  'ca phao': 'ca phao',
  quat: 'tac',
  'trai tac': 'tac',
  'qua quat': 'tac',
  // hải sản
  'muc nang': 'muc',
  'tom su': 'tom',
  'tom the': 'tom',
};

/**
 * Các từ bổ nghĩa KHÔNG làm thay đổi bản chất nguyên liệu (tươi, sống, ngon…).
 * Bị loại khi tính khoá "core" để so sánh gần đúng. Cố ý KHÔNG loại các từ
 * có thể đổi bản chất (chay, khô, xay, bằm, nạc, mỡ, lá, củ, quả, chín…).
 */
const NEUTRAL_MODIFIERS = new Set([
  'tuoi',
  'ngon',
  'loai',
  'sach',
  'tot',
  'moi',
  'that',
  'thuong',
  // Động từ sơ chế lọt vào tên (AI hay sinh "tỏi băm", "sả xay", "ớt thái lát").
  // Bỏ qua các từ có thể là tên thật khi mất dấu: "giá" (đỗ), "bào" (ngư), "sống" (giò sống).
  'bam',
  'xay',
  'thai',
  'cat',
  'dap',
  'lat',
  'nhuyen',
  'khuc',
  'mieng',
  'nhanh',
  'tep',
]);

/** Từ chỉ bộ phận/định danh cho phép tỉnh lược (ví dụ "chân giò heo" ⊇ "giò heo"). */
const PART_PREFIXES = new Set(['chan', 'thit', 'phan', 'mieng', 'khuc']);

@Injectable()
export class IngredientNormalizerService {
  /** Strip parenthetical notes and "hoặc/hay ..." tails. */
  cleanDisplayName(raw: string): string {
    return (raw ?? '')
      .normalize('NFKC')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s*(hoặc|hoac|hay)\s+.*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Identity key: keep Vietnamese diacritics, lowercase, collapse spaces. */
  identityKey(raw: string): string {
    return this.cleanDisplayName(raw)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /** Folded search key: strip diacritics for suggestion ranking only. */
  searchFolded(raw: string): string {
    return this.cleanDisplayName(raw)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * Khoá so khớp "canonical": folded + thay thế đồng nghĩa theo token
   * (lợn→heo, bắp→ngô…). Hai tên có cùng canonicalKey được coi là cùng
   * nguyên liệu với độ tin cậy cao (95).
   */
  canonicalKey(raw: string): string {
    let folded = ` ${this.searchFolded(raw)} `;
    // Thay cụm dài trước để tránh thay đè lên nhau.
    const entries = Object.entries(TOKEN_SYNONYMS).sort(
      (a, b) => b[0].length - a[0].length,
    );
    for (const [from, to] of entries) {
      if (from === to) continue;
      folded = folded.split(` ${from} `).join(` ${to} `);
    }
    return folded.replace(/\s+/g, ' ').trim();
  }

  /**
   * Khoá "core": canonicalKey đã bỏ các từ bổ nghĩa trung tính.
   * Dùng cho gợi ý ứng viên (KHÔNG tự động link).
   */
  coreKey(raw: string): string {
    const tokens = this.canonicalKey(raw)
      .split(' ')
      .filter((t) => t && !NEUTRAL_MODIFIERS.has(t));
    return tokens.join(' ');
  }

  tokens(raw: string): string[] {
    return this.canonicalKey(raw).split(' ').filter(Boolean);
  }

  /**
   * Kiểm tra quan hệ bao hàm theo token: `candidate` ⊆ `input` và phần dư của
   * input tối đa 1 token thuộc nhóm bộ phận/định danh (vd "chân giò heo" vs
   * "giò heo"). Trả về điểm 0..100 (0 = không liên quan).
   */
  containmentScore(input: string, candidate: string): number {
    const a = this.coreKey(input).split(' ').filter(Boolean);
    const b = this.coreKey(candidate).split(' ').filter(Boolean);
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);

    const bInA = b.every((t) => setA.has(t));
    const aInB = a.every((t) => setB.has(t));
    if (!bInA && !aInB) return 0;

    // Xác minh dấu: token folded trùng nhau nhưng khác dấu (cá ≠ cà) → không liên quan.
    const diacriticA = this.diacriticVariants(input);
    const diacriticB = this.diacriticVariants(candidate);
    for (const t of [...setA].filter((x) => setB.has(x))) {
      const va = diacriticA.get(t);
      const vb = diacriticB.get(t);
      // Token sinh ra từ thay thế đồng nghĩa (lợn→heo) không có biến thể gốc → bỏ qua.
      if (!va || !vb) continue;
      if (![...va].some((v) => vb.has(v))) return 0;
    }

    if (a.join(' ') === b.join(' ')) return 100;
    const [longer, shorter] = bInA ? [a, b] : [b, a];
    const extra = longer.filter((t) => !new Set(shorter).has(t));
    if (extra.length === 0) return 100;
    if (extra.length === 1 && PART_PREFIXES.has(extra[0])) return 92;
    if (extra.length === 1) return 80;
    return 60;
  }

  /** fold token → tập token có dấu tương ứng trong chuỗi gốc. */
  private diacriticVariants(raw: string): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const token of this.identityKey(raw).split(' ').filter(Boolean)) {
      const fold = this.searchFolded(token);
      if (!fold) continue;
      const set = map.get(fold) ?? new Set<string>();
      set.add(token);
      map.set(fold, set);
    }
    return map;
  }

  /** Jaro-Winkler-ish quick similarity (0..1) dựa trên Levenshtein của folded key. */
  similarity(left: string, right: string): number {
    const a = this.canonicalKey(left);
    const b = this.canonicalKey(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const rows = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
      let prev = rows[0];
      rows[0] = j;
      for (let i = 1; i <= a.length; i++) {
        const cur = rows[i];
        rows[i] = Math.min(
          rows[i] + 1,
          rows[i - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        prev = cur;
      }
    }
    return 1 - rows[a.length] / Math.max(a.length, b.length);
  }

  slugCode(name: string): string {
    const base = this.searchFolded(name)
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const suffix = Date.now().toString(36).slice(-5);
    return `${base.substring(0, 90)}-${suffix}`;
  }
}
