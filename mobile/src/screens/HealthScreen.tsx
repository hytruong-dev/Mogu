import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  CalendarDays,
  Check,
  Droplets,
  Footprints,
  Plus,
  Utensils,
} from 'lucide-react-native';
import { cn } from '../lib/utils';
import { ExploreDetailScreen } from './ExploreDetailScreen';
import { HealthOverviewScreen, LogMealScreen, MealsScreen } from './HealthDetailScreens';
import { DateNavigator } from '../components/molecules/DateNavigator';
import { HealthDatePickerSheet } from '../components/organisms/HealthDatePickerSheet';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';

const pho = require('../assets/images/random/pho-result.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const mascot = require('../assets/images/random/thumb.png');

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onProfile: () => void;
};

export function HealthScreen({ onHome, onExplore, onRandom, onProfile }: Props) {
  const [page, setPage] = useState<'main' | 'overview' | 'meals' | 'log' | 'food'>('main');
  const [addedCalories, setAddedCalories] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const total = 1240 + addedCalories;
  const remaining = Math.max(0, 1850 - total);

  if (page === 'overview')
    return <HealthOverviewScreen total={total} onBack={() => setPage('main')} />;
  if (page === 'meals') {
    return (
      <MealsScreen
        total={total}
        onBack={() => setPage('main')}
        onLog={() => setPage('log')}
        onFood={() => setPage('food')}
      />
    );
  }
  if (page === 'log') {
    return (
      <LogMealScreen
        onClose={() => setPage('main')}
        onSave={(cal) => {
          setAddedCalories((c) => c + cal);
          setPage('main');
        }}
      />
    );
  }
  if (page === 'food') return <ExploreDetailScreen type="food" onBack={() => setPage('meals')} />;

  return (
    <SafeAreaView className="flex-1 bg-mogu-cream" edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
      >
        {/* Header */}
        <View className="h-[74px] flex-row items-center justify-between">
          <Text className="text-[32px] font-bold text-[#161616]">Sức khỏe</Text>
          <View className="flex-row gap-2">
            <Pressable
              className="w-11 h-11 items-center justify-center"
              onPress={() => setDatePickerVisible(true)}
            >
              <CalendarDays size={27} />
            </Pressable>
            <Pressable className="w-11 h-11 items-center justify-center relative">
              <Bell size={27} />
              <View className="absolute right-[6px] top-[4px] w-[9px] h-[9px] rounded-full bg-[#FF5F57]" />
            </Pressable>
          </View>
        </View>

        <DateNavigator
          date={selectedDate}
          onPrevious={() =>
            setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
          }
          onNext={() =>
            setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
          }
          onPress={() => setDatePickerVisible(true)}
        />

        {/* Overview card */}
        <View className="rounded-[24px] bg-white p-4 mt-4" style={shadow}>
          <View className="h-[46px] flex-row items-center justify-between">
            <Text className="text-[20px] font-bold text-[#161616]">Tổng quan hôm nay</Text>
            <Pressable onPress={() => setPage('overview')} hitSlop={10}>
              <Text className="text-[14px] text-[#D79B00]">Chi tiết ›</Text>
            </Pressable>
          </View>

          {/* Calorie row */}
          <View className="flex-row items-center py-2.5">
            {/* Ring */}
            <View className="w-[152px] h-[152px] rounded-full border-[16px] border-mogu-yellow items-center justify-center relative">
              <View
                className="absolute bg-white"
                style={{
                  top: -18,
                  left: 40,
                  width: 36,
                  height: 22,
                  transform: [{ rotate: '12deg' }],
                }}
              />
              <Text className="text-[34px] font-bold text-[#161616]">
                {total.toLocaleString('vi-VN')}
              </Text>
              <Text className="text-[14px] text-[#626262] mt-[3px]">kcal đã nạp</Text>
            </View>

            {/* Goal block */}
            <View className="flex-1 pl-7">
              <Text className="text-[14px] text-[#626262]">Mục tiêu</Text>
              <Text className="text-[26px] font-bold mt-1">
                1.850 <Text className="text-[14px] font-normal">kcal</Text>
              </Text>
              <View className="h-px bg-[#E8E0D2] my-3.5" />
              <Text className="text-[14px] text-[#626262]">Còn lại</Text>
              <Text className="text-[26px] font-bold mt-1">
                {remaining.toLocaleString('vi-VN')}{' '}
                <Text className="text-[14px] font-normal">kcal</Text>
              </Text>
            </View>
          </View>

          {/* Macros */}
          <View className="border-t border-[#E8E0D2] pt-3.5 flex-row">
            <MacroBar label="Protein" value="68/100g" progress={0.68} color="#FFD54F" />
            <MacroBar label="Tinh bột" value="142/220g" progress={0.65} color="#FF7043" />
            <MacroBar label="Chất béo" value="38/60g" progress={0.63} color="#7BCB38" />
          </View>
        </View>

        {/* Activity cards */}
        <View className="flex-row gap-3 mt-3.5">
          {/* Water */}
          <View className="flex-1 min-h-[150px] rounded-[20px] bg-white p-3" style={shadow}>
            <View className="flex-row items-center gap-2.5">
              <View className="w-12 h-12 rounded-full bg-[#E8F2FF] items-center justify-center">
                <Droplets size={27} color="#2F85F6" fill="#2F85F6" />
              </View>
              <View>
                <Text className="text-[14px]">Nước</Text>
                <Text className="text-[23px] font-bold mt-[3px]">
                  1,2 <Text className="text-[13px] font-normal">/ 2L</Text>
                </Text>
              </View>
            </View>
            <View className="flex-row gap-[3px] mt-3.5">
              {[1, 1, 1, 1, 0, 0].map((active, i) => (
                <View
                  key={i}
                  className={cn('flex-1 h-2 rounded', active ? 'bg-[#2F85F6]' : 'bg-[#E8E8E8]')}
                />
              ))}
            </View>
            <Pressable className="h-8 rounded-2xl bg-[#E8F2FF] items-center justify-center mt-3.5">
              <Text className="text-[14px] text-[#2F85F6] font-semibold">+ 250 ml</Text>
            </Pressable>
          </View>

          {/* Steps */}
          <View className="flex-1 min-h-[150px] rounded-[20px] bg-white p-3" style={shadow}>
            <View className="flex-row items-center gap-2.5">
              <View className="w-12 h-12 rounded-full bg-[#FFF4D9] items-center justify-center">
                <Footprints size={28} color="#805012" fill="#805012" />
              </View>
              <View>
                <Text className="text-[14px]">Vận động</Text>
                <Text className="text-[23px] font-bold mt-[3px]">
                  6.240 <Text className="text-[13px] font-normal">bước</Text>
                </Text>
              </View>
            </View>
            <Text className="text-[13px] text-[#626262] mt-3 ml-[58px]">Mục tiêu 8.000</Text>
            <View className="h-2 rounded bg-[#F3EEE3] overflow-hidden mt-2.5">
              <View className="h-full rounded bg-mogu-yellow" style={{ width: '78%' }} />
            </View>
          </View>
        </View>

        {/* Meals section */}
        <View className="h-[46px] flex-row items-center justify-between mt-1">
          <Text className="text-[20px] font-bold text-[#161616]">Bữa ăn hôm nay</Text>
          <Pressable onPress={() => setPage('meals')} hitSlop={10}>
            <Text className="text-[14px] text-[#D79B00]">Xem tất cả ›</Text>
          </Pressable>
        </View>

        <View className="rounded-[20px] bg-white overflow-hidden" style={shadow}>
          <MealRow image={pho} title="Bữa sáng" subtitle="Phở bò · 420 kcal" />
          <MealRow image={rice} title="Bữa trưa" subtitle="Cơm gà Hội An · 560 kcal" />

          {/* Empty dinner */}
          <Pressable
            className="h-[72px] px-2.5 flex-row items-center border-b border-[#E8E0D2]"
            onPress={() => setPage('log')}
          >
            <View className="w-[72px] h-[58px] rounded-xl bg-[#FFF4D9] items-center justify-center">
              <Utensils size={28} color="#7B5012" />
            </View>
            <View className="flex-1 pl-3.5">
              <Text className="text-[17px] font-bold">Bữa tối</Text>
              <Text className="text-[14px] text-[#626262] mt-[5px]">Chưa ghi lại</Text>
            </View>
            <View className="w-[38px] h-[38px] rounded-full border-2 border-[#F5B900] items-center justify-center">
              <Plus size={24} color="#C78F00" />
            </View>
          </Pressable>

          <Pressable
            className="h-12 m-2.5 rounded-2xl bg-mogu-yellow flex-row items-center justify-center gap-2"
            onPress={() => setPage('log')}
          >
            <Plus size={20} />
            <Text className="text-[16px] font-semibold">Ghi lại bữa ăn</Text>
          </Pressable>
        </View>

        {/* Tip */}
        <View className="h-[132px] rounded-[20px] bg-[#FFF4D9] p-4 mt-4 overflow-hidden">
          <Text className="text-[20px] font-bold">Gợi ý từ Mogu</Text>
          <Text className="text-[14px] mt-2" style={{ lineHeight: 22, maxWidth: '66%' }}>
            Bạn còn thiếu khoảng 32g protein.{`\n`}Thêm trứng hoặc ức gà vào bữa tối nhé!
          </Text>
          <Image
            source={mascot}
            resizeMode="contain"
            className="absolute"
            style={{ right: -12, bottom: -22, width: 150, height: 150 }}
          />
        </View>

        <View className="h-[100px]" />
      </ScrollView>

      <LiquidGlassBottomNav
        active="health"
        onHome={onHome}
        onExplore={onExplore}
        onRandom={onRandom}
        onProfile={onProfile}
      />

      <HealthDatePickerSheet
        visible={datePickerVisible}
        value={selectedDate}
        datesWithData={[
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 7),
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 8),
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 9),
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 10),
        ]}
        onCancel={() => setDatePickerVisible(false)}
        onConfirm={(date) => {
          setSelectedDate(date);
          setDatePickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  label,
  value,
  progress,
  color,
}: {
  label: string;
  value: string;
  progress: number;
  color: string;
}) {
  return (
    <View className="flex-1 px-2 border-r border-[#E8E0D2]" style={{ borderRightWidth: 1 }}>
      <Text className="text-[14px] text-[#161616]">{label}</Text>
      <Text className="text-[15px] font-semibold mt-[5px]">{value}</Text>
      <View className="h-2 rounded bg-[#F3EEE3] overflow-hidden mt-2.5">
        <View
          className="h-full rounded"
          style={{ width: `${progress * 100}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

// ─── MealRow ──────────────────────────────────────────────────────────────────

function MealRow({ image, title, subtitle }: { image: number; title: string; subtitle: string }) {
  return (
    <View className="h-[72px] px-2.5 flex-row items-center border-b border-[#E8E0D2]">
      <Image
        source={image}
        className="w-[72px] h-[58px] rounded-xl"
        style={{ width: 72, height: 58, borderRadius: 12 }}
      />
      <View className="flex-1 pl-3.5">
        <Text className="text-[17px] font-bold">{title}</Text>
        <Text className="text-[14px] text-[#626262] mt-[5px]">{subtitle}</Text>
      </View>
      <View className="w-[34px] h-[34px] rounded-full bg-[#52C634] items-center justify-center">
        <Check size={21} color="#FFF" strokeWidth={3} />
      </View>
    </View>
  );
}
