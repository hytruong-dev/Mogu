async function testBhxSearch(query: string) {
  const url = `https://api.bachhoaxanh.com/gw/Search/V2/Search?key=${encodeURIComponent(query)}&provinceId=1027&storeId=2546&page=0&pageSize=10`;
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
  });
  console.log(`Query "${query}": status ${res.status}`);
  if (res.ok) {
    const data = await res.json();
    const prods = data?.data?.products || data?.products || [];
    console.log(`Found ${prods.length} products:`);
    prods.slice(0, 3).forEach((p: any) => console.log(` - ${p.name || p.fullName} | ${p.avatar || p.image}`));
  }
}

testBhxSearch('đậu ngự');
testBhxSearch('hạt é');
testBhxSearch('tàu hũ ky');
