async function checkBoth() {
  const urls = [
    'https://nongsandungha.com/thuc-pham/vang-dau-kho/',
    'https://nongsandungha.com/thuc-pham/dau-ngu-do-ngu/',
  ];

  for (const url of urls) {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const text = await res.text();
    const imgs = Array.from(text.matchAll(/https:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map(m => m[0]);
    console.log(`URL: ${url}`);
    console.log(imgs.filter(x => x.includes('vang-dau') || x.includes('dau-ngu')).slice(0, 5));
  }
}
checkBoth();
