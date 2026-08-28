import { useState, type ComponentType } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../lib/utils';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Dumbbell,
  Flame,
  Footprints,
  Globe2,
  HeartPulse,
  History,
  Home,
  Info,
  Leaf,
  LockKeyhole,
  LogOut,
  MapPin,
  NotebookTabs,
  Pencil,
  Plus,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Utensils,
  Volume2,
} from 'lucide-react-native';

// Color tokens (dùng cho inline style khi cần exact color)
const CLR = {
  yellow: '#FFD54F',
  yellowDark: '#F5BD18',
  ink: '#161616',
  secondary: '#747474',
  border: '#E8E4DC',
  danger: '#FF4D3D',
};

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
const avatar = require('../assets/images/home/avatar.jpg');
const pho = require('../assets/images/random/pho-result.jpg');
const bun = require('../assets/images/random/bun-rieu.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const salad = require('../assets/images/random/banh-cuon.jpg');
type Page =
  | 'main'
  | 'settings'
  | 'edit'
  | 'journey'
  | 'health'
  | 'preferences'
  | 'avoid'
  | 'saved'
  | 'privacy'
  | 'history'
  | 'posts'
  | 'diary';
type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onHealth: () => void;
};

export function ProfileScreen(props: Props) {
  const [page, setPage] = useState<Page>('main');
  if (page !== 'main') return <SubScreen page={page} onBack={() => setPage('main')} />;
  return <ProfileMain {...props} open={setPage} />;
}

