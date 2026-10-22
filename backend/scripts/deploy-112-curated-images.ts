import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const verifiedMap: Record<string, string> = {
  // 1. Tinh bột & Ngũ cốc
  'banh-da-do-hai-phong-tuoi-tppoj': 'https://upload.wikimedia.org/wikipedia/commons/8/81/BANH_DA_CUA_1.jpg',
  'banh-quay-gion-dsr7f': 'https://upload.wikimedia.org/wikipedia/commons/7/78/Youtiao.jpg',
  'banh-trang-me-nuong-njpz9': 'https://cdn.tgdd.vn/Products/Images/3234/215801/bhx/banh-trang-me-nuong-an-nhien-goi-120g-201912040954252409.jpg',
  'bi-heo-tron-thinh-gao-04aqb': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg/960px-C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg',
  'bot-gia-vi-bo-kho-iayya': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Bo_kho_mien_Bac.jpg/960px-Bo_kho_mien_Bac.jpg',
  'bot-tom-chay-hue-ruoc-tom-8dwof': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/T%C3%B4m_kh%C3%B4_%E1%BB%9F_B%E1%BA%A1c_Li%C3%AAu.jpg/960px-T%C3%B4m_kh%C3%B4_%E1%BB%9F_B%E1%BA%A1c_Li%C3%AAu.jpg',
  'bun-soi-to-bun-bo-hue-eueh4': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Bun-Bo-Hue-from-Huong-Giang-2011.jpg/960px-Bun-Bo-Hue-from-Huong-Giang-2011.jpg',
  'cha-bo-da-nang-hkz0k': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Gi%C3%B2_l%E1%BB%A5a_2.jpg/960px-Gi%C3%B2_l%E1%BB%A5a_2.jpg',
  'cha-bong-thit-heo-ruoc-fr1ql': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Rousong_pork_floss.jpg/960px-Rousong_pork_floss.jpg',
  'cha-ca-thu-chien-hap-6ki89': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Ch%E1%BA%A3_c%C3%A1.jpg/960px-Ch%E1%BA%A3_c%C3%A1.jpg',
  'cha-com-ha-noi-0jqaq': 'https://upload.wikimedia.org/wikipedia/commons/1/11/B%C3%BAn_%C4%91%E1%BA%ADu_m%E1%BA%AFm_t%C3%B4m_%282019%29.jpg',
  'cha-cua-hue-nxsuq': 'https://cdn.tgdd.vn/Products/Images/7259/258268/bhx/cha-cua-hue-ngon-ngon-goi-300g-202112091451107828.jpg',
  'cha-trung-hap-thit-viwuf': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg/960px-C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg',
  'chanh-tuoi-va-ot-hiem-ts23x': 'https://s3-hcmc02.higiocloud.vn/images/2023/02/chanh-khong-hat-500g.jpg',
  'chi-chuong-hai-phong-ot-chung-095en': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Chili_oil.jpg/960px-Chili_oil.jpg',
  'com-trang-com-nguoi-s0hyk': 'https://upload.wikimedia.org/wikipedia/commons/3/39/Meshi.jpg',
  'cu-cai-muoi-kho-xa-bau-tq7as': 'https://upload.wikimedia.org/wikipedia/commons/5/57/Daikon%2C_Nara_Prefecture%2C_Japan.jpg',
  'cu-ngai-bun-tuoi-lmv3l': 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Temu_kunci.png',
  'cu-san-tuoi-cu-dau-mmw68': 'https://s3-hcmc02.higiocloud.vn/images/2022/cu-dau.jpg',
  'dau-phong-rang-lac-rang-tx3n7': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Fried_groundnuts.jpg',
  'dau-phu-ran-vang-h6kub': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Tahu_digoreng.JPG',
  'do-chua-ie01z': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/%C4%90%E1%BB%93_chua.jpg',
  'do-chua-ca-rot-cu-cai-jxacf': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/%C4%90%E1%BB%93_chua.jpg',
  'doi-sun-chien-mien-nam-o9mmm': 'https://upload.wikimedia.org/wikipedia/commons/3/34/D%E1%BB%93i.jpg',
  'du-du-chua-ngam-gion-k9s9r': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/B%C3%BAn_ch%E1%BA%A3_Th%E1%BB%A5y_Khu%C3%AA.jpg/960px-B%C3%BAn_ch%E1%BA%A3_Th%E1%BB%A5y_Khu%C3%AA.jpg',
  'dua-leo-va-ca-chua-tuoi-yym2k': 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8785/226881/bhx/dua-leo-tui-500g_202504140837248711.jpg',
  'dui-ga-goc-tu-4kxf3': 'https://s3-hcmc02.higiocloud.vn/images/2024/12/10283205-20241205094015.jpg',
  'gach-ghe-xao-dau-dieu-yremn': 'https://cdn.tgdd.vn/Products/Images/8271/323030/bhx/dau-mau-dieu-dh-foods-chai-100ml-202404030946077879.jpg',
  'gan-heo-tuoi-zones': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/226834/ba-roi-heo-1kg_202607300933343971.jpg',
  'gao-tam-thom-iq9ex': 'https://s3-hcmc02.higiocloud.vn/images/2023/09/gao-tam-20230926064926.png',
  'gia-vi-nau-an-tong-hop-m0pvq': 'https://cdn.tgdd.vn/Products/Images/8271/233816/bhx/toi-phi-tui-50g-202101260032288093.jpg',
  'gia-vi-uop-toi-gung-s18r6': 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-toi-ot-100g.jpg',
  'gio-lua-truyen-thong-bkhik': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/10/image/Products/Images/7618/316994/bhx/cha-lua-cp-goi-500g_202610061115366141.jpg',
  'gio-song-moc-66b6u': 'https://thucphamnhanh.com/wp-content/uploads/2023/02/gio-song-moc-ga-cp-goi-500g-dong.jpg',
  'hanh-kho-hanh-cu-tim-4gybv': 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-toi-ot-100g.jpg',
  'hanh-la-va-mui-tau-ngo-gai-x7vr7': 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/8820/309145/bhx/ngo-gai-rau-om-50g-202306081026496827.jpg',
  'hanh-la-va-ngo-ri-uxy0m': 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-hanh-la-ngo-ri-50g.jpg',
  'hanh-la-va-rau-mui-ngo-ri-k24wf': 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-hanh-la-ngo-ri-50g.jpg',
  'hanh-la-va-rau-ram-tuoi-9pa00': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rau_ram_Polygonum_odoratum.jpg',
  'hanh-la-va-thi-la-tuoi-b4ffv': 'https://s3-hcmc02.higiocloud.vn/images/2022/thi-la-50g_04aeae6f-f85d-438b-9a67-4e5224b88fa0-og.jpg',
  'hanh-tim-phi-gion-yv2fj': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/H%C3%A0nh_phi.JPG/960px-H%C3%A0nh_phi.JPG',
  'hanh-tim-va-gung-nuong-810f0': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Star_anise_stack.jpg/960px-Star_anise_stack.jpg',
  'hat-dieu-mau-hat-ca-ri-ca29m': 'https://cdn.tgdd.vn/Products/Images/8271/323030/bhx/dau-mau-dieu-dh-foods-chai-100ml-202404030946077879.jpg',
  'hoa-hoi-va-que-thanh-h89rx': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Star_anise_stack.jpg/960px-Star_anise_stack.jpg',
  'hu-tieu-dai-iksax': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu.jpg/960px-H%E1%BB%A7_t%C3%ADu.jpg',
  'kho-muc-mini-nuong-nau-nuoc-dung-0c5iz': 'https://cdn.tgdd.vn/Products/Images/8400/327779/bhx/muc-kho-size-s-an-vinh-goi-200g-202407091448096560.jpg',
  'khoanh-gio-heo-xh2jw': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/233783/chan-gio-heo-1kg_202607301031597500.jpg',
  'khuon-chen-sanh-lam-banh-beo-k22j1': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/B%C3%A1nh_b%C3%A8o.jpg',
  'la-dong-goi-banh-tuoi-wowmt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/L%C3%A1_dong.jpg/960px-L%C3%A1_dong.jpg',
  'la-lot-va-tia-to-u7jym': 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Piper_sarmentosum.jpg',
  'la-oi-banh-te-tuoi-6uu83': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Fermented_pork_wrap.jpg/960px-Fermented_pork_wrap.jpg',
  'lap-xuong-mai-que-lo-eaogu': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Chinesesausageunpackaged.jpg',
  'mi-trung-tuoi-soi-tron-2ji9y': 'https://upload.wikimedia.org/wikipedia/commons/7/75/Chinese_egg_noodles.jpg',
  'mo-ga-thang-yd9pe': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Gaenseschmalz-1.jpg/960px-Gaenseschmalz-1.jpg',
  'mo-hanh-la-liv0t': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/B%C3%A1nh_h%E1%BB%8Fi_tr%C3%ACnh_b%C3%A0y_tr%C3%AAn_%C4%91%C4%A9a.jpg/960px-B%C3%A1nh_h%E1%BB%8Fi_tr%C3%ACnh_b%C3%A0y_tr%C3%AAn_%C4%91%C4%A9a.jpg',
  'muoi-ot-xanh-cham-hai-san-7dr3s': 'https://www.lottemart.vn/media/catalog/product/cache/0x0/8/9/8936046120049.jpg.webp',
  'nam-bao-ngu-xam-tuoi-4pf85': 'https://cdn.tgdd.vn/Products/Images/8779/226955/bhx/nam-bao-ngu-trang-goi-300g-202212021431259434.jpg',
  'nem-chua-cay-gu1vh': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Fermented_pork_wrap.jpg/960px-Fermented_pork_wrap.jpg',
  'nem-ran-cha-gio-pqzw3': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Cha_gio.jpg',
  'nuoc-cham-nem-chua-ngot-25wxw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/B%C3%BAn_ch%E1%BA%A3_Th%E1%BB%A5y_Khu%C3%AA.jpg/960px-B%C3%BAn_ch%E1%BA%A3_Th%E1%BB%A5y_Khu%C3%AA.jpg',
  'nuoc-cot-me-chua-wvk4w': 'https://cdn.tgdd.vn/Products/Images/8785/222877/bhx/me-chua-vat-hop-68g-202205181657130760.jpg',
  'nuoc-ham-xuong-u7jws': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Making_stock_for_pho_bo.jpg/960px-Making_stock_for_pho_bo.jpg',
  'nuoc-ham-xuong-heo-lnoi9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Making_stock_for_pho_bo.jpg/960px-Making_stock_for_pho_bo.jpg',
  'nuoc-luoc-ga-fgizi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Making_stock_for_pho_bo.jpg/960px-Making_stock_for_pho_bo.jpg',
  'nuoc-ma-long-me-ga-fmrpt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Making_stock_for_pho_bo.jpg/960px-Making_stock_for_pho_bo.jpg',
  'nuoc-sot-tron-iksef': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Hoisin_sauce_1.jpg/960px-Hoisin_sauce_1.jpg',
  'ot-chung-sa-te-6t7n3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Chili_oil.jpg/960px-Chili_oil.jpg',
  'pa-te-gan-heo-beo-gqbsj': 'https://img.bhxwork.vn/imgt/bhx/f_webp,fit_outside,quality_95,s_720x584/https://cdn.tgdd.vn/Products/Images/3238/325695/bhx/pate-gan-heo-wyn-150g-202405101403148039.jpg',
  'pheo-non-heo-tuoi-long-non-0anzl': 'https://upload.wikimedia.org/wikipedia/commons/3/34/D%E1%BB%93i.jpg',
  'phi-le-ca-ro-phi-tuoi-2xvne': 'https://cdn.tgdd.vn/Products/Images/8782/312448/bhx/ca-ro-phi-lam-sach-500g-202308030914149318.jpg',
  'que-thanh-cao-vo-aerwl': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Star_anise_stack.jpg/960px-Star_anise_stack.jpg',
  'rau-an-lau-mam-thap-cam-keo-neo-rau-dang-dien-dien-bong-sung-ym62o': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/L%E1%BA%A9u_m%E1%BA%AFm.jpg/960px-L%E1%BA%A9u_m%E1%BA%AFm.jpg',
  'rau-cai-xanh-cai-cay-zzvxf': 'https://cdn.tgdd.vn/Products/Images/8820/309156/bhx/cai-be-xanh-500g-202401121613149216.jpg',
  'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Boiled_vegetables.jpg/960px-Boiled_vegetables.jpg',
  'rau-kinh-gioi-va-rau-mui-01m1e': 'https://upload.wikimedia.org/wikipedia/commons/1/11/B%C3%BAn_%C4%91%E1%BA%ADu_m%E1%BA%AFm_t%C3%B4m_%282019%29.jpg',
  'rau-mam-cu-cai-trang-jecym': 'https://s3-hcmc02.higiocloud.vn/images/2022/10281839.jpg',
  'rau-song-idzyt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg/960px-C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg',
  'rau-song-an-kem-ulcnw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg/960px-C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg',
  'rau-song-chuoi-chat-khe-chua-mvyl3': 'https://files.benhvien108.vn/ecm/source_files/2022/10/19/221002-4-1-084318-191022-25.jpg',
  'rau-song-hoa-chuoi-bup-non-o7chr': 'https://cdn.tgdd.vn/Files/2018/05/23/1090326/hoa-chuoi-va-nhung-cong-dung-it-ai-biet1_800x400.jpg',
  'rau-xa-lach-va-hung-lui-31xfb': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg/960px-C%C6%A1m_T%E1%BA%A5m%2C_Da_Nang%2C_Vietnam.jpg',
  'ruot-banh-mi-xe-vun-xqcxg': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Bread_crumbs.jpg',
  'ruou-vang-do-nau-an-5yg6f': 'https://upload.wikimedia.org/wikipedia/en/c/c0/Red_Wine_Glass.jpg',
  'soi-banh-canh-bot-gao-4e1if': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/B%C3%A1nh_canh_Cua.jpg/960px-B%C3%A1nh_canh_Cua.jpg',
  'soi-banh-canh-bot-loc-mzaqg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/B%C3%A1nh_canh_Cua.jpg/960px-B%C3%A1nh_canh_Cua.jpg',
  'soi-hu-tieu-my-tho-botuy': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu.jpg/960px-H%E1%BB%A7_t%C3%ADu.jpg',
  'soi-mi-cao-lau-tuoi-dulqb': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Cao_l%E1%BA%A7u_%28144854_994%29.jpg/960px-Cao_l%E1%BA%A7u_%28144854_994%29.jpg',
  'soi-mi-quang-vang-c5wl5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Mi_Quang_1A_Danang.jpg/960px-Mi_Quang_1A_Danang.jpg',
  'sot-tuong-den-cay-gb19u': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Hoisin_sauce_1.jpg/960px-Hoisin_sauce_1.jpg',
  'sua-bien-tuoi-lam-sach-0r7x5': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Jellyfish_salad_Vietnamese.jpg/960px-Jellyfish_salad_Vietnamese.jpg',
  'suon-cot-let-heo-tuoi-mag0f': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/226834/ba-roi-heo-1kg_202607300933343971.jpg',
  'than-chuoi-non-bao-mong-2xbkv': 'https://cdn.tgdd.vn/Files/2018/05/23/1090326/hoa-chuoi-va-nhung-cong-dung-it-ai-biet1_800x400.jpg',
  'thinh-gao-rang-min-w4wsm': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Khao_khua.jpg',
  'thit-ba-chi-heo-tuoi-5q9rd': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/226834/ba-roi-heo-1kg_202607300933343971.jpg',
  'thit-bo-kho-mieng-soi-tam-vi-xkvmb': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/B%C3%B2_kh%C3%B4_-_Vietnam.jpg/960px-B%C3%B2_kh%C3%B4_-_Vietnam.jpg',
  'thit-ca-ngu-hoac-ca-co-yjkqn': 'https://cdn.tgdd.vn/Files/2017/11/18/1042600/cach-chon-ca-thu-tuoi-ngon-dinh-duong-cho-chi-em-noi-tro-202206111324556578.jpg',
  'thit-cua-bien-tuoi-go-san-q6o2t': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Peeled_crab_meat.JPG/960px-Peeled_crab_meat.JPG',
  'thit-ghe-tuoi-boc-san-u9h5m': 'https://cdn.tgdd.vn/Products/Images/8400/236777/bhx/thit-cang-ghe-dong-lanh-mama-food-goi-150g-202104060951357746.jpg',
  'thit-hen-tuoi-luoc-san-g4pqa': 'https://s3-hcmc02.higiocloud.vn/images/2022/thit-hen-lam-sach_c612a941-9b5b-4e2c-a7c2-7518219f8826-og.jpg',
  'thit-heo-quay-gion-bi-kop4s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Th%E1%BB%8Bt_heo_quay_b%C3%AC_gi%C3%B2n.jpg/960px-Th%E1%BB%8Bt_heo_quay_b%C3%AC_gi%C3%B2n.jpg',
  'thit-ma-dau-heo-tah6a': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/3/image/Products/Images/8781/309294/bhx/tai-heo-300g_202603201031481217.jpg',
  'thit-nac-vai-heo-ljwlc': 'https://s3-hcmc02.higiocloud.vn/images/2024/12/10617956-20241205094748.jpg',
  'thit-qua-gac-tuoi-zw33x': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Qua_Gac.JPG/960px-Qua_Gac.JPG',
  'thit-xa-xiu-ikscz': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Charsiu.jpg',
  'tinh-dau-ca-cuong-nguyen-chat-gwho4': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Lethocerus_indicus.jpg/960px-Lethocerus_indicus.jpg',
  'toi-phi-vang-thom-tzsln': 'https://cdn.tgdd.vn/Products/Images/8271/233816/bhx/toi-phi-tui-50g-202101260032288093.jpg',
  'toi-tep-va-ot-hiem-d5sny': 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-toi-ot-100g.jpg',
  'tom-dat-tuoi-bntj8': 'https://s3-hcmc02.higiocloud.vn/images/2024/04/10283789-hdc-tom-su-non-tu-nhien-200g-20240404082149.jpg',
  'tuong-den-ie00c': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Hoisin_sauce_1.jpg/960px-Hoisin_sauce_1.jpg',
  'xuong-bay-heo-ham-nuoc-dung-573mj': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/233789/xuong-heo-co-thit-1kg_202607300931064156.jpg',
  'xuong-ca-va-dau-ca-nau-nuoc-dung-ig6y8': 'https://cdn.tgdd.vn/Products/Images/8782/312448/bhx/ca-ro-phi-lam-sach-500g-202308030914149318.jpg',
  'xuong-ong-heo-ham-canh-52nm8': 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/233789/xuong-heo-co-thit-1kg_202607300931064156.jpg',
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadWithRetry(url: string, maxRetries = 3): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MoguCulinaryBot/1.0 (https://mogu.vn; contact@mogu.vn) Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (res.status === 429) {
        console.log(`    ⏳ 429 Too Many Requests, waiting ${attempt * 2}s before retry...`);
        await sleep(attempt * 2000);
        continue;
      }

      if (!res.ok) {
        console.log(`    ❌ HTTP ${res.status} on attempt ${attempt}`);
        return null;
      }

      const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 3000) {
        console.log(`    ❌ File too small (${buffer.length} bytes)`);
        return null;
      }

      return { buffer, contentType: ct };
    } catch (e: any) {
      console.log(`    ⚠️ Fetch error (attempt ${attempt}): ${e.message}`);
      await sleep(1000);
    }
  }
  return null;
}

