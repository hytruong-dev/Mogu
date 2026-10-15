async function check() {
  const url = 'https://nongsandungha.com/thuc-pham/cuong-tim-heo/';
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const text = await res.text();
  const imgs = Array.from(text.matchAll(/https:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map(m => m[0]);
  const productImgs = imgs.filter(x => x.includes('cuong-tim') || x.includes('thuc-pham'));
  console.log('Found:', productImgs);
}
check();
