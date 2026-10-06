/**
 * Chuẩn hoá link video hướng dẫn nấu (YouTube / TikTok) để:
 *  - hiển thị thumbnail + nhãn nền tảng trên thẻ video
 *  - phát inline bằng WebView (embed URL)
 *  - mở app gốc khi không nhúng được
 */

export type VideoPlatform = 'youtube' | 'tiktok' | 'other';

export type CookingVideo = {
  platform: VideoPlatform;
  /** URL gốc (dùng để mở app YouTube/TikTok hoặc trình duyệt). */
  url: string;
  /** ID video nếu trích được; null với link rút gọn (vm.tiktok.com...). */
  id: string | null;
  /** URL embed để phát trong app; null nếu không nhúng được. */
  embedUrl: string | null;
  /** Thumbnail có sẵn không cần gọi mạng (YouTube). TikTok lấy qua oEmbed. */
  thumbnailUrl: string | null;
  /** Video dọc (Shorts/TikTok) → khung phát 9:16. */
  vertical: boolean;
  label: string;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function safeUrl(raw: string): URL | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function youtubeId(u: URL): { id: string | null; shorts: boolean } {
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1] ?? '';
    return { id: YT_ID.test(id) ? id : null, shorts: false };
  }
  const v = u.searchParams.get('v');
  if (v && YT_ID.test(v)) return { id: v, shorts: false };
  const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
  if (m) return { id: m[2], shorts: m[1] === 'shorts' };
  return { id: null, shorts: false };
}

export function parseCookingVideo(raw?: string | null): CookingVideo | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  const u = safeUrl(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase();

  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|youtube-nocookie\.com$/.test(host)) {
    const { id, shorts } = youtubeId(u);
    return {
      platform: 'youtube',
      url: u.toString(),
      id,
      embedUrl: id
        ? `https://www.youtube.com/embed/${id}?playsinline=1&autoplay=1&rel=0&modestbranding=1`
        : null,
      thumbnailUrl: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
      vertical: shorts,
      label: 'YouTube',
    };
  }

  if (/(^|\.)tiktok\.com$/.test(host)) {
    const m = u.pathname.match(/\/video\/(\d{8,})/) ?? u.pathname.match(/\/v\/(\d{8,})/);
    const id = m ? m[1] : null;
    return {
      platform: 'tiktok',
      url: u.toString(),
      id,
      embedUrl: id ? `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0&music_info=0&description=0` : null,
      thumbnailUrl: null,
      vertical: true,
      label: 'TikTok',
    };
  }

  return {
    platform: 'other',
    url: u.toString(),
    id: null,
    embedUrl: null,
    thumbnailUrl: null,
    vertical: false,
    label: 'Video',
  };
}

/** Thumbnail TikTok qua oEmbed công khai (không cần key). Trả null nếu lỗi. */
export async function fetchTikTokThumbnail(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { thumbnail_url?: string };
    return json.thumbnail_url ?? null;
  } catch {
    return null;
  }
}
