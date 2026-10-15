async function checkHaisan() {
  const sites = [
    'https://chihaisan.com/?s=ca+duoi',
    'https://hieuhaisan.com/tim-kiem?q=ca+duoi',
    'https://vuahaigiatot.com/?s=ca+duoi',
  ];

  for (const url of sites) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const text = await res.text();
      const imgs = Array.from(text.matchAll(/https:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map(m => m[0]);
      const matched = imgs.filter(x => x.toLowerCase().includes('duoi') || x.toLowerCase().includes('ca-duoi'));
      console.log(`Results from ${url}:`, matched);
    } catch (e: any) {
      console.log(`Error ${url}:`, e.message);
    }
  }
}
checkHaisan();
