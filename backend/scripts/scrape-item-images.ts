async function fetchImages() {
  const urls: Record<string, string> = {
    'Tàu hũ ky': 'https://www.bachhoaxanh.com/thuc-pham-chay/tau-hu-ky-cong-kho-binh-loan-goi-250g',
  };

  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const html = await res.text();
      const match = html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+property="og:image"/);
      console.log(`${name}: og:image = ${match ? match[1] : 'null'}`);
    } catch (e: any) {
      console.log(`${name} error: ${e.message}`);
    }
  }
}

fetchImages();
