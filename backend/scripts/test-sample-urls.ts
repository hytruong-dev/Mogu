async function checkUrl(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    return { ok: res.ok, status: res.status, type: res.headers.get('content-type'), size: (await res.arrayBuffer()).byteLength };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function run() {
  const sample = [
    'https://upload.wikimedia.org/wikipedia/commons/9/95/Charsiu.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Tahu_digoreng.JPG/800px-Tahu_digoreng.JPG',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Saigoncinnamon.jpg/800px-Saigoncinnamon.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Youtiao.jpg/800px-Youtiao.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Gi%C3%B2_l%E1%BB%A5a_2.jpg/800px-Gi%C3%B2_l%E1%BB%A5a_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Pork_belly.jpg/800px-Pork_belly.jpg',
  ];

  for (const s of sample) {
    const r = await checkUrl(s);
    console.log(s.split('/').pop(), '->', r);
  }
}

run();