function ProfileMain({ open, ...nav }: Props & { open: (page: Page) => void }) {
  return (
    <SafeAreaView className="flex-1 bg-[#FFF9E8]" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 122, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-[68px] flex-row items-center justify-between">
          <Text className="text-[32px] font-bold text-[#161616]" style={{ lineHeight: 40 }}>
            Cá nhân
          </Text>
          <View className="flex-row gap-1.5">
            <IconButton onPress={() => open('settings')} icon={Settings} />
            <IconButton icon={Bell} />
          </View>
        </View>
        <Card>
          <View className="flex-row items-center gap-3.5">
            <Image
              source={avatar}
              className="w-24 h-24 rounded-[48px]"
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
            <View className="flex-1">
              <Text className="text-[23px] font-bold text-[#161616]">Huy Trương</Text>
              <Text className="text-[15px] text-[#747474] mt-0.5">@huytruong</Text>
              <Pressable
                onPress={() => open('edit')}
                className="border border-[#F5BD18] rounded-[13px] px-3 py-2 self-start mt-2.5"
              >
                <Text className="text-[#D89A00] text-[14px]">Chỉnh sửa hồ sơ</Text>
              </Pressable>
            </View>
            <View className="absolute right-0 top-0 flex-row gap-[5px] bg-[#FFF8E6] p-2 rounded-[14px]">
              <Target size={17} color={CLR.yellowDark} />
              <Text className="text-[11px] text-[#161616]">Mục tiêu: Ăn cân bằng</Text>
            </View>
          </View>
          <View className="flex-row mt-[18px] pt-[14px] border-t border-[#E8E4DC]">
            {[
              ['24', 'Bài viết'],
              ['128', 'Món đã lưu'],
              ['18', 'Người theo dõi'],
            ].map(([v, l], i) => (
              <View
                key={l}
                className={
                  i > 0 ? 'flex-1 items-center border-l border-[#E8E4DC]' : 'flex-1 items-center'
                }
              >
                <Text className="text-[19px] font-bold text-[#161616]">{v}</Text>
                <Text className="text-[13px] text-[#747474] mt-0.5 text-center">{l}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <View className="flex-row justify-between items-center">
            <Text className="text-[19px] font-bold text-[#161616]">Hành trình của bạn</Text>
            <Pressable onPress={() => open('journey')}>
              <Text className="text-[15px] text-[#D99A00]">Chi tiết</Text>
            </Pressable>
          </View>
          <View className="flex-row mt-4">
            {[
              ['12', 'ngày liên tiếp'],
              ['36', 'bữa đã ghi'],
              ['8', 'món mới'],
            ].map(([v, l], i) => (
              <View
                key={l}
                className={
                  i > 0 ? 'flex-1 items-center border-l border-[#E8E4DC]' : 'flex-1 items-center'
                }
              >
                <Text className="text-[19px] font-bold text-[#161616]">{v}</Text>
                <Text className="text-[13px] text-[#747474] mt-0.5 text-center">{l}</Text>
              </View>
            ))}
          </View>
          <View className="mt-3.5 bg-[#FFF9E9] rounded-[16px] p-3 flex-row justify-between">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => (
              <View key={d} className="items-center gap-[5px]">
                <View
                  className={
                    i < 6
                      ? 'w-7 h-7 rounded-[14px] bg-[#FFD54F] items-center justify-center'
                      : 'w-7 h-7 rounded-[14px] border border-[#F5BD18] items-center justify-center'
                  }
                >
                  {i < 6 && <Check size={18} color="#fff" strokeWidth={3} />}
                </View>
                <Text className="text-xs">{d}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Text className="text-[20px] font-bold text-[#161616] my-1">Của bạn</Text>
        <View className="flex-row flex-wrap gap-3">
          <Shortcut
            icon={Bookmark}
            title="Món đã lưu"
            sub="128 món"
            onPress={() => open('saved')}
          />
          <Shortcut
            icon={Sparkles}
            title="Lịch sử Random"
            sub="24 lần"
            onPress={() => open('history')}
          />
          <Shortcut
            icon={NotebookTabs}
            title="Nhật ký bữa ăn"
            sub="Tháng 8"
            onPress={() => open('diary')}
          />
          <Shortcut
            icon={Pencil}
            title="Bài viết của tôi"
            sub="24 bài"
            onPress={() => open('posts')}
          />
        </View>
        <Card noPadding>
          <Row icon={HeartPulse} title="Thông tin sức khỏe" onPress={() => open('health')} />
          <Row icon={Target} title="Mục tiêu & sở thích" onPress={() => open('preferences')} />
          <Row icon={Leaf} title="Nguyên liệu cần tránh" onPress={() => open('avoid')} />
          <Row
            icon={LockKeyhole}
            title="Cài đặt & quyền riêng tư"
            onPress={() => open('privacy')}
            last
          />
        </Card>
        <Pressable className="py-3">
          <Text className="text-[16px] text-[#FF4D3D] text-center">Đăng xuất</Text>
        </Pressable>
      </ScrollView>
      <LiquidGlassBottomNav active="profile" {...nav} />
    </SafeAreaView>
  );
}

function SubScreen({ page, onBack }: { page: Exclude<Page, 'main'>; onBack: () => void }) {
  const titles: Record<Exclude<Page, 'main'>, string> = {
    settings: 'Cài đặt',
    edit: 'Chỉnh sửa hồ sơ',
    journey: 'Hành trình của bạn',
    health: 'Thông tin sức khỏe',
    preferences: 'Mục tiêu & sở thích',
    avoid: 'Nguyên liệu cần tránh',
    saved: 'Món đã lưu',
    privacy: 'Cài đặt & quyền riêng tư',
    history: 'Lịch sử Random',
    posts: 'Bài viết của tôi',
    diary: 'Nhật ký bữa ăn',
  };
  return (
    <SafeAreaView className="flex-1 bg-[#FFF9E8]">
      <Header title={titles[page]} onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 44, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {page === 'settings' ? (
          <SettingsPage />
        ) : page === 'edit' ? (
          <EditPage />
        ) : page === 'journey' ? (
          <JourneyPage />
        ) : page === 'health' ? (
          <HealthPage />
        ) : page === 'preferences' ? (
          <PreferencesPage />
        ) : page === 'avoid' ? (
          <AvoidPage />
        ) : page === 'saved' ? (
          <SavedPage />
        ) : page === 'privacy' ? (
          <PrivacyPage />
        ) : page === 'history' ? (
          <HistoryPage />
        ) : page === 'posts' ? (
          <PostsPage />
        ) : (
          <DiaryPage />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsPage() {
  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Image source={avatar} style={{ width: 80, height: 80, borderRadius: 40 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 23, fontWeight: '700', color: '#161616' }}>{'Huy Trường'}</Text>
          <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>@huytruong</Text>
        </View>
        <ChevronRight />
      </Card>
      <Card noPadding>
        <Row icon={Bell} title="Thông báo" sub="Bữa ăn, cộng đồng và nhắc nhở" />
        <Row icon={Pencil} title="Giao diện" sub="Sáng" />
        <Row icon={Globe2} title="Ngôn ngữ" sub="Tiếng Việt" />
        <Row icon={ShieldCheck} title="Đồng bộ dữ liệu" sub="Đã bật" last />
      </Card>
      <Card noPadding>
        <ToggleRow icon={Volume2} title="Âm thanh" initial />
        <ToggleRow icon={Footprints} title="Rung" initial last />
      </Card>
      <Text style={{ fontSize: 16, color: '#FF4D3D', textAlign: 'center', paddingVertical: 12 }}>
        Đăng xuất
      </Text>
    </>
  );
}
function EditPage() {
  return (
    <>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Image source={avatar} style={{ width: 154, height: 154, borderRadius: 77 }} />
        <View
          style={{
            position: 'absolute',
            right: '27%',
            bottom: 34,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#FFD54F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Camera size={22} />
        </View>
        <Text style={{ fontSize: 15, color: '#D99A00' }}>Thay ảnh</Text>
      </View>
      {[
        ['Họ và tên', 'Huy Trương', UserRound],
        ['Tên người dùng', '@huytruong', Info],
        ['Ngày sinh', '12/03/2000', CalendarDays],
        ['Giới tính', 'Nam', UserRound],
        ['Giới thiệu', 'Yêu món Việt và thích khám phá món mới.', Pencil],
        ['Khu vực', 'TP. Hồ Chí Minh', MapPin],
      ].map(([a, b, I]) => (
        <Card
          key={a as string}
          style={{ minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <SoftIcon icon={I as ComponentType<any>} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{a as string}</Text>
            <Text style={{ fontSize: 18, color: '#161616', marginTop: 4 }}>{b as string}</Text>
          </View>
          <ChevronRight />
        </Card>
      ))}
      <PrimaryButton text="Lưu thay đổi" />
    </>
  );
}
function JourneyPage() {
  return (
    <>
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}
      >
        <Sparkles size={60} color={CLR.yellowDark} fill={CLR.yellow} />
        <View>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>
            12{' '}
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>
              ngày liên tiếp
            </Text>
          </Text>
          <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>
            Kỷ lục dài nhất: 18 ngày
          </Text>
        </View>
      </Card>
      <MonthCalendar />
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Thành tích
      </Text>
      <Card style={{ flexDirection: 'row' }}>
        {[
          ['Người khám phá', '8 món mới'],
          ['Chăm ghi bữa', '36 bữa'],
          ['Cân bằng', '5 ngày đạt mục tiêu'],
        ].map(([a, b]) => (
          <View key={a} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
            <Sparkles color={CLR.yellowDark} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{a}</Text>
            <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{b}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Tiến độ tháng này
      </Text>
      <Card>
        {['Ghi bữa ăn  36/60', 'Thử món mới  8/10', 'Uống đủ nước  12/31 ngày'].map((x) => (
          <View key={x} style={{ paddingVertical: 12, gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{x}</Text>
            <View
              style={{
                height: 9,
                borderRadius: 5,
                backgroundColor: '#F1EEE7',
                overflow: 'hidden',
                marginTop: 10,
              }}
            >
              <View
                style={{
                  height: '100%',
                  borderRadius: 5,
                  backgroundColor: '#FFD54F',
                  width: '68%',
                }}
              />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}
function HealthPage() {
  return (
    <>
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 15,
          borderWidth: 1,
          borderColor: '#F5D788',
        }}
      >
        <ShieldCheck size={52} color={CLR.yellowDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>
            Dữ liệu giúp Mogu gợi ý món phù hợp hơn
          </Text>
          <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>
            Mogu cam kết bảo mật thông tin cá nhân của bạn tuyệt đối.
          </Text>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[
          ['Chiều cao', '170 cm'],
          ['Cân nặng', '65 kg'],
          ['BMI', '22,5'],
          ['Mục tiêu cân nặng', '62 kg'],
        ].map(([a, b]) => (
          <Card key={a} style={{ width: '48%', minHeight: 130, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{a}</Text>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>{b}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Mức độ vận động
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Chip text="Ít vận động" />
          <Chip text="Vừa phải" active />
          <Chip text="Năng động" />
        </View>
      </Card>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Mục tiêu mỗi ngày
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 15 }}>
          {[
            ['Năng lượng', '1.850 kcal'],
            ['Protein', '100 g'],
            ['Nước', '2 L'],
            ['Bước', '8.000'],
          ].map(([a, b]) => (
            <View key={a} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{a}</Text>
              <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{b}</Text>
            </View>
          ))}
        </View>
      </Card>
      <PrimaryButton text="Cập nhật thông tin" />
    </>
  );
}
function PreferencesPage() {
  const [goal, setGoal] = useState('Ăn cân bằng');
  return (
    <>
      <ChoiceCard
        title="Mục tiêu chính"
        items={['Ăn cân bằng', 'Giảm cân', 'Tăng cơ', 'Duy trì cân nặng']}
        value={goal}
        setValue={setGoal}
      />
      <ChoiceCard
        title="Khẩu vị yêu thích"
        items={['Đậm đà', 'Thanh nhẹ', 'Cay', 'Ít ngọt', 'Chua', 'Béo']}
        multi
      />
      <ChoiceCard
        title="Ẩm thực yêu thích"
        items={['Món Việt', 'Món Á', 'Món Âu', 'Ăn chay']}
        multi
      />
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Ưu tiên khi chọn món
        </Text>
        <ToggleRow icon={HeartPulse} title="Lành mạnh" initial />
        <ToggleRow icon={Bookmark} title="Tiết kiệm" initial />
        <ToggleRow icon={History} title="Nhanh gọn" />
        <ToggleRow icon={Sparkles} title="Thử món mới" initial last />
      </Card>
      <PrimaryButton text="Lưu thay đổi" />
    </>
  );
}
function AvoidPage() {
  const [tags, setTags] = useState(['Hải sản', 'Đậu phộng', 'Sữa bò', 'Rau mùi', 'Hành sống']);
  return (
    <>
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 15,
          borderWidth: 1,
          borderColor: '#F5D788',
        }}
      >
        <Info color={CLR.yellowDark} />
        <Text style={{ fontSize: 16, lineHeight: 24, color: '#161616', flex: 1 }}>
          Mogu sẽ loại các món có chứa nguyên liệu bạn chọn.
        </Text>
      </Card>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search color={CLR.secondary} />
        <TextInput
          placeholder="Tìm nguyên liệu..."
          style={{ flex: 1, fontSize: 15, color: '#161616' }}
        />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Đã chọn
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tags.map((x) => (
          <Pressable
            key={x}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#F4D99C',
            }}
            onPress={() => setTags(tags.filter((t) => t !== x))}
          >
            <Text>{x} ×</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Gợi ý phổ biến
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {['Trứng', 'Gluten', 'Đậu nành', 'Nấm', 'Thịt bò', 'Thịt heo'].map((x) => (
          <Pressable
            key={x}
            style={{
              width: '48%',
              height: 70,
              borderRadius: 18,
              backgroundColor: '#fff',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#5D490F',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            }}
            onPress={() => setTags([...tags, x])}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{x}</Text>
            <Plus color={CLR.yellowDark} />
          </Pressable>
        ))}
      </View>
      <PrimaryButton text={`Lưu ${tags.length} lựa chọn`} />
    </>
  );
}
function SavedPage() {
  return (
    <>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search />
        <TextInput
          placeholder="Tìm trong món đã lưu..."
          style={{ flex: 1, fontSize: 15, color: '#161616' }}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Chip text="Tất cả" active />
        <Chip text="Bữa sáng" />
        <Chip text="Lành mạnh" />
        <Chip text="Dưới 50K" />
      </View>
      <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>128 món đã lưu</Text>
      {[
        [pho, 'Phở bò', '420 kcal · 25 phút · 45K–65K'],
        [rice, 'Cơm gà Hội An', '560 kcal · 20 phút · 40K–60K'],
        [salad, 'Salad ức gà', '320 kcal · 15 phút · 50K–70K'],
        [bun, 'Bún bò Huế', '520 kcal · 30 phút · 40K–60K'],
      ].map(([im, n, m]) => (
        <FoodRow key={n as string} image={im as number} name={n as string} meta={m as string} />
      ))}
    </>
  );
}
function PrivacyPage() {
  return (
    <>
      {[
        ['Bảo mật tài khoản', ['Đổi mật khẩu', 'Xác thực sinh trắc học', 'Thiết bị đã đăng nhập']],
        ['Quyền riêng tư', ['Hồ sơ công khai', 'Hiển thị hoạt động ăn uống', 'Cho phép bình luận']],
        ['Dữ liệu của bạn', ['Tải dữ liệu của tôi', 'Xóa lịch sử Random', 'Xóa dữ liệu sức khỏe']],
        ['Quyền truy cập', ['Vị trí', 'Thông báo', 'Ảnh & Camera']],
      ].map(([h, rows]) => (
        <Card key={h as string}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
            {h as string}
          </Text>
          {(rows as string[]).map((r, i) => (
            <Row key={r} icon={LockKeyhole} title={r} last={i === (rows as string[]).length - 1} />
          ))}
        </Card>
      ))}
      <Pressable
        style={{
          height: 58,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#FF4D3D',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <Trash2 color={CLR.danger} />
        <Text style={{ color: '#FF4D3D', fontWeight: '600' }}>Xóa tài khoản</Text>
      </Pressable>
    </>
  );
}
function HistoryPage() {
  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <Sparkles color={CLR.yellowDark} />
        <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>24</Text>
        <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>lần Random</Text>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 18,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: '#E8E4DC',
          }}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>18</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              món đã chọn
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>6</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              Random lại
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>75%</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              tỷ lệ chọn
            </Text>
          </View>
        </View>
      </Card>
      {[
        [pho, 'Phở bò', '12:10'],
        [bun, 'Bún bò Huế', '19:15'],
        [salad, 'Salad cá ngừ', '12:40'],
        [rice, 'Cơm gà Hội An', '19:05'],
      ].map(([im, n, t]) => (
        <FoodRow
          key={n as string}
          image={im as number}
          name={n as string}
          meta={`${t} · Phù hợp 90%`}
        />
      ))}
    </>
  );
}
function PostsPage() {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Chip text="Đã đăng 24" active />
        <Chip text="Bản nháp 3" />
        <Chip text="Đã lưu 12" />
      </View>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search />
        <TextInput
          placeholder="Tìm bài viết..."
          style={{ flex: 1, fontSize: 15, color: '#161616' }}
        />
      </View>
      {[
        [pho, 'Hôm nay Mogu chọn Phở bò cho mình!'],
        [salad, 'Bữa trưa lành mạnh của mình hôm nay'],
        [rice, '5 cách ăn uống cân bằng hơn'],
      ].map(([im, t]) => (
        <Card key={t as string}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={avatar} style={{ width: 44, height: 44, borderRadius: 22 }} />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>Huy Trương</Text>
              <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>Hôm nay · 12:20</Text>
            </View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '600', marginVertical: 14 }}>{t as string}</Text>
          <Image source={im as number} style={{ width: '100%', height: 210, borderRadius: 16 }} />
          <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>
            ♡ 128 lượt thích · ◯ 24 bình luận
          </Text>
        </Card>
      ))}
    </>
  );
}
function DiaryPage() {
  return (
    <>
      <Card>
        <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>
          1.240 <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>/ 1.850 kcal</Text>
        </Text>
        <View
          style={{
            height: 9,
            borderRadius: 5,
            backgroundColor: '#F1EEE7',
            overflow: 'hidden',
            marginTop: 10,
          }}
        >
          <View
            style={{ height: '100%', borderRadius: 5, backgroundColor: '#FFD54F', width: '67%' }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 18,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: '#E8E4DC',
          }}
        >
          {[
            ['68g', 'Protein'],
            ['142g', 'Tinh bột'],
            ['38g', 'Chất béo'],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
                {l}
              </Text>
              <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{v}</Text>
            </View>
          ))}
        </View>
      </Card>
      {[
        [pho, 'Bữa sáng · 07:30', 'Phở bò · 420 kcal'],
        [rice, 'Bữa trưa · 12:15', 'Cơm gà Hội An · 560 kcal'],
        [salad, 'Bữa phụ · 15:30', 'Sữa chua trái cây · 260 kcal'],
      ].map(([im, n, m]) => (
        <FoodRow key={n as string} image={im as number} name={n as string} meta={m as string} />
      ))}
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>Bữa tối</Text>
        <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>Chưa ghi lại</Text>
        <Plus color={CLR.yellowDark} />
      </Card>
      <PrimaryButton text="＋ Ghi lại bữa ăn" />
    </>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="h-[60px] px-4 flex-row items-center justify-between bg-[#FFF9E8]">
      <IconButton icon={ArrowLeft} onPress={onBack} />
      <Text className="text-[22px] font-bold text-[#161616]">{title}</Text>
      <View className="w-11" />
    </View>
  );
}
function Card({ children, style, noPadding }: { children: any; style?: any; noPadding?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: 22,
          padding: noPadding ? 0 : 16,
          shadowColor: '#5D490F',
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
function IconButton({ icon: Icon, onPress }: { icon: ComponentType<any>; onPress?: () => void }) {
  return (
    <Pressable className="w-11 h-11 items-center justify-center" onPress={onPress}>
      <Icon size={27} color="#161616" />
    </Pressable>
  );
}
function SoftIcon({ icon: Icon }: { icon: ComponentType<any> }) {
  return (
    <View className="w-11 h-11 rounded-[13px] bg-[#FFF7DF] items-center justify-center">
      <Icon size={24} color="#805B0A" />
    </View>
  );
}
function Row({
  icon,
  title,
  sub,
  onPress,
  last,
}: {
  icon: ComponentType<any>;
  title: string;
  sub?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={{
        minHeight: 70,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#E8E4DC',
        paddingHorizontal: 16,
      }}
      onPress={onPress}
    >
      <SoftIcon icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{title}</Text>
        {sub && <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{sub}</Text>}
      </View>
      <ChevronRight size={21} />
    </Pressable>
  );
}
function ToggleRow({
  icon,
  title,
  initial,
  last,
}: {
  icon: ComponentType<any>;
  title: string;
  initial?: boolean;
  last?: boolean;
}) {
  const [on, setOn] = useState(!!initial);
  return (
    <View
      style={{
        minHeight: 70,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#E8E4DC',
        paddingHorizontal: 16,
      }}
    >
      <SoftIcon icon={icon} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616', flex: 1 }}>{title}</Text>
      <Pressable
        onPress={() => setOn(!on)}
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          backgroundColor: on ? '#FFD54F' : '#E6E6E6',
          padding: 3,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#fff',
            alignSelf: on ? 'flex-end' : 'flex-start',
          }}
        />
      </Pressable>
    </View>
  );
}
function Shortcut({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: ComponentType<any>;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={{
        width: '48%',
        minHeight: 84,
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
      onPress={onPress}
    >
      <SoftIcon icon={icon} />
      <View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{title}</Text>
        <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}
function PrimaryButton({ text }: { text: string }) {
  return (
    <Pressable
      style={{
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FFD54F',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <Text className="text-[17px] font-bold text-[#161616]">{text}</Text>
    </Pressable>
  );
}
function Chip({ text, active }: { text: string; active?: boolean }) {
  return (
    <Pressable
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? '#F5B900' : '#E8E4DC',
        backgroundColor: active ? '#FFD54F' : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: '#161616', fontWeight: active ? '700' : '400' }}>
        {text}
      </Text>
    </Pressable>
  );
}
function ChoiceCard({
  title,
  items,
  value,
  setValue,
  multi,
}: {
  title: string;
  items: string[];
  value?: string;
  setValue?: (x: string) => void;
  multi?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(multi ? [items[0]] : []);
  return (
    <Card>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {items.map((x) => {
          const active = multi ? selected.includes(x) : value === x;
          return (
            <Pressable
              key={x}
              style={{
                width: '48%',
                minHeight: 72,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: active ? '#F5B900' : '#E8E4DC',
                backgroundColor: active ? '#FFF4C7' : '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onPress={() =>
                multi
                  ? setSelected(active ? selected.filter((y) => y !== x) : [...selected, x])
                  : setValue?.(x)
              }
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{x}</Text>
              {active && <Check color="#fff" />}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
function FoodRow({ image, name, meta }: { image: number; name: string; meta: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <Image source={image} style={{ width: 116, height: 106, borderRadius: 16 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#161616', marginBottom: 10 }}>
          {name}
        </Text>
        <Text style={{ fontSize: 14, color: '#747474' }}>{meta}</Text>
      </View>
      <Bookmark color="#F5BD18" fill="#FFD54F" />
    </View>
  );
}
function MonthCalendar() {
  return (
    <Card>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>Tháng 8, 2026</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <View
            key={d}
            style={{
              width: '11.5%',
              aspectRatio: 1,
              borderRadius: 22,
              backgroundColor: d <= 21 ? '#FFD54F' : '#FFF8E6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12 }}>{d}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
function BottomNav({ onHome, onExplore, onRandom, onHealth }: Props) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 18,
        right: 18,
        bottom: 12,
        height: 88,
        borderRadius: 30,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {[
        [Home, 'Trang chủ', onHome],
        [Compass, 'Khám phá', onExplore],
        [Sparkles, 'Random', onRandom],
        [HeartPulse, 'Sức khỏe', onHealth],
        [UserRound, 'Cá nhân', undefined],
      ].map(([I, l, fn], i) => {
        const Icon = I as ComponentType<any>;
        return (
          <Pressable
            key={l as string}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
            onPress={fn as any}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: i === 2 ? '#FFD54F' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                size={25}
                color={i === 4 ? CLR.ink : CLR.secondary}
                fill={i === 4 ? CLR.yellow : 'transparent'}
              />
            </View>
            <Text
              style={{
                fontSize: 11,
                color: i === 4 ? '#161616' : '#747474',
                fontWeight: i === 4 ? '700' : '400',
              }}
            >
              {l as string}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
