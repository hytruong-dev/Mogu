async function checkSuonBo() {
  const url = 'https://nongsandungha.com/thuc-pham/suon-bo-my-uc/';
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const text = await res.text();
  const imgs = Array.from(text.matchAll(/https:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map(m => m[0]);
  const productImgs = imgs.filter(x => x.includes('suon') || x.includes('bo'));
  console.log('Found:', productImgs.slice(0, 5));
}
checkSuonBo();
