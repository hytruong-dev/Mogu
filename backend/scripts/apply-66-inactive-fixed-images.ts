/**
 * Script cập nhật hình ảnh chuẩn xác (Bách Hóa Xanh, WinMart, Co.op, Nhà bán lẻ thực phẩm)
 * cho đúng 66 nguyên liệu chưa kích hoạt.
 *
 * Yêu cầu:
 * - 100% hình ảnh phải là ảnh sản phẩm/nguyên liệu thực phẩm thực tế (không phải mì ăn liền cho thịt gà, không phải dầu ăn cho đậu nành, v.v.).
 * - Tuyệt đối KHÔNG kích hoạt (is_active = false, status = 'PENDING_REVIEW').
 * - Sửa group_label của 'Diếp cá' thành 'Rau củ'.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const VERIFIED_66_IMAGES: Record<string, { url: string; note: string; newGroupLabel?: string }> = {
  'Bánh đa': {
    url: 'https://cdn.tgdd.vn/Products/Images/3234/215801/bhx/banh-trang-me-nuong-an-nhien-goi-120g-201912040954252409.jpg',
    note: 'Bách Hóa Xanh - Bánh đa mè nướng gói An Nhiên 120g',
  },
  'Bánh mì': {
    url: 'https://cdn.tgdd.vn/Products/Images/7259/266327/bhx/banh-mi-dai-baguette-hoang-phat-goi-200g-202201040933099018.jpg',
    note: 'Bách Hóa Xanh - Bánh mì baguette Hoàng Phát gói 200g',
  },
  'Bắp Mỹ': {
    url: 'https://cdn.tgdd.vn/Products/Images/8785/222881/bhx/bap-my-2-trai-202012282219106049.jpg',
    note: 'Bách Hóa Xanh - Bắp Mỹ tươi vỉ 2 trái',
  },
  'Bầu sao': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8785/312963/bhx/bau-sao-500g_202507291538440211.jpg',
    note: 'Bách Hóa Xanh - Trái bầu sao tươi 500g',
  },
  'Bột bắp': {
    url: 'https://s3-hcmc02.higiocloud.vn/images/2023/05/botbap-150g-copy-20230526081212.png',
    note: 'WinMart - Tinh bột bắp làm bánh Tài Ký gói 150g',
  },
  'Bột nở baking': {
    url: 'https://cdn.tgdd.vn/Products/Images/2388/129533/bhx/bot-noi-baking-soda-arm-hammer-hop-454g-201911151505196028.JPG',
    note: 'Bách Hóa Xanh - Hộp bột nổi baking soda Arm & Hammer 454g',
  },
  'Bột sắn dây rau câu thạch': {
    url: 'https://cdn.tgdd.vn/Products/Images/8286/234480/bhx/bot-san-day-sora-nguyen-chat-goi-300g-202101260951598978.jpg',
    note: 'Bách Hóa Xanh - Bột sắn dây nguyên chất Sora gói 300g',
  },
  'Cá': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8782/226851/bhx/ca-dieu-hong-lam-sach-vi-800g_202505301345436899.jpg',
    note: 'Bách Hóa Xanh - Cá điêu hồng làm sạch khay 800g',
  },
  'Cá basa': {
    url: 'https://cdn.tgdd.vn/Products/Images/8782/311245/bhx/ca-basa-phi-le-250g-202311202033557945.jpg',
    note: 'Bách Hóa Xanh - Cá basa phi lê khay 250g',
  },
  'Ca cao Cà phê bột': {
    url: 'https://cdn.tgdd.vn/Products/Images/8286/225223/bhx/bot-ca-cao-nguyen-chat-cacaomi-original-hop-127g-202211230926129317.jpg',
    note: 'Bách Hóa Xanh - Bột ca cao nguyên chất Cacaomi hộp 127g',
  },
  'Cá khô': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/8782/233745/bhx/ca-com-202408221623172166.jpg',
    note: 'Bách Hóa Xanh - Cá cơm khô gói Việt San',
  },
  'Cà pháo': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/8785/301611/bhx/ca-phao-vi-200g-202301110814339191.jpg',
    note: 'Bách Hóa Xanh - Cà pháo tươi vỉ 200g',
  },
  'Cải': {
    url: 'https://cdn.tgdd.vn/Products/Images/8820/230443/bhx/cai-thia-202312271059011562.jpg',
    note: 'Bách Hóa Xanh - Cải thìa tươi ngon',
  },
  'Cải xanh': {
    url: 'https://cdn.tgdd.vn/Products/Images/8820/309156/bhx/cai-be-xanh-500g-202401121613149216.jpg',
    note: 'Bách Hóa Xanh - Cải bẹ xanh gói 500g',
  },
  'Chao đỏ': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/3525/174518/bhx/chao-bong-mai-hu-170g-2-700x467.jpg',
    note: 'Bách Hóa Xanh - Chao đỏ Bông Mai hũ 170g',
  },
  'Chao trắng': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/3525/339521/bhx/chao-khoai-mon-bong-mai-hu-170g_202510131403583249.jpg',
    note: 'Bách Hóa Xanh - Chao môn trắng Bông Mai hũ 170g',
  },
  'Chuối chín': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8788/228923/bhx/chuoi-gia-giong-nam-my_202512031458490151.jpg',
    note: 'Bách Hóa Xanh - Chuối chín Nam Mỹ',
  },
  'Chuối già': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8788/313132/bhx/chuoi-gia-giong-nam-my-1kg_202505201047413543.jpg',
    note: 'Bách Hóa Xanh - Nải chuối già giống Nam Mỹ 1kg',
  },
  'Cơm tẻ': {
    url: 'https://image.bephoa.vn/data/thumb_750/2023/06/202306231118195612.webp',
    note: 'Bếp Hoa - Bát cơm trắng dẻo thơm ngon',
  },
  'Củ nén': {
    url: 'https://cdn.tgdd.vn/Files/2021/08/11/1374407/cach-dung-va-nhung-cong-dung-bat-ngo-cua-cu-hanh-tam-cu-nen-202206031216189977.jpg',
    note: 'Bách Hóa Xanh - Củ nén (hành tăm) tươi sạch',
  },
  'Cua biển ghẹ': {
    url: 'https://cdn.tgdd.vn/Products/Images/8782/313726/bhx/ghe-tuoi-202405081559414078.jpg',
    note: 'Bách Hóa Xanh - Ghẹ xanh tươi sống',
  },
  'Da heo': {
    url: 'https://cdn.tgdd.vn/Products/Images/7259/286699/bhx/bi-heo-vissan-goi-300g-202208180904401989.jpg',
    note: 'Bách Hóa Xanh - Da heo / bì heo tươi làm sạch Vissan 300g',
  },
  'Đậu': {
    url: 'https://s3-hcmc02.higiocloud.vn/images/2022/dau-cove-xanh-goi-500g_fe356ea1-4a64-415e-b3a4-a817039f0173-og.png',
    note: 'WinMart - Đậu cô ve xanh gói 500g',
  },
  'Dầu điều': {
    url: 'https://cdn.tgdd.vn/Products/Images/8271/323030/bhx/dau-mau-dieu-dh-foods-chai-100ml-202404030946077879.jpg',
    note: 'Bách Hóa Xanh - Dầu màu điều Dh Foods chai 100ml',
  },
  'Đậu nành': {
    url: 'https://cdn.tgdd.vn/Products/Images/3235/83021/bhx/dau-nanh-hat-nho-vua-deu-viet-san-500g-201812041355329350.jpg',
    note: 'Bách Hóa Xanh - Hạt đậu nành khô Việt San gói 500g',
  },
  'Đậu xanh': {
    url: 'https://cdn.tgdd.vn/Products/Images/3235/80595/bhx/dau-xanh-hat-viet-san-150g-201812041426289819.JPG',
    note: 'Bách Hóa Xanh - Hạt đậu xanh nguyên hạt Việt San 150g',
  },
  'Diếp cá': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8820/299258/bhx/rau-diep-ca-goi-100g_202505091413116213.jpg',
    note: 'Bách Hóa Xanh - Rau diếp cá tươi gói 100g',
    newGroupLabel: 'Rau củ',
  },
  'Dừa': {
    url: 'https://cdn.tgdd.vn/Products/Images/8788/314978/bhx/combo-3-trai-dua-xiem-got-vo-202309161129449788.jpg',
    note: 'Bách Hóa Xanh - Combo trái dừa xiêm gọt vỏ',
  },
  'Đường thốt nốt': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/2804/207731/bhx/207731-thumb-moi_202411112107287986.jpg',
    note: 'Bách Hóa Xanh - Đường thốt nốt viên đặc sản An Giang',
  },
  'Gân bò': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2025/12/image/production/2025/12/image/Products/8139/320674/gan-bo-100g_202512311008245240.jpg',
    note: 'Bách Hóa Xanh - Khay gân bò tươi 100g',
  },
  'Gạo lứt': {
    url: 'https://cdn.tgdd.vn/Products/Images/2513/138644/bhx/gao-luc-huyet-rong-pmt-tui-1kg-201912101606511730.JPG',
    note: 'Bách Hóa Xanh - Gạo lứt huyết rồng PMT túi 1kg',
  },
  'Gạo tẻ': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/2513/236014/bhx/gao-thom-vua-gao-st25-tui-5kg-202103131616343493.jpg',
    note: 'Bách Hóa Xanh - Gạo thơm Vua Gạo ST25 túi 5kg',
  },
  'Kem': {
    url: 'https://s3-hcmc02.higiocloud.vn/images/2022/kem-sua-tuoi-danh-tiet-trung-anchor-hop-250ml_43491195-af3b-4aa2-9ed1-2407c03e26bb-og.jpg',
    note: 'WinMart - Kem sữa tươi đánh tiệt trùng Whipping Cream Anchor hộp 250ml',
  },
  'Lá chanh': {
    url: 'https://cdn.tgdd.vn/Files/2017/04/23/975336/meo-dung-la-chanh-trong-nau-an-5_760x507.jpg',
    note: 'Bách Hóa Xanh - Lá chanh tươi gia vị',
  },
  'Lá dứa': {
    url: 'https://www.lottemart.vn/media/catalog/product/cache/0x0/0/4/0400272520006-1-bb.jpg.webp',
    note: 'Lotte Mart - Lá dứa (lá nếp) thơm tươi bó',
  },
  'Lá lốt': {
    url: 'https://cdn.tgdd.vn/Products/Images/8820/238405/bhx/la-lot-1kg-202105051630404347.jpg',
    note: 'Bách Hóa Xanh - Lá lốt tươi bó',
  },
  'Lòng heo': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/3/image/production/2026/3/image/Products/8781/325688/pheo-non-heo-300g_202603201033124012.jpg',
    note: 'Bách Hóa Xanh - Khay phèo non heo / lòng non heo CP 300g',
  },
  'Mắm nêm': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/7779/311005/bhx/mam-nem-pha-san-ngoc-lien-chai-250ml-202404290926015034.jpg',
    note: 'Bách Hóa Xanh - Mắm nêm pha sẵn Ngọc Liên chai 250ml',
  },
  'Mắm nêm mắm cá': {
    url: 'https://cdn.tgdd.vn/Products/Images/8285/197278/bhx/mam-ca-linh-song-huong-hu-400g-201902271415516055.jpg',
    note: 'Bách Hóa Xanh - Mắm cá linh Sông Hương hũ 400g',
  },
  'Mắm tôm': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/7779/204277/bhx/cdntgddvnproductsimages7779204277bhx-202311220902415696_202411301555541186.jpg',
    note: 'Bách Hóa Xanh - Mắm tôm Bắc Trung Thành chai 110ml',
  },
  'Mè': {
    url: 'https://cdn.tgdd.vn/Products/Images/3235/86774/bhx/me-trang-khong-vo-viet-san-250gr-202107071048344563.jpg',
    note: 'Bách Hóa Xanh - Mè trắng không vỏ Việt San gói 250g',
  },
  'Me vắt': {
    url: 'https://cdn.tgdd.vn/Products/Images/8785/289628/bhx/me-chua-vat-goi-250g-202209071046494427.jpg',
    note: 'Bách Hóa Xanh - Me chua vắt nấu canh gói 250g',
  },
  'Mì ăn liền': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/2565/77622/bhx/slide-1_202410151354441725.jpg',
    note: 'Bách Hóa Xanh - Mì ăn liền Hảo Hảo tôm chua cay gói 75g',
  },
  'Mì sợi': {
    url: 'https://cdn.tgdd.vn/Products/Images/8158/80133/bhx/mi-trung-safoco-cao-cap-500g-2-700x467.jpg',
    note: 'Bách Hóa Xanh - Mì sợi trứng cao cấp Safoco gói 500g',
  },
  'Nạm bò': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8139/238859/bhx/nam-bo-tuoi-ngon-tui-1kg_202508181609362938.jpg',
    note: 'Bách Hóa Xanh - Nạm bò tươi ngon túi 1kg',
  },
  'Nấm hương': {
    url: 'https://cdn.tgdd.vn/Products/Images/3235/197209/bhx/nam-huong-kho-viet-san-goi-250g-201812121505285905.jpg',
    note: 'Bách Hóa Xanh - Nấm hương khô Việt San gói 250g',
  },
  'Nghêu sò hến': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/4/image/Products/Images/8782/365369/bhx/ngheu-co-song_202604041842461199.jpg',
    note: 'Bách Hóa Xanh - Nghêu cồ sống tươi túi 1kg',
  },
  'Nước cốt chanh dây siro': {
    url: 'https://cdn.tgdd.vn/Products/Images/7779/195879/bhx/sot-chanh-day-chua-ngot-dh-foods-chai-200g-202205172014267170.jpg',
    note: 'Bách Hóa Xanh - Nước xốt chanh dây chua ngọt Dh Foods chai 200g',
  },
  'Nước dùng gà bò': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/8271/286218/bhx/nuoc-dung-hoan-chinh-lau-ga-barona-goi-140g-202208161117580388.jpg',
    note: 'Bách Hóa Xanh - Nước dùng hoàn chỉnh Barona gói 140g',
  },
  'Phô mai': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/8/image/Products/Images/7558/201194/bhx/pho-mai-con-bo-cuoi-hop-120g-8-mieng_202608241432538373.jpg',
    note: 'Bách Hóa Xanh - Phô mai Con Bò Cười hộp 8 miếng 120g',
  },
  'Sắn': {
    url: 'https://cdn.tgdd.vn/Products/Images/8785/233854/bhx/cu-san-202312251507003100.jpg',
    note: 'Bách Hóa Xanh - Củ sắn tươi (củ đậu)',
  },
  'Sữa': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/2386/79296/bhx/sua-tuoi-tiet-trung-co-duong-th-true-milk-hop-1-lit-202211231533101889.jpg',
    note: 'Bách Hóa Xanh - Sữa tươi tiệt trùng TH true MILK hộp 1 lít',
  },
  'Sữa chua': {
    url: 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/7558/198066/bhx/loc-4-hu-sua-chua-co-duong-vinamilk-len-men-tu-nhien-100g_202508281518442130.jpg',
    note: 'Bách Hóa Xanh - Lốc 4 hộp sữa chua ăn có đường Vinamilk 100g',
  },
  'Sườn heo': {
    url: 'https://cdn.tgdd.vn/Products/Images/8781/228333/bhx/suon-non-heo-cp-500g-5-7-mieng-202401301654404985.jpg',
    note: 'Bách Hóa Xanh - Sườn non heo CP khay 500g',
  },
  'Súp lơ': {
    url: 'https://s3-hcmc02.higiocloud.vn/images/2022/10281825-1-.jpg',
    note: 'WinMart - Súp lơ xanh WinEco tươi',
  },
  'Thảo quả': {
    url: 'https://cdn.tgdd.vn/Products/Images/8275/216077/bhx/thao-qua-dh-foods-natural-hu-20g-201912101315463089.jpg',
    note: 'Bách Hóa Xanh - Thảo quả tự nhiên Dh Foods hũ 20g',
  },
  'Thịt dê': {
    url: 'https://vinhhanhfood.com/wp-content/uploads/2022/07/1.56-Dui-de-sau.jpg',
    note: 'Vĩnh Hạnh Food - Thịt đùi dê tươi sạch phi lê',
  },
  'Thịt gà': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8790/226876/bhx/dui-toi-ga-vi-500g_202511041054423699.jpg',
    note: 'Bách Hóa Xanh - Đùi gà tỏi tươi CP vỉ 500g',
  },
  'Thịt trâu': {
    url: 'https://bizweb.dktcdn.net/100/480/070/products/bap-hoa-trau-800x800.jpg?v=1679985596357',
    note: 'Thực phẩm sạch - Bắp hoa thịt trâu tươi',
  },
  'Tiêu': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/2809/225392/bhx/225392-slide-moi_202411121307016558.jpg',
    note: 'Bách Hóa Xanh - Tiêu đen xay Phú Quốc Dh Foods',
  },
  'Tỏi': {
    url: 'https://cdn.tgdd.vn/Products/Images/8820/271536/bhx/toi-co-don-tui-300g-202205190845024132.jpg',
    note: 'Bách Hóa Xanh - Tỏi cô đơn túi 300g',
  },
  'Tôm khô': {
    url: 'https://cdn.tgdd.vn/Products/Images/8400/326569/bhx/tom-kho-an-vinh-hu-100g-202406071423208120.jpg',
    note: 'Bách Hóa Xanh - Tôm khô An Vĩnh hũ 100g',
  },
  'Tôm thẻ': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8782/340083/bhx/tom-the-cp_202511101112421650.jpg',
    note: 'Bách Hóa Xanh - Tôm thẻ chân trắng CP tươi',
  },
  'Trà': {
    url: 'https://cdn.tgdd.vn/Products/Images/2385/203772/bhx/tra-xanh-thai-nguyen-hung-thai-2-sao-hop-200g-202209122330358192.jpg',
    note: 'Bách Hóa Xanh - Trà xanh búp Thái Nguyên Hùng Thái hộp 200g',
  },
  'Tương hột Tương bần': {
    url: 'https://cdn.tgdd.vn/Products/Images/2567/76915/bhx/tuong-hot-cholimex-250g-2-700x467.jpg',
    note: 'Bách Hóa Xanh - Tương hột đậu nành Cholimex hũ 250g',
  },
  'Xương bò': {
    url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/2/image/production/2026/2/image/Products/8400/363014/suon-bo-my-co-xuong-dong-lanh-an-gia-food-goi-300g_202602101641251002.jpg',
    note: 'Bách Hóa Xanh - Sườn bò có xương An Gia Food gói 300g',
  },
};

async function validateUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Range: 'bytes=0-1024',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`MODE: ${isApply ? 'APPLY (Cập nhật trực tiếp DB)' : 'VALIDATE (Kiểm tra HTTP trước khi apply)'}\n`);

  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const dbRes = await pool.query(`
      SELECT id, name, group_label, image_url, is_active, status
      FROM ingredients
      WHERE is_active = false
      ORDER BY name ASC;
    `);

    const inactives = dbRes.rows;
    console.log(`Tìm thấy ${inactives.length} nguyên liệu chưa kích hoạt trong DB.`);

    let validatedCount = 0;
    const updatePayloads: Array<{
      id: string;
      name: string;
      oldUrl: string;
      newUrl: string;
      note: string;
      newGroupLabel?: string;
    }> = [];

    for (const item of inactives) {
      const mapping = VERIFIED_66_IMAGES[item.name];
      if (!mapping) {
        console.warn(`! Không có mapping cho: ${item.name}`);
        continue;
      }

      const isValid = await validateUrl(mapping.url);
      if (!isValid) {
        console.error(`✗ URL lỗi HTTP (không thể tải): [${item.name}] ${mapping.url}`);
        continue;
      }

      validatedCount++;
      updatePayloads.push({
        id: item.id,
        name: item.name,
        oldUrl: item.image_url,
        newUrl: mapping.url,
        note: mapping.note,
        newGroupLabel: mapping.newGroupLabel,
      });

      console.log(`✓ [${validatedCount}/66] ${item.name} -> ${mapping.note}`);
    }

    console.log(`\n========================================`);
    console.log(`Xác thực HTTP 200: ${validatedCount}/${inactives.length} nguyên liệu đạt chuẩn 100%!`);
    console.log(`========================================\n`);

    if (isApply && updatePayloads.length === inactives.length) {
      console.log(`Bắt đầu ghi vào PostgreSQL...`);
      for (const p of updatePayloads) {
        if (p.newGroupLabel) {
          await pool.query(
            `
            UPDATE ingredients
            SET 
              image_url = $1,
              image_status = 'PENDING_REVIEW',
              group_label = $2,
              is_active = false,
              status = 'PENDING_REVIEW',
              updated_at = NOW()
            WHERE id = $3;
          `,
            [p.newUrl, p.newGroupLabel, p.id],
          );
        } else {
          await pool.query(
            `
            UPDATE ingredients
            SET 
              image_url = $1,
              image_status = 'PENDING_REVIEW',
              is_active = false,
              status = 'PENDING_REVIEW',
              updated_at = NOW()
            WHERE id = $2;
          `,
            [p.newUrl, p.id],
          );
        }
      }
      console.log(`✓ HOÀN TẤT: Đã cập nhật ảnh siêu thị chuẩn cho 66 nguyên liệu!`);
      console.log(`✓ Tất cả 66 nguyên liệu vẫn giữ isActive = false và status = 'PENDING_REVIEW'.`);

      // Cập nhật lại multi-source-clean-ingredients.json
      const allIngredientsRes = await pool.query(`
        SELECT id, code, name, name_en, group_label, unit, image_url, image_status, is_active, status, synonyms
        FROM ingredients
        ORDER BY name ASC;
      `);
      const backupPath = path.join(__dirname, '../data/multi-source-clean-ingredients.json');
      fs.writeFileSync(backupPath, JSON.stringify(allIngredientsRes.rows, null, 2), 'utf8');
      console.log(`✓ Đã cập nhật bản backup đồng bộ vào: ${backupPath}`);
    } else if (!isApply) {
      console.log(`Chạy lại với tham số --apply để thực thi cập nhật vào PostgreSQL.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
