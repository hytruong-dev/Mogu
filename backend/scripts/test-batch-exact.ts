async function checkUrl(name: string, url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const size = (await res.arrayBuffer()).byteLength;
    console.log(`[${res.status}] ${name} -> size: ${size} bytes (${res.headers.get('content-type')})`);
  } catch (e: any) {
    console.log(`[ERR] ${name} -> ${e.message}`);
  }
}

async function run() {
  const tests: [string, string][] = [
    ['Chả lụa', 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/10/image/Products/Images/7618/316994/bhx/cha-lua-cp-goi-500g_202610061115366141.jpg'],
    ['Chả cua', 'https://cdn.tgdd.vn/Products/Images/7259/258268/bhx/cha-cua-hue-ngon-ngon-goi-300g-202112091451107828.jpg'],
    ['Đậu phộng', 'https://cdn.tgdd.vn/Products/Images/3235/83022/bhx/dau-phong-viet-san-500g-201812111146444694.jpg'],
    ['Măng chua', 'https://s3-hcmc02.higiocloud.vn/images/2023/02/mang-chua-thai-san-kim-boi-goi-300g.jpg'],
    ['Thịt hến', 'https://s3-hcmc02.higiocloud.vn/images/2022/thit-hen-lam-sach_c612a941-9b5b-4e2c-a7c2-7518219f8826-og.jpg'],
    ['Ba rọi heo', 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/226834/ba-roi-heo-1kg_202607300933343971.jpg'],
    ['Tai heo', 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/3/image/Products/Images/8781/309294/bhx/tai-heo-300g_202603201031481217.jpg'],
    ['Thịt xá xíu', 'https://upload.wikimedia.org/wikipedia/commons/9/95/Charsiu.jpg'],
    ['Đậu phụ rán', 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Tahu_digoreng.JPG'],
    ['Nem rán', 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Cha_gio.jpg'],
    ['Lạp xưởng', 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Chinesesausageunpackaged.jpg'],
    ['Tương đen', 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Hoisin_sauce.jpg'],
    ['Lá lốt', 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Piper_sarmentosum.jpg'],
    ['Bánh đa cua', 'https://upload.wikimedia.org/wikipedia/commons/8/81/BANH_DA_CUA_1.jpg'],
    ['Rau răm', 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rau_ram_Polygonum_odoratum.jpg'],
  ];

  for (const [name, url] of tests) {
    await checkUrl(name, url);
  }
}

run();
