async function testBanhTrang() {
  const res = await fetch('https://nongsandungha.com/thuc-pham/banh-trang/', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const text = await res.text();
  const imgs = Array.from(text.matchAll(/https:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map((m) => m[0]);
  console.log(imgs.filter((x) => x.includes('banh-trang') || x.includes('phoi-suong')));
}

testBanhTrang();
