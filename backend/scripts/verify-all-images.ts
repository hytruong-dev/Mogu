import * as fs from 'fs';
import * as path from 'path';

export const FINAL_38_INGREDIENTS = [
  // 1. Rau củ
  {
    name: 'Rau tiến vua',
    group_label: 'Rau củ',
    unit: 'Gói',
    image_url: 'https://product.hstatic.net/200000460455/product/rau_ti_n_vua__g_i_100g__89752c9017ff4f1e97652f3b1c6345f8.png',
  },
  {
    name: 'Rau sắng',
    group_label: 'Rau củ',
    unit: 'Bó',
    image_url: 'https://www.biggreen.com.vn/data/product/rau%20s%E1%BA%AFng.jpg',
  },
  {
    name: 'Bông atiso',
    group_label: 'Rau củ',
    unit: 'Bông',
    image_url: 'https://atisodalat.vn/wp-content/uploads/2025/03/bong-atiso-1-247x185.jpg',
  },
  {
    name: 'Hoa hẹ',
    group_label: 'Rau củ',
    unit: 'Bó',
    image_url: 'https://cdn.tgdd.vn/Files/2021/07/19/1369330/bong-he-bong-hanh-la-gi-an-bong-he-co-tac-dung-gi-202107192108134041.jpg',
  },
  {
    name: 'Súp lơ trắng',
    group_label: 'Rau củ',
    unit: 'Búp',
    image_url: 'https://winmart.onl/assets/media/images/products/05975/oemslt081_0925_171625_6QgMsm.jpg',
  },
  {
    name: 'Khế chua',
    group_label: 'Rau củ',
    unit: 'Kg',
    image_url: 'https://files.benhvien108.vn/ecm/source_files/2022/10/19/221002-4-1-084318-191022-25.jpg',
  },
  {
    name: 'Quả dọc',
    group_label: 'Rau củ',
    unit: 'Kg',
    image_url: 'https://vnn-imgs-f.vgcloud.vn/2021/10/14/17/qua-doc-1-1.jpg?width=0&s=JdyAe_smmfEgR0qodqjH1g',
  },
  {
    name: 'Củ kiệu',
    group_label: 'Rau củ',
    unit: 'Kg',
    image_url: 'https://cdn.tgdd.vn/Products/Images/7459/233681/bhx/cu-kieu-chua-ngot-vasifood-hu-380g-202101211203120047.jpg',
  },
  {
    name: 'Lá mắc mật',
    group_label: 'Rau củ',
    unit: 'Bó',
    image_url: 'https://langsonshop.com/wp-content/uploads/2022/04/cay-mac-mat.webp',
  },
  {
    name: 'Quả mắc mật',
    group_label: 'Rau củ',
    unit: 'Kg',
    image_url: 'https://langsonshop.com/wp-content/uploads/2026/01/mac-mat-tuoi1.jpg',
  },
  {
    name: 'Lá chúc',
    group_label: 'Rau củ',
    unit: 'Bó',
    image_url: 'https://file.hstatic.net/1000387874/file/la-chanh-thai-1_affdc90b7da64cfebd2ad1eb54ea3cf7_grande.jpg',
  },

  // 2. Gia vị & nước chấm
  {
    name: 'Chẩm chéo',
    group_label: 'Gia vị & nước chấm',
    unit: 'Hũ',
    image_url: 'https://caonguabach.com/wp-content/uploads/2025/01/cham-cheo.webp',
  },
  {
    name: 'Mắm tép',
    group_label: 'Gia vị & nước chấm',
    unit: 'Hũ',
    image_url: 'https://media.loveitopcdn.com/41258/kcfinder/upload/images/mam-tep-chung-thit-hang-be.jpg',
  },
  {
    name: 'Tiêu sọ Phú Quốc',
    group_label: 'Gia vị & nước chấm',
    unit: 'Hũ',
    image_url: 'https://dhfoods.com.vn/upload/SP_Gia%20Vi%20Tu%20Nhien/2026/Natural-Tieu-So-Xay-Phu-Quoc-45g-New-b9c35029-b304-4f18-9c0a-2fcad5f2c7fb.webp',
  },
  {
    name: 'Nước màu dừa',
    group_label: 'Gia vị & nước chấm',
    unit: 'Chai',
    image_url: 'https://product.hstatic.net/200000460455/product/nuoc_mau_dua_ben_tre__chai_275gr__914e1d6ae739447e8bcbc2bc9b2e5cab_master.png',
  },

  // 3. Thủy hải sản
  {
    name: 'Cá chép giòn',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://hieuhaisan.com/datafiles/setone/17694874645819_ca-chep-1kg-bao-nhieu.jpg',
  },
  {
    name: 'Cá trắm đen',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://bactom.com/wp-content/uploads/2022/06/Cam-tram-den.webp',
  },
  {
    name: 'Cá trắm cỏ',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://anvita.sgp1.cdn.digitaloceanspaces.com/ubofood/images/ca-tram-co-khuc-tu-500g-700g-03080069300_1000_750_3fa61412-cc31-4751-968f-dbe50e96e877.JPEG',
  },
  {
    name: 'Cá rô đồng',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/10/image/Products/Images/8782/309126/bhx/ca-ro-lam-sach_202610021425010048.jpg',
  },
  {
    name: 'Cá thòi lòi',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://chihaisan.com/wp-content/uploads/2024/06/ca-thoi-loi-avr.png',
  },
  {
    name: 'Cá đuối',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://hieuhaisan.com/datafiles/setone/17411634684385_ca-duoi-dom-xanh.jpg',
  },
  {
    name: 'Cá cơm',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://cdn.tgdd.vn/Products/Images/8782/233745/bhx/ca-com-202408221623172166.jpg',
  },
  {
    name: 'Ốc nhồi',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://monngonmoingay.com/wp-content/uploads/2024/07/Cach-phan-biet-oc-buou-den-va-oc-buou-vang-rat-don-gian-MNMN-1.jpg',
  },
  {
    name: 'Ốc len',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://cdn.tgdd.vn/2022/01/CookDish/oc-len-la-gi-oc-len-song-o-dau-oc-len-mua-o-dau-va-bao-nhieu-avt-1200x676.jpg',
  },
  {
    name: 'Tu hài',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://www.haisanhanoi.net/templates/yootheme/cache/d9/tu-hai-canada-02_a9ce1-d901b89d.jpeg',
  },
  {
    name: 'Bào ngư',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/production/2025/12/image/Products/Images/8400/334534/bhx/bao-ngu-dong-lanh-tan-hai-hoa-khay-300g_202512310950338059.jpg',
  },
  {
    name: 'Hải sâm',
    group_label: 'Thủy hải sản',
    unit: 'Kg',
    image_url: 'https://danviet.ex-cdn.com/files/f1/296231569849192448/2021/8/7/haisam1-162832329687442423745.jpg',
  },

  // 4. Thịt
  {
    name: 'Thịt chim cút',
    group_label: 'Thịt',
    unit: 'Con',
    image_url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8790/310968/bhx/310968-1_202408272024103267.jpg',
  },
  {
    name: 'Gà ác',
    group_label: 'Thịt',
    unit: 'Con',
    image_url: 'https://cdn.hstatic.net/products/200001039902/19_ga-ac-tiem-thuoc-bac-1024x1024_8cd25a67f0d24127934a67f4dd2def92.png?width=800',
  },
  {
    name: 'Thịt thỏ',
    group_label: 'Thịt',
    unit: 'Kg',
    image_url: 'https://filebroker-cdn.lazada.vn/kf/S9f1ba357b25c4c25b83e7097989aa1a7t.jpg',
  },
  {
    name: 'Sườn bò',
    group_label: 'Thịt',
    unit: 'Kg',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2024/08/suon-bo.jpg',
  },
  {
    name: 'Cuống tim heo',
    group_label: 'Thịt',
    unit: 'Kg',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2026/09/cuong-tim-heo.jpg',
  },
  {
    name: 'Thịt nọng heo',
    group_label: 'Thịt',
    unit: 'Kg',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2026/08/nac-nong-heo.jpg',
  },

  // 5. Nông sản, Ngũ cốc, Đậu hạt
  {
    name: 'Cốm Làng Vòng',
    group_label: 'Nông sản & ngũ cốc',
    unit: 'Gói',
    image_url: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEib2oaNmiHYPiPG5Ddxn7kDEXEVaMyLbbFTh1AhQbV3mmj6hgbu_gyp01s_DyvQnFgFvc8eFv5zgRuk2dlr80odWDP65UCldmL_kuXuryoEDytszaPzwJz1oKZMyMWEgCfAbVu6H8Wv43g/s1600/com-lang-vong.jpg',
  },
  {
    name: 'Đậu ngự',
    group_label: 'Đậu & hạt',
    unit: 'Gói',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2024/07/dau-ngu-kho-nong-san-dung-ha.jpg',
  },
  {
    name: 'Hạt é',
    group_label: 'Đậu & hạt',
    unit: 'Gói',
    image_url: 'https://cdn.tgdd.vn/2021/12/CookDish/hat-e-la-gi-hat-e-tu-cay-gi-va-cach-phan-biet-hat-e-va-hat-avt-1200x676.jpg',
  },
  {
    name: 'Tàu hũ ky',
    group_label: 'Nông sản & ngũ cốc',
    unit: 'Gói',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2024/07/vang-dau-kho-sieu-thi-nong-san-dung-ha.jpg',
  },
  {
    name: 'Bánh tráng phơi sương',
    group_label: 'Nông sản & ngũ cốc',
    unit: 'Xấp',
    image_url: 'https://nongsandungha.com/wp-content/uploads/2024/07/banh-trang-phoi-suong-Tay-Ninh.jpg',
  },
];

async function verifyAll() {
  console.log(`=== ĐANG KIỂM TRA HTTP CHO 38 NGUYÊN LIỆU MỚI ===\n`);
  let success = 0;
  for (let i = 0; i < FINAL_38_INGREDIENTS.length; i++) {
    const item = FINAL_38_INGREDIENTS[i];
    try {
      const res = await fetch(item.image_url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: 'bytes=0-1024',
        },
      });
      if (res.ok && res.status < 400) {
        console.log(`[${i + 1}/38] ✓ [HTTP ${res.status}] ${item.name} (${item.group_label})`);
        success++;
      } else {
        console.log(`[${i + 1}/38] ✗ [HTTP ${res.status}] ${item.name}: ${item.image_url}`);
      }
    } catch (e: any) {
      console.log(`[${i + 1}/38] ✗ [ERR] ${item.name}: ${e.message}`);
    }
  }
  console.log(`\nKết quả: ${success}/${FINAL_38_INGREDIENTS.length} hình ảnh đạt chuẩn HTTP 200/206!`);
}

verifyAll();
