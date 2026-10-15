import * as dotenv from 'dotenv';
import * as path from 'path';

export const FIXED_15_PERFECT: Record<string, { url: string; note: string }> = {
  'Cá mè': {
    url: 'https://tepbac.com/upload/species/ge_image/Ca-me-hoa_Aristichthys-nobilis.jpg',
    note: 'Tép Bạc - Cá mè hoa tươi nguyên con rõ nét chuẩn sinh vật học ẩm thực',
  },
  'Cá trích': {
    url: 'https://ghesong.vn/upload/images/ca-trich-tuoi-sach.jpg',
    note: 'Cá trích tươi biển làm sạch nguyên con óng ánh tươi ngon',
  },
  'Củ ấu': {
    url: 'https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/cach_luoc_cu_au_thumb_b20b410581.jpg',
    note: 'Đĩa củ ấu sừng trâu vỏ đen bóng luộc chín thơm bùi',
  },
  'Đinh hương': {
    url: 'https://bizweb.dktcdn.net/thumb/grande/100/525/457/products/cloves-whole-100gr-2-1770697666839.png?v=1777019212973',
    note: 'Nụ đinh hương khô nguyên nụ (Cloves Whole) nền trắng bao bì chuẩn',
  },
  'Khoai từ': {
    url: 'https://trucvufarm.com.vn/wp-content/uploads/2025/08/20240717194641-101tac_dung_cua_cu_tu_long_1.jpg',
    note: 'Rổ củ khoai từ lông tươi nguyên củ tròn nạc đất mẹ',
  },
  'Lá cách': {
    url: 'https://cdn.medigoapp.com/product/la_cach_e5537e1ce7.png',
    note: 'Cành lá cách tươi xanh đậm phiến lá răng cưa chuẩn ẩm thực miền Tây',
  },
  'Lá cẩm': {
    url: 'https://cdn.tgdd.vn/Files/2021/10/09/1389010/la-cam-la-la-gi-cong-dung-va-cac-mon-an-ngon-tu-la-cam-202201110136011976.jpg',
    note: 'Bách Hóa Xanh - Bó cành lá cẩm tím tươi ngắt sạch',
  },
  'Lá chuối': {
    url: 'https://legiang.vn/static/product/2022/0826/la%20chuoi%20mau%20dam-774.jpg',
    note: 'Tàu lá chuối xiêm xanh mướt cắt xếp phẳng chuẩn gói giò chả bánh tét',
  },
  'Lá é': {
    url: 'https://www.huongnghiepaau.com/wp-content/uploads/2025/07/nguyen-lieu-lam-lau-ga-la-e.jpg',
    note: 'Đĩa lá é trắng tươi sạch Phú Yên ngắt ngọn tươi ngon nhúng lẩu gà',
  },
  'Rau càng cua': {
    url: 'https://thucphamdongxanh.com/wp-content/uploads/2019/09/Rau-cang-cua-510x510.png',
    note: 'Thực Phẩm Đồng Xanh - Rau càng cua non mướt nền trắng sạch',
  },
  'Rau chùm ngây': {
    url: 'https://medlatec.vn/media/13444/content/20201015_cay-chum-ngay-1.jpg',
    note: 'Cành lá rau chùm ngây tươi xanh mướt nguyên lá dinh dưỡng',
  },
  'Sườn sụn heo': {
    url: 'https://bizweb.dktcdn.net/100/485/487/products/f3a609d517163c92afe6b7db36eb6d75-1684891600020.jpg?v=1752486345857',
    note: 'Khay sườn sụn non heo tươi hồng sạch cắt miếng',
  },
  'Tai chua': {
    url: 'https://trungtamduoclieu.vn/files/sanpham/435/1/jpg/tai-chua.jpg',
    note: 'Lát quả tai chua phơi khô tròn đều sạch chuẩn nấu canh chua miền Bắc',
  },
  'Thịt bê': {
    url: 'https://phanphoithucpham.com.vn/upload/hinhanh/thumb/thit-vai-be-tuoi-co-da-hao-hang5587.png',
    note: 'Thịt vai bê tơ tươi có da thui vàng nguyên khối tươi ngon',
  },
  'Thịt ngỗng': {
    url: 'https://upload.mybota.vn/upload/web/50/508613/product/2015/12/08/06/33/144955639898.jpg',
    note: 'Thịt ngỗng làm sạch nguyên con tươi sạch chuẩn thực phẩm sạch',
  },
};

async function verify15() {
  console.log(`Đang kiểm tra kết nối HTTP cho 15 ảnh nguyên liệu tinh chỉnh...`);
  let passed = 0;
  let failed = 0;

  for (const [name, info] of Object.entries(FIXED_15_PERFECT)) {
    try {
      const res = await fetch(info.url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: 'bytes=0-1024',
        },
      });

      if (res.ok && res.status < 400) {
        passed++;
        console.log(`✓ [${name}] OK (${res.status})`);
      } else {
        console.error(`✗ [${name}] FAIL (${res.status}) -> ${info.url}`);
        failed++;
      }
    } catch (e: any) {
      console.error(`✗ [${name}] ERR: ${e.message} -> ${info.url}`);
      failed++;
    }
  }

  console.log(`\nKết quả: ${passed}/15 Passed, ${failed} Failed`);
}

if (require.main === module) {
  verify15().catch(console.error);
}
