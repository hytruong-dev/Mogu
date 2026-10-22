async function searchCommonsVi(query: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
    if (!res.ok) return [];
    const json = await res.json() as any;
    const pages = json?.query?.pages;
    if (!pages) return [];
    return Object.values(pages).map((p: any) => ({
      title: p.title,
      thumb: p.imageinfo?.[0]?.thumburl,
      mime: p.imageinfo?.[0]?.mime,
    }));
  } catch {
    return [];
  }
}

async function run() {
  const testWords = [
    'Chả bò',
    'Chả cá',
    'Chả cốm',
    'Bì lợn',
    'Chả trứng',
    'Đồ chua',
    'Dồi',
    'Thịt xá xíu',
    'Thịt quay',
    'Bò khô',
    'Thịt ba chỉ',
    'Nạc vai',
    'Sườn cốt lết',
    'Tai heo',
    'Gan lợn',
    'Lòng lợn',
    'Mỡ hành',
    'Mỡ lợn',
    'Tóp mỡ',
    'Hành phi',
    'Tỏi phi',
    'Xá bấu',
    'Ngải bún',
    'Củ đậu',
    'Măng chua',
    'Cà cuống',
    'Lá dong',
    'Lá lốt',
    'Lá ổi',
    'Rau răm',
    'Ngò gai',
    'Thì là',
    'Bánh đa đỏ',
    'Hủ tiếu',
    'Bánh canh',
    'Cao lầu',
    'Mì Quảng',
    'Quẩy',
    'Nem chua',
    'Lạp xưởng',
    'Tôm khô',
    'Ghẹ',
    'Cua đồng',
    'Hến',
    'Sứa',
    'Khô mực',
    'Cá rô phi',
    'Nước mắm',
    'Hoa hồi',
    'Quế',
    'Hạt điều màu',
    'Gấc'
  ];

  for (const w of testWords) {
    const r = await searchCommonsVi(w);
    console.log(`\n=== "${w}" ===`);
    for (const item of r) {
      console.log(`  - [${item.mime}] ${item.title}`);
    }
  }
}

run();
