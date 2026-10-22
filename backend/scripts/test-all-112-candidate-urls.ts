import 'dotenv/config';

interface Candidate {
  code: string;
  name: string;
  url: string;
}

const candidates: Candidate[] = [
  { code: 'banh-da-do-hai-phong-tuoi-tppoj', name: 'Bánh đa đỏ Hải Phòng tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/BANH_DA_CUA_1.jpg' },
  { code: 'banh-quay-gion-dsr7f', name: 'Bánh quẩy giòn', url: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Youtiao.jpg' },
  { code: 'banh-trang-me-nuong-njpz9', name: 'Bánh tráng mè nướng', url: 'https://cdn.tgdd.vn/Products/Images/3234/215801/bhx/banh-trang-me-nuong-an-nhien-goi-120g-201912040954252409.jpg' },
  { code: 'bi-heo-tron-thinh-gao-04aqb', name: 'Bì heo trộn thính gạo', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg' },
  { code: 'bot-gia-vi-bo-kho-iayya', name: 'Bột gia vị bò kho', url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Bo_kho_mien_Bac.jpg' },
  { code: 'bot-tom-chay-hue-ruoc-tom-8dwof', name: 'Bột tôm chấy Huế (Ruốc tôm)', url: 'https://upload.wikimedia.org/wikipedia/commons/6/68/T%C3%B4m_kh%C3%B4_Vi%E1%BB%87t_Nam.jpg' },
  { code: 'bun-soi-to-bun-bo-hue-eueh4', name: 'Bún sợi to Bún Bò Huế', url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/B%C3%BAn_b%C3%B2_Hu%E1%BA%BF.jpg' },
  { code: 'cha-bo-da-nang-hkz0k', name: 'Chả bò Đà Nẵng', url: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Chalua.jpg' },
  { code: 'cha-bong-thit-heo-ruoc-fr1ql', name: 'Chà bông thịt heo (Ruốc)', url: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Rousong.jpg' },
  { code: 'cha-ca-thu-chien-hap-6ki89', name: 'Chả cá thu chiên hấp', url: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Fishcake_on_salad.jpg' },
  { code: 'cha-com-ha-noi-0jqaq', name: 'Chả cốm Hà Nội', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Bun_dau_mam_tom_20220626.jpg/960px-Bun_dau_mam_tom_20220626.jpg' },
  { code: 'cha-cua-hue-nxsuq', name: 'Chả cua Huế', url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/B%C3%BAn_b%C3%B2_Hu%E1%BA%BF.jpg' },
  { code: 'cha-trung-hap-thit-viwuf', name: 'Chả trứng hấp thịt', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg' },
  { code: 'chanh-tuoi-va-ot-hiem-ts23x', name: 'Chanh tươi và ớt hiểm', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/chanh-khong-hat-500g.jpg' },
  { code: 'chi-chuong-hai-phong-ot-chung-095en', name: 'Chí chương Hải Phòng (Ớt chưng)', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Chili_oil.jpg' },
  { code: 'com-trang-com-nguoi-s0hyk', name: 'Cơm trắng (Cơm nguội)', url: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Meshi.jpg' },
  { code: 'cu-cai-muoi-kho-xa-bau-tq7as', name: 'Củ cải muối khô xá bấu', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Preserved_radish.jpg' },
  { code: 'cu-ngai-bun-tuoi-lmv3l', name: 'Củ ngải bún tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Temu_kunci.png' },
  { code: 'cu-san-tuoi-cu-dau-mmw68', name: 'Củ sắn tươi (Củ đậu)', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/cu-dau.jpg' },
  { code: 'dau-phong-rang-lac-rang-tx3n7', name: 'Đậu phộng rang (Lạc rang)', url: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Fried_groundnuts.jpg' },
  { code: 'dau-phu-ran-vang-h6kub', name: 'Đậu phụ rán vàng', url: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Tahu_digoreng.JPG' },
  { code: 'do-chua-ie01z', name: 'Đồ chua', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/%C4%90%E1%BB%93_chua.jpg' },
  { code: 'do-chua-ca-rot-cu-cai-jxacf', name: 'Đồ chua (Cà rốt & Củ cải)', url: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/%C4%90%E1%BB%93_chua.jpg' },
  { code: 'doi-sun-chien-mien-nam-o9mmm', name: 'Dồi sụn chiên miền Nam', url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/D%E1%BB%93i.jpg' },
  { code: 'du-du-chua-ngam-gion-k9s9r', name: 'Đu đủ chua ngâm giòn', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/B%C3%BAn_ch%E1%BA%A3_%C4%90%E1%BB%93ng_Xu%C3%A2n.jpg/960px-B%C3%BAn_ch%E1%BA%A3_%C4%90%E1%BB%93ng_Xu%C3%A2n.jpg' },
  { code: 'dua-leo-va-ca-chua-tuoi-yym2k', name: 'Dưa leo và cà chua tươi', url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/Products/Images/8785/226881/bhx/dua-leo-tui-500g_202504140837248711.jpg' },
  { code: 'dui-ga-goc-tu-4kxf3', name: 'Đùi gà góc tư', url: 'https://s3-hcmc02.higiocloud.vn/images/2024/12/10283205-20241205094015.jpg' },
  { code: 'gach-ghe-xao-dau-dieu-yremn', name: 'Gạch ghẹ xào dầu điều', url: 'https://cdn.tgdd.vn/Products/Images/8271/323030/bhx/dau-mau-dieu-dh-foods-chai-100ml-202404030946077879.jpg' },
  { code: 'gan-heo-tuoi-zones', name: 'Gan heo tươi', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/gan-heo-cp-khay-300g.jpg' },
  { code: 'gao-tam-thom-iq9ex', name: 'Gạo tấm thơm', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/03/gao-tam-thom-tui-5kg.jpg' },
  { code: 'gia-vi-nau-an-tong-hop-m0pvq', name: 'Gia vị nấu ăn tổng hợp', url: 'https://cdn.tgdd.vn/Products/Images/8271/233816/bhx/toi-phi-tui-50g-202101260032288093.jpg' },
  { code: 'gia-vi-uop-toi-gung-s18r6', name: 'Gia vị ướp tỏi gừng', url: 'https://cdn.tgdd.vn/Products/Images/8271/233816/bhx/toi-phi-tui-50g-202101260032288093.jpg' },
  { code: 'gio-lua-truyen-thong-bkhik', name: 'Giò lụa truyền thống', url: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Chalua.jpg' },
  { code: 'gio-song-moc-66b6u', name: 'Giò sống (Mọc)', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/gio-song-cp-khay-300g.jpg' },
  { code: 'hanh-kho-hanh-cu-tim-4gybv', name: 'Hành khô (Hành củ tím)', url: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Shallot_bulbs.jpg' },
  { code: 'hanh-la-va-mui-tau-ngo-gai-x7vr7', name: 'Hành lá và mùi tàu (Ngò gai)', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/mui-tau-ngo-gai-50g.webp' },
  { code: 'hanh-la-va-ngo-ri-uxy0m', name: 'Hành lá và ngò rí', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-hanh-la-ngo-ri-50g.jpg' },
  { code: 'hanh-la-va-rau-mui-ngo-ri-k24wf', name: 'Hành lá và rau mùi (Ngò rí)', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/combo-hanh-la-ngo-ri-50g.jpg' },
  { code: 'hanh-la-va-rau-ram-tuoi-9pa00', name: 'Hành lá và rau răm tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rau_ram_Polygonum_odoratum.jpg' },
  { code: 'hanh-la-va-thi-la-tuoi-b4ffv', name: 'Hành lá và thì là tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Dill_herb.jpg' },
  { code: 'hanh-tim-phi-gion-yv2fj', name: 'Hành tím phi giòn', url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Fried_shallots.jpg' },
  { code: 'hanh-tim-va-gung-nuong-810f0', name: 'Hành tím và gừng nướng', url: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Shallot_bulbs.jpg' },
  { code: 'hat-dieu-mau-hat-ca-ri-ca29m', name: 'Hạt điều màu (Hạt cà ri)', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Achiote_seeds.jpg' },
  { code: 'hoa-hoi-va-que-thanh-h89rx', name: 'Hoa hồi và quế thanh', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Star_anise_stack.jpg/960px-Star_anise_stack.jpg' },
  { code: 'hu-tieu-dai-iksax', name: 'Hủ tiếu dai', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu.jpg/960px-H%E1%BB%A7_t%C3%ADu.jpg' },
  { code: 'kho-muc-mini-nuong-nau-nuoc-dung-0c5iz', name: 'Khô mực mini nướng nấu nước dùng', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Surume.jpg' },
  { code: 'khoanh-gio-heo-xh2jw', name: 'Khoanh giò heo', url: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Pork_trotter.jpg' },
  { code: 'khuon-chen-sanh-lam-banh-beo-k22j1', name: 'Khuôn chén sành làm bánh bèo', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/B%C3%A1nh_b%C3%A8o.jpg' },
  { code: 'la-dong-goi-banh-tuoi-wowmt', name: 'Lá dong gói bánh tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/La_dong.jpg' },
  { code: 'la-lot-va-tia-to-u7jym', name: 'lá lốt và tía tô', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Piper_sarmentosum.jpg' },
  { code: 'la-oi-banh-te-tuoi-6uu83', name: 'Lá ổi bánh tẻ tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Psidium_guajava_leaves.jpg' },
  { code: 'lap-xuong-mai-que-lo-eaogu', name: 'Lạp xưởng Mai Quế Lộ', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Chinesesausageunpackaged.jpg' },
  { code: 'mi-trung-tuoi-soi-tron-2ji9y', name: 'Mì trứng tươi sợi tròn', url: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Chinese_egg_noodles.jpg' },
  { code: 'mo-ga-thang-yd9pe', name: 'Mỡ gà thắng', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Schmaltz.jpg' },
  { code: 'mo-hanh-la-liv0t', name: 'Mỡ hành lá', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/B%C3%A1nh_h%E1%BB%8Fi_tr%C3%ACnh_b%C3%A0y_tr%C3%AAn_%C4%91%C4%A9a.jpg/960px-B%C3%A1nh_h%E1%BB%8Fi_tr%C3%ACnh_b%C3%A0y_tr%C3%AAn_%C4%91%C4%A9a.jpg' },
  { code: 'muoi-ot-xanh-cham-hai-san-7dr3s', name: 'Muối ớt xanh chấm hải sản', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/muoi-ot-xanh-dasavi-chai-260g.jpg' },
  { code: 'nam-bao-ngu-xam-tuoi-4pf85', name: 'Nấm bào ngư xám tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Pleurotus_ostreatus_mushroom.jpg' },
  { code: 'nem-chua-cay-gu1vh', name: 'Nem chua cây', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Fermented_pork_wrap.jpg' },
  { code: 'nem-ran-cha-gio-pqzw3', name: 'Nem rán (Chả giò)', url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Cha_gio.jpg' },
  { code: 'nuoc-cham-nem-chua-ngot-25wxw', name: 'Nước chấm nem chua ngọt', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Nuoc_cham.jpg' },
  { code: 'nuoc-cot-me-chua-wvk4w', name: 'Nước cốt me chua', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/nuoc-cot-me-chua-200g.jpg' },
  { code: 'nuoc-ham-xuong-u7jws', name: 'nước hầm xương', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Bone_broth.jpg' },
  { code: 'nuoc-ham-xuong-heo-lnoi9', name: 'Nước hầm xương heo', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Bone_broth.jpg' },
  { code: 'nuoc-luoc-ga-fgizi', name: 'Nước luộc gà', url: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Chicken_broth.jpg' },
  { code: 'nuoc-ma-long-me-ga-fmrpt', name: 'Nước mạ lòng mề gà', url: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Chicken_broth.jpg' },
  { code: 'nuoc-sot-tron-iksef', name: 'Nước sốt trộn', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Hoisin_sauce.jpg' },
  { code: 'ot-chung-sa-te-6t7n3', name: 'Ớt chưng sa tế', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Chili_oil.jpg' },
  { code: 'pa-te-gan-heo-beo-gqbsj', name: 'Pa-tê gan heo béo', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Pate_de_foie.jpg' },
  { code: 'pheo-non-heo-tuoi-long-non-0anzl', name: 'Phèo non heo tươi (Lòng non)', url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/D%E1%BB%93i.jpg' },
  { code: 'phi-le-ca-ro-phi-tuoi-2xvne', name: 'Phi lê cá rô phi tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Tilapia_fillets.jpg' },
  { code: 'que-thanh-cao-vo-aerwl', name: 'Quế thanh cạo vỏ', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Cinnamon_sticks.jpg' },
  { code: 'rau-an-lau-mam-thap-cam-keo-neo-rau-dang-dien-dien-bong-sung-ym62o', name: 'Rau ăn lẩu mắm thập cẩm (Kèo nèo, rau đắng, điên điển, bông súng)', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/L%E1%BA%A9u_m%E1%BA%AFm.jpg/960px-L%E1%BA%A9u_m%E1%BA%AFm.jpg' },
  { code: 'rau-cai-xanh-cai-cay-zzvxf', name: 'Rau cải xanh (Cải cay)', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Brassica_juncea_leaves.jpg' },
  { code: 'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf', name: 'Rau củ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)', url: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Boiled_vegetables.jpg' },
  { code: 'rau-kinh-gioi-va-rau-mui-01m1e', name: 'Rau kinh giới và rau mùi', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Elsholtzia_ciliata.jpg' },
  { code: 'rau-mam-cu-cai-trang-jecym', name: 'Rau mầm củ cải trắng', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Radish_sprouts.jpg' },
  { code: 'rau-song-idzyt', name: 'Rau sống', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg/960px-C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg' },
  { code: 'rau-song-an-kem-ulcnw', name: 'Rau sống ăn kèm', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg/960px-C%C6%A1m_t%E1%BA%A5m_b%C3%AC_ch%E1%BA%A3.jpg' },
  { code: 'rau-song-chuoi-chat-khe-chua-mvyl3', name: 'Rau sống chuối chát khế chua', url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Averrhoa_carambola_slices.jpg' },
  { code: 'rau-song-hoa-chuoi-bup-non-o7chr', name: 'Rau sống hoa chuối búp non', url: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Banana_flower_salad.jpg' },
  { code: 'rau-xa-lach-va-hung-lui-31xfb', name: 'Rau xà lách và húng lủi', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Spearmint_leaves.jpg' },
  { code: 'ruot-banh-mi-xe-vun-xqcxg', name: 'Ruột bánh mì xé vụn', url: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Bread_crumbs.jpg' },
  { code: 'ruou-vang-do-nau-an-5yg6f', name: 'Rượu vang đỏ nấu ăn', url: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Red_wine_glass.jpg' },
  { code: 'soi-banh-canh-bot-gao-4e1if', name: 'Sợi bánh canh bột gạo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/B%C3%A1nh_canh_Cua.jpg/960px-B%C3%A1nh_canh_Cua.jpg' },
  { code: 'soi-banh-canh-bot-loc-mzaqg', name: 'Sợi bánh canh bột lọc', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/B%C3%A1nh_canh_Cua.jpg/960px-B%C3%A1nh_canh_Cua.jpg' },
  { code: 'soi-hu-tieu-my-tho-botuy', name: 'Sợi hủ tiếu Mỹ Tho', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/H%E1%BB%A7_t%C3%ADu.jpg/960px-H%E1%BB%A7_t%C3%ADu.jpg' },
  { code: 'soi-mi-cao-lau-tuoi-dulqb', name: 'Sợi mì Cao lầu tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Cao_l%E1%BA%A7u_1.jpg/960px-Cao_l%E1%BA%A7u_1.jpg' },
  { code: 'soi-mi-quang-vang-c5wl5', name: 'Sợi mì Quảng vàng', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Mi_Quang_1A_Danang.jpg/960px-Mi_Quang_1A_Danang.jpg' },
  { code: 'sot-tuong-den-cay-gb19u', name: 'Sốt tương đen cay', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Hoisin_sauce.jpg' },
  { code: 'sua-bien-tuoi-lam-sach-0r7x5', name: 'Sứa biển tươi làm sạch', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Edible_jellyfish.jpg' },
  { code: 'suon-cot-let-heo-tuoi-mag0f', name: 'Sườn cốt lết heo tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Pork_chops_raw.jpg' },
  { code: 'than-chuoi-non-bao-mong-2xbkv', name: 'Thân chuối non bào mỏng', url: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Banana_flower_salad.jpg' },
  { code: 'thinh-gao-rang-min-w4wsm', name: 'Thính gạo rang mịn', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Khao_khua.jpg' },
  { code: 'thit-ba-chi-heo-tuoi-5q9rd', name: 'Thịt ba chỉ heo tươi', url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/226834/ba-roi-heo-1kg_202607300933343971.jpg' },
  { code: 'thit-bo-kho-mieng-soi-tam-vi-xkvmb', name: 'Thịt bò khô miếng sợi tẩm vị', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/B%C3%B2_kh%C3%B4_x%C3%A9.jpg' },
  { code: 'thit-ca-ngu-hoac-ca-co-yjkqn', name: 'Thịt cá ngừ (hoặc cá cờ)', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Tuna_steak.jpg' },
  { code: 'thit-cua-bien-tuoi-go-san-q6o2t', name: 'Thịt cua biển tươi gỡ sẵn', url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Crab_meat_lump.jpg' },
  { code: 'thit-ghe-tuoi-boc-san-u9h5m', name: 'Thịt ghẹ tươi bóc sẵn', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Blue_crab_meat.jpg' },
  { code: 'thit-hen-tuoi-luoc-san-g4pqa', name: 'Thịt hến tươi luộc sẵn', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/thit-hen-lam-sach_c612a941-9b5b-4e2c-a7c2-7518219f8826-og.jpg' },
  { code: 'thit-heo-quay-gion-bi-kop4s', name: 'Thịt heo quay giòn bì', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Th%E1%BB%8Bt_heo_quay_b%C3%AC_gi%C3%B2n.jpg/960px-Th%E1%BB%8Bt_heo_quay_b%C3%AC_gi%C3%B2n.jpg' },
  { code: 'thit-ma-dau-heo-tah6a', name: 'Thịt má đầu heo', url: 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/3/image/Products/Images/8781/309294/bhx/tai-heo-300g_202603201031481217.jpg' },
  { code: 'thit-nac-vai-heo-ljwlc', name: 'Thịt nạc vai heo', url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Pork_shoulder_cut.jpg' },
  { code: 'thit-qua-gac-tuoi-zw33x', name: 'Thịt quả gấc tươi', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Qua_Gac.JPG/960px-Qua_Gac.JPG' },
  { code: 'thit-xa-xiu-ikscz', name: 'Thịt xá xíu', url: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Charsiu.jpg' },
  { code: 'tinh-dau-ca-cuong-nguyen-chat-gwho4', name: 'Tinh dầu cà cuống nguyên chất', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Lethocerus_indicus_pinned.jpg/960px-Lethocerus_indicus_pinned.jpg' },
  { code: 'toi-phi-vang-thom-tzsln', name: 'Tỏi phi vàng thơm', url: 'https://cdn.tgdd.vn/Products/Images/8271/233816/bhx/toi-phi-tui-50g-202101260032288093.jpg' },
  { code: 'toi-tep-va-ot-hiem-d5sny', name: 'Tỏi tép và ớt hiểm', url: 'https://s3-hcmc02.higiocloud.vn/images/2023/02/combo-toi-ot-100g.jpg' },
  { code: 'tom-dat-tuoi-bntj8', name: 'Tôm đất tươi', url: 'https://s3-hcmc02.higiocloud.vn/images/2024/04/10283789-hdc-tom-su-non-tu-nhien-200g-20240404082149.jpg' },
  { code: 'tuong-den-ie00c', name: 'Tương đen', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Hoisin_sauce.jpg' },
  { code: 'xuong-bay-heo-ham-nuoc-dung-573mj', name: 'Xương bay heo hầm nước dùng', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/xuong-duoi-heo-meatdeli-hop-400g.jpg' },
  { code: 'xuong-ca-va-dau-ca-nau-nuoc-dung-ig6y8', name: 'Xương cá và đầu cá nấu nước dùng', url: 'https://cdn.tgdd.vn/Files/2017/11/18/1042600/cach-chon-ca-thu-tuoi-ngon-dinh-duong-cho-chi-em-noi-tro-202206111324556578.jpg' },
  { code: 'xuong-ong-heo-ham-canh-52nm8', name: 'Xương ống heo hầm canh', url: 'https://s3-hcmc02.higiocloud.vn/images/2022/xuong-ong-heo-meatdeli-hop-400g.jpg' },
];

async function checkUrl(c: Candidate): Promise<{ code: string; status: number; ok: boolean; size: number; ct: string; err?: string }> {
  try {
    const res = await fetch(c.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return { code: c.code, status: res.status, ok: false, size: 0, ct, err: `HTTP ${res.status}` };
    if (!ct.startsWith('image/')) return { code: c.code, status: res.status, ok: false, size: 0, ct, err: `Invalid type: ${ct}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 3000) return { code: c.code, status: res.status, ok: false, size: buf.byteLength, ct, err: `Too small: ${buf.byteLength}` };
    return { code: c.code, status: res.status, ok: true, size: buf.byteLength, ct };
  } catch (e: any) {
    return { code: c.code, status: 0, ok: false, size: 0, ct: '', err: e.message };
  }
}

async function run() {
  console.log(`Checking ${candidates.length} candidate URLs...`);
  const failed: any[] = [];
  const passed: any[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const res = await checkUrl(c);
    if (res.ok) {
      passed.push({ ...c, size: res.size, ct: res.ct });
      process.stdout.write(`\r[${i + 1}/${candidates.length}] Passed: ${passed.length}, Failed: ${failed.length}`);
    } else {
      failed.push({ ...c, err: res.err, status: res.status });
      process.stdout.write(`\r[${i + 1}/${candidates.length}] Passed: ${passed.length}, Failed: ${failed.length}`);
    }
  }

  console.log(`\n\nTotal Passed: ${passed.length}`);
  console.log(`Total Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed Items:');
    failed.forEach(f => console.log(`  - [${f.code}] "${f.name}": ${f.err} (${f.url})`));
  }
}

run();
