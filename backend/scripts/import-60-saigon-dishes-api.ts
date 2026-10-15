/**
 * import-60-saigon-dishes-api.ts
 *
 * Tự động thêm 60 món ăn phổ biến ở Sài Gòn qua HTTP REST API (POST /v1/admin/import-jobs)
 * Yêu cầu:
 *  - Dùng đúng API của chức năng tự động nhập món (POST /v1/admin/import-jobs)
 *  - CHỈ gồm các món dùng cho BỮA SÁNG, BỮA TRƯA, BỮA TỐI (KHÔNG CÓ BỮA PHỤ / ĂN VẶT / TRÁNG MIỆNG)
 *  - Khẩu phần mặc định: 1
 *  - Đối chiếu kho nguyên liệu 715 nguyên liệu chuẩn, không tạo nguyên liệu rác
 *  - Thẩm định ảnh bằng AI Vision (chỉ gán ảnh đúng món, không gán ảnh sai)
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:3001/v1';

export interface DishToImport {
  name: string;
  regionHint: 'south';
  relatedKeywords: string[];
}

export const SAIGON_MAIN_MEAL_DISHES: DishToImport[] = [
  // ── 1. Cơm đặc trưng Sài Gòn (Bữa trưa / Bữa tối) ─────────────────────────
  {
    name: 'Cơm tấm sườn nướng',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm sườn cốt lết nướng mỡ hành', 'nước mắm chua ngọt', 'đặc sản cơm tấm Sài Gòn'],
  },
  {
    name: 'Cơm tấm sườn bì chả',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm sườn nướng', 'bì heo thính gạo', 'chả trứng hấp thịt cua', 'cơm tấm đêm Sài Gòn'],
  },
  {
    name: 'Cơm tấm ba rọi nướng',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm thịt ba rọi nướng than hoa', 'mỡ hành tóp mỡ', 'đồ chua dưa leo'],
  },
  {
    name: 'Cơm tấm chả trứng',
    regionHint: 'south',
    relatedKeywords: ['chả trứng chưng thịt cua nấm mèo', 'cơm tấm Sài Gòn', 'chả hấp trứng vịt'],
  },
  {
    name: 'Cơm tấm đùi gà nướng',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm gà nướng mật ong sả ớt', 'đùi gà nướng mỡ hành', 'cơm tấm bình dân Sài Gòn'],
  },
  {
    name: 'Cơm chiên Dương Châu',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên lạp xưởng tôm thịt trứng', 'cơm rang Dương Châu', 'ẩm thực Chợ Lớn Sài Gòn'],
  },
  {
    name: 'Cơm chiên cá mặn',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên cá mặn gà xé', 'cá khô mặn chiên cơm', 'cơm chiên thố đất Sài Gòn'],
  },
  {
    name: 'Cơm gà xối mỡ Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên cà chua da gà giòn rụm', 'đùi gà xối mỡ tỏi ớt', 'cơm gà xối mỡ Chợ Lớn'],
  },
  {
    name: 'Cơm bò lúc lắc',
    regionHint: 'south',
    relatedKeywords: ['thịt thăn bò xào lúc lắc ớt chuông hành tây', 'cơm chiên bơ tỏi', 'bò lúc lắc khoai tây'],
  },
  {
    name: 'Cơm thố xá xíu Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['cơm thố hấp thịt xá xíu lạp xưởng', 'ẩm thực người Hoa Chợ Lớn', 'cơm thố đất'],
  },

  // ── 2. Xôi ăn sáng & trưa no bụng Sài Gòn ─────────────────────────────────
  {
    name: 'Xôi mặn Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['xôi nếp lạp xưởng chà bông pate', 'xôi mặn thập cẩm trứng cút', 'xôi sáng Sài Gòn'],
  },
  {
    name: 'Xôi gà xé mỡ hành',
    regionHint: 'south',
    relatedKeywords: ['xôi gà xé phay mỡ hành hành phi', 'nước chan gà rô ti', 'xôi gà Sài Gòn'],
  },
  {
    name: 'Xôi xá xíu Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['xôi nếp thịt xá xíu đỏ mỡ hành', 'nước sốt xá xíu đậm đà', 'xôi người Hoa'],
  },
  {
    name: 'Xôi đùi gà rô ti',
    regionHint: 'south',
    relatedKeywords: ['xôi đùi gà rô ti nước dừa ngũ vị', 'hành phi mỡ hành', 'xôi gà hộp lá chuối'],
  },

  // ── 3. Hủ tiếu & Mì Chợ Lớn (Bữa sáng / trưa / tối) ──────────────────────
  {
    name: 'Hủ tiếu Nam Vang nước',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu Nam Vang nước lèo xương ống', 'tôm thịt băm gan heo trứng cút', 'hủ tiếu Sài Gòn'],
  },
  {
    name: 'Hủ tiếu Nam Vang khô',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu trộn sốt tương đen tỏi phi', 'tôm thịt cật heo chén súp riêng', 'hủ tiếu khô'],
  },
  {
    name: 'Hủ tiếu gõ thịt heo bò viên',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu gõ đường phố thịt lát mỏng', 'bò viên hẹ giá nước lèo xương', 'hủ tiếu đêm'],
  },
  {
    name: 'Hủ tiếu bò kho',
    regionHint: 'south',
    relatedKeywords: ['nạm bò hầm cà rốt sả quế hồi', 'hủ tiếu dai bò kho rau thơm ngò gai', 'bò kho Sài Gòn'],
  },
  {
    name: 'Hủ tiếu mì xá xíu Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu mì vàng thịt xá xíu xắt lát', 'tóp mỡ tỏi phi hẹ', 'mì xá xíu gốc Hoa'],
  },
  {
    name: 'Hủ tiếu sa tế bò',
    regionHint: 'south',
    relatedKeywords: ['bò tái sa tế đậu phộng cay nồng', 'dưa leo chuối chát khế chua', 'hủ tiếu sa tế Triều Châu'],
  },
  {
    name: 'Hủ tiếu mực Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['mực ống tươi giòn thịt băm', 'nước lèo mực khô củ cải ngọt thanh', 'hủ tiếu mực'],
  },
  {
    name: 'Hủ tiếu sườn non',
    regionHint: 'south',
    relatedKeywords: ['sườn heo hầm mềm róc xương', 'nước dùng củ cải hành ngò', 'hủ tiếu sườn cọng dai'],
  },
  {
    name: 'Hủ tiếu cá Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['cá lóc phi lê lát mỏng tươi ngon', 'nước lèo cá thanh ngọt tóp mỡ', 'hủ tiếu cá người Hoa'],
  },
  {
    name: 'Mì vịt tiềm Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['đùi vịt tiềm thảo mộc hoa hồi nấm đông cô', 'mì trứng sợi dai cải thìa', 'vịt tiềm chiên giòn da'],
  },
  {
    name: 'Mì xào giòn hải sản',
    regionHint: 'south',
    relatedKeywords: ['vắt mì trứng chiên phồng giòn rụm', 'tôm mực cật heo rau củ sốt sệt', 'mì xào giòn Chợ Lớn'],
  },
  {
    name: 'Mì sủi cảo tôm thịt Hà Tôn Quyền',
    regionHint: 'south',
    relatedKeywords: ['sủi cảo bọc tôm tươi nguyên con thịt nạc', 'mì trứng nước dùng tôm mực khô cải ngọt'],
  },

  // ── 4. Bánh mì & Điểm tâm sáng no bụng ────────────────────────────────────
  {
    name: 'Bánh mì thịt nguội pate Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bánh mì giòn rụm pate bơ Pháp chả lụa thịt đỏ', 'đồ chua ngò ớt', 'bánh mì đặc ruột'],
  },
  {
    name: 'Bánh mì xíu mại trứng muối',
    regionHint: 'south',
    relatedKeywords: ['viên xíu mại thịt băm trứng muối sốt cà chua', 'bánh mì xíu mại Sài Gòn', 'bánh mì sáng'],
  },
  {
    name: 'Bánh mì chảo thập cẩm',
    regionHint: 'south',
    relatedKeywords: ['chảo gang trứng ốp la pate bít tết xúc xích xíu mại', 'bánh mì chảo Sài Gòn'],
  },
  {
    name: 'Bánh mì phá lấu bò',
    regionHint: 'south',
    relatedKeywords: ['bánh mì kẹp lòng bò phá lấu nước cốt dừa', 'nước mắm me chua ngọt rau răm'],
  },
  {
    name: 'Bánh mì heo quay giòn bì',
    regionHint: 'south',
    relatedKeywords: ['thịt heo quay da giòn rụm nước sốt đậm đà', 'dưa leo ngò rí đồ chua ớt'],
  },
  {
    name: 'Bánh mì chả cá Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['chả cá mối cá thác lác chiên nóng tại chỗ', 'rau răm tương ớt Bắc tiêu đen'],
  },
  {
    name: 'Bánh mì thịt nướng sả',
    regionHint: 'south',
    relatedKeywords: ['thịt heo nướng xiên sả mè thơm lừng', 'nước sốt tương đen đồ chua ngò rí'],
  },
  {
    name: 'Bò né hoa mai ốp la pate',
    regionHint: 'south',
    relatedKeywords: ['bò né chảo gang xèo xèo trứng ốp la pate bơ bánh mì', 'điểm tâm sáng Sài Gòn'],
  },

  // ── 5. Bún & Bánh canh (Bữa sáng / trưa / tối) ───────────────────────────
  {
    name: 'Bún mắm Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['mắm cá linh cá sặc thơm đậm đà', 'heo quay tôm mực cà tím bông súng rau đắng'],
  },
  {
    name: 'Bún thịt nướng chả giò',
    regionHint: 'south',
    relatedKeywords: ['thịt nạc vai ướp sả nướng than', 'chả giò giòn mỡ hành đậu phộng nước mắm chua ngọt'],
  },
  {
    name: 'Bún riêu cua ốc Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['riêu cua đồng ốc bươu xào đậu hũ huyết heo cà chua', 'mắm tôm chanh ớt rau muống bào'],
  },
  {
    name: 'Bún bò xào Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['thịt bò xào hành tây sả thơm lừng', 'bún tươi đậu phộng mỡ hành rau sống nước mắm chua ngọt'],
  },
  {
    name: 'Bún mọc Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['chả lụa mọc giò sống nấm mèo sườn non', 'nước dùng sườn trong ngọt thanh hành phi'],
  },
  {
    name: 'Bún cá Châu Đốc',
    regionHint: 'south',
    relatedKeywords: ['cá lóc đồng luộc xào củ nghệ ngải bún', 'nước lèo cá thơm lừng bông điên điển rau đắng'],
  },
  {
    name: 'Bánh canh cua giò heo',
    regionHint: 'south',
    relatedKeywords: ['thịt cua biển giò heo huyết tôm', 'sợi bánh canh bột lọc nước dùng sệt gạch cua'],
  },
  {
    name: 'Bánh canh ghẹ Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['ghẹ tươi nguyên con nước dùng ngọt lịm', 'sợi bánh canh dai muối tiêu chanh'],
  },
  {
    name: 'Bánh canh Trảng Bàng',
    regionHint: 'south',
    relatedKeywords: ['bánh canh bột gạo phơi sương giò heo thịt luộc', 'nước lèo trong rau rừng Tây Ninh chấm mắm tiêu'],
  },
  {
    name: 'Bánh canh giò heo nấm rơm',
    regionHint: 'south',
    relatedKeywords: ['khoanh giò heo ninh mềm nấm rơm tươi ngọt', 'bánh canh bột gạo hành ngò tiêu đen'],
  },

  // ── 6. Món xào & Món chính ăn no (Bữa sáng / trưa / tối) ─────────────────
  {
    name: 'Nui xào bò Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['nui vàng xào thịt bò mềm hành tây cà chua', 'rau xà lách trứng ốp la nước tương ớt'],
  },
  {
    name: 'Bún gạo xào thập cẩm',
    regionHint: 'south',
    relatedKeywords: ['bún gạo sợi mảnh xào tôm thịt chả lụa cải ngọt', 'mộc nhĩ cà rốt nước tương tỏi ớt'],
  },
  {
    name: 'Bánh xèo Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['bánh xèo vàng giòn rụm tôm thịt ba chỉ giá đỗ đậu xanh', 'cuộn rau cải xanh rau rừng nước mắm chua ngọt'],
  },
  {
    name: 'Bò kho bánh mì',
    regionHint: 'south',
    relatedKeywords: ['thịt nạm gân bò hầm cà rốt nước dừa quế hồi', 'chấm bánh mì nóng giòn rau húng quế ngò gai'],
  },

  // ── 7. Canh, Món kho & Món mặn gia đình Sài Gòn (Bữa trưa / tối) ─────────
  {
    name: 'Canh chua cá lóc Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['cá lóc đồng nấu me chua ngọt', 'bạc hà đậu bắp cà chua thơm giá đỗ ngò gai ngò om'],
  },
  {
    name: 'Cá lóc kho tộ Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['cá lóc khứa kho trong tộ đất nước dừa tiêu ớt', 'nước sốt sệt keo ăn cùng cơm trắng'],
  },
  {
    name: 'Thịt kho tàu nước dừa',
    regionHint: 'south',
    relatedKeywords: ['thịt ba chỉ kho mềm rục nước dừa xiêm', 'trứng vịt luộc thấm màu cánh gián đậm đà'],
  },
  {
    name: 'Canh khổ qua dồn thịt',
    regionHint: 'south',
    relatedKeywords: ['mướp đắng nhồi thịt nạc băm nấm mèo miến', 'nước canh thanh ngọt giải nhiệt'],
  },
  {
    name: 'Canh khoai mỡ tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['khoai mỡ tím nạo nhuyễn nấu tôm băm thịt nạc', 'ngò om ngò gai canh sánh mịn Nam Bộ'],
  },
  {
    name: 'Sườn non ram mặn ngọt',
    regionHint: 'south',
    relatedKeywords: ['sườn heo chặt nhỏ ram nước mắm đường tỏi ớt', 'nước sốt keo bám bóng sườn ăn cơm nóng'],
  },
  {
    name: 'Cá hú kho thơm Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['cá hú béo ngậy kho khóm dứa chua ngọt', 'hành lá ớt hiểm nước màu dừa'],
  },
  {
    name: 'Canh súp sườn heo củ cải',
    regionHint: 'south',
    relatedKeywords: ['sườn non hầm củ cải trắng cà rốt bắp ngọt', 'nước dùng trong ngọt tự nhiên hành ngò tiêu'],
  },

  // ── 8. Lẩu đặc sản ăn bữa chính (Bữa trưa / tối) ─────────────────────────
  {
    name: 'Lẩu cá kèo lá giang',
    regionHint: 'south',
    relatedKeywords: ['cá kèo tươi sống nước lẩu lá giang chua thanh', 'rau đắng hoa chuối bún tươi nước mắm ớt'],
  },
  {
    name: 'Lẩu mắm Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['lẩu mắm cá linh cá sặc thơm nức', 'tôm cá mực cà tím bông súng rau đắng bún tươi'],
  },
  {
    name: 'Lẩu bò sa tế Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['đuôi bò nạm bò sa tế đậu phộng cay béo', 'khoai môn tàu hũ ky rau cải chấm chao sa tế'],
  },
  {
    name: 'Lẩu gà nấu lá é Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['gà ta chắc thịt nấu nước lèo măng le lá é thơm the', 'muối ớt é cay nồng bún tươi'],
  },
];

async function getAdminToken(): Promise<string> {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'superadmin@user.mogu.internal',
  });
  if (linkErr) throw linkErr;

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: sessionData, error: verifyErr } = await client.auth.verifyOtp({
    email: 'superadmin@user.mogu.internal',
    token: linkData.properties.email_otp,
    type: 'magiclink',
  });
  if (verifyErr) throw verifyErr;

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Không lấy được access_token từ Supabase session.');
  return token;
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 BẮT ĐẦU TỰ ĐỘNG NHẬP 60 MÓN ĂN SÀI GÒN BẰNG REST API CHÍNH THỨC');
  console.log('• Endpoint: POST ' + API_BASE + '/admin/import-jobs');
  console.log('• Quy chuẩn: Bữa sáng, Bữa trưa, Bữa tối (Không có bữa phụ/ăn vặt/tráng miệng)');
  console.log('• Khẩu phần: 1 phần mặc định');
  console.log('• Hình ảnh: Thẩm định bởi AI Vision (ag/gemini-3.8-flash) để đảm bảo chuẩn xác');
  console.log('========================================================================\n');

  // 1. Lấy token xác thực admin
  console.log('Đang lấy token xác thực Admin...');
  let token = await getAdminToken();
  console.log('✅ Xác thực Admin thành công!\n');

  // 2. Kiểm tra API
  const checkRes = await fetch(`${API_BASE}/admin/import-jobs?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!checkRes.ok) {
    throw new Error(`API check thất bại: HTTP ${checkRes.status} ${checkRes.statusText}`);
  }

  let successCount = 0;
  let failCount = 0;
  const importedResults: Array<{ name: string; dishId: string; hasImage: boolean }> = [];

  for (let i = 0; i < SAIGON_MAIN_MEAL_DISHES.length; i++) {
    const item = SAIGON_MAIN_MEAL_DISHES[i];
    const indexStr = `[${(i + 1).toString().padStart(2, ' ')}/${SAIGON_MAIN_MEAL_DISHES.length}]`;
    console.log(`\n${indexStr} ⏳ Đang gọi API nhập món: "${item.name}"...`);
    const startTime = Date.now();

    try {
      // 1. Gọi POST /v1/admin/import-jobs
      const postRes = await fetch(`${API_BASE}/admin/import-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: item.name,
          regionHint: item.regionHint,
          relatedKeywords: item.relatedKeywords,
          sourceTypes: ['AI_GENERATED'],
        }),
      });

      if (!postRes.ok) {
        // Nếu token hết hạn, refresh token
        if (postRes.status === 401) {
          console.log('Token hết hạn, đang tạo token mới...');
          token = await getAdminToken();
          i--; // Thử lại lượt này
          continue;
        }
        const errText = await postRes.text();
        throw new Error(`HTTP ${postRes.status}: ${errText}`);
      }

      const postData = await postRes.json() as any;
      const job = postData.data ?? postData;
      const jobId = job.id;

      // 2. Poll GET /v1/admin/import-jobs/:id
      let currentJob = job;
      const timeoutMs = 3 * 60_000; // Tối đa 3 phút
      while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error('Pipeline quá thời gian cho phép (timeout 3 phút)');
        }
        await new Promise((r) => setTimeout(r, 2000));

        const getRes = await fetch(`${API_BASE}/admin/import-jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (getRes.ok) {
          const getData = await getRes.json() as any;
          currentJob = getData.data ?? getData;
          const msg = currentJob.currentStepMessage ? ` - ${currentJob.currentStepMessage}` : '';
          process.stdout.write(`\r   ${indexStr} Tiến độ: [${currentJob.status}] ${currentJob.progress}%${msg}`.padEnd(110));
        }
      }
      process.stdout.write('\n');

      if (currentJob.status !== 'DONE' || !currentJob.resultDishId) {
        throw new Error(currentJob.errorMessage ?? `Trạng thái kết thúc: ${currentJob.status}`);
      }

      const dishId = currentJob.resultDishId;
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      const hasImage = Boolean(currentJob.suggestedImageUrl);

      importedResults.push({ name: item.name, dishId, hasImage });
      successCount++;
      console.log(
        `   ${indexStr} ✅ Hoàn thành: "${item.name}" (${durationSec}s) -> ID: ${dishId} | Ảnh: ${hasImage ? 'Đã xác minh AI Vision' : 'Không gán (để tránh ảnh sai)'}`,
      );
    } catch (err: any) {
      failCount++;
      console.error(`   ${indexStr} ❌ Lỗi: "${item.name}": ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log('🎉 TỔNG KẾT NHẬP MÓN QUA REST API:');
  console.log(`• Thành công: ${successCount}/${SAIGON_MAIN_MEAL_DISHES.length} món`);
  console.log(`• Thất bại: ${failCount} món`);
  console.log('========================================================================\n');
}

main().catch(console.error);