async function uploadToSupabase(code: string, buffer: Buffer, contentType: string): Promise<string | null> {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filePath = `${code}.${ext}`;

  const { error } = await supabase.storage
    .from('ingredient-images')
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`    ❌ Supabase upload error: ${error.message}`);
    return null;
  }

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/ingredient-images/${filePath}`;
}

async function main() {
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Starting deployment for ${pending.length} pending ingredients...`);

  let successCount = 0;
  let failCount = 0;
  const deployedLog: any[] = [];

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const sourceUrl = verifiedMap[item.code];

    console.log(`\n[${i + 1}/${pending.length}] Processing: "${item.name}" [${item.code}]`);

    if (!sourceUrl) {
      console.log(`  ❌ No mapped URL found!`);
      failCount++;
      continue;
    }

    console.log(`  Source: ${sourceUrl.slice(0, 90)}...`);

    const dl = await downloadWithRetry(sourceUrl);
    if (!dl) {
      console.log(`  ❌ Failed to download!`);
      failCount++;
      continue;
    }

    console.log(`  Downloaded: ${dl.buffer.length} bytes (${dl.contentType})`);

    const publicUrl = await uploadToSupabase(item.code, dl.buffer, dl.contentType);
    if (!publicUrl) {
      console.log(`  ❌ Upload failed!`);
      failCount++;
      continue;
    }

    await prisma.ingredient.update({
      where: { code: item.code },
      data: {
        imageUrl: publicUrl,
        imageStatus: 'PENDING_REVIEW',
        isActive: false,
        status: 'PENDING_REVIEW',
      },
    });

    console.log(`  ✅ Successfully deployed: ${publicUrl}`);
    successCount++;
    deployedLog.push({ code: item.code, name: item.name, publicUrl, size: dl.buffer.length });

    // Gentle pacing to avoid any rate limits
    await sleep(400);
  }

  console.log(`\n========================================`);
  console.log(`DEPLOYMENT COMPLETE!`);
  console.log(`Success: ${successCount} / ${pending.length}`);
  console.log(`Failed: ${failCount} / ${pending.length}`);
  console.log(`========================================`);

  fs.writeFileSync('scripts/deployed-112-log.json', JSON.stringify(deployedLog, null, 2), 'utf-8');
  await prisma.$disconnect();
}

main();
