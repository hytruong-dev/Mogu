const url = 'https://www.bachhoaxanh.com/mi/mi-trung-cao-cap-soi-nho-safoco-goi-500g';
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(r => r.text())
  .then(html => {
    const match = html.match(/<meta property="og:image" content="([^"]+)"/i) || html.match(/"image":\s*"([^"]+)"/);
    console.log('Found:', match ? match[1] : 'none');
  });
