import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { profileApi } from '../../../services/api/profile';
import { P, PageScaffold, PCard, ProgressBar, SectionTitle, StatTile, EmptyBlock } from '../ProfileUI';
import { getDeviceTimeZone, getTodayISO } from '../../../lib/dates';
import { Trophy } from '@/components/icons';
import { LoadBlock, errMsg, MonthCalendar } from '../shared';

// ─── Journey ─────────────────────────────────────────────────────────────────

export function JourneyPage() {
  const tz = getDeviceTimeZone();
  const month = getTodayISO(tz).slice(0, 7);

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['profile', 'journey', month, tz],
    queryFn: () => profileApi.getJourney(month, tz),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loading = isLoading && !data;
  const error = queryError ? errMsg(queryError, 'Không tải được hành trình.') : null;
  const load = useCallback(() => void refetch(), [refetch]);

  const streak = data?.streak?.currentDays ?? data?.currentStreakDays ?? 0;
  const longest = data?.streak?.longestDays ?? data?.longestStreakDays ?? 0;
  const achievements: Array<any> = data?.achievements ?? [];
  const monthlyGoals: Array<any> = data?.monthlyGoals ?? [];
  const days: Array<{ localDate: string; status: string }> = data?.days ?? [];
  const activeDays = days.filter(
    (d) => d.status === 'QUALIFIED' || d.status === 'COMPLETED' || d.status === 'IN_PROGRESS',
  ).length;

  return (
    <PageScaffold>
      <LoadBlock loading={loading} error={error} onRetry={load} skeleton="journey">
        <Animated.View entering={FadeInDown.duration(380)}>
          <LinearGradient
            colors={['#FF9A3C', '#FFC928']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={js.hero}
          >
            <FlameBadge />
        <View style={{ flex: 1 }}>
              <Text style={js.heroLabel}>Chuỗi ngày hiện tại</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={js.heroValue}>{streak}</Text>
                <Text style={js.heroUnit}>ngày</Text>
        </View>
              <Text style={js.heroSub}>
                {streak > 0 ? 'Tuyệt vời! Giữ vững phong độ nhé 💪' : 'Ghi một bữa hôm nay để bắt đầu chuỗi!'}
              </Text>
      </View>
          </LinearGradient>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile emoji="🏆" value={longest} unit="ngày" label="Kỷ lục dài nhất" tint="yellow" />
          <StatTile emoji="📅" value={activeDays} unit="ngày" label="Hoạt động tháng này" tint="green" />
        </View>

        <PCard delay={100}>
          <MonthCalendar month={data?.month ?? month} days={days} />
        </PCard>

        <SectionTitle title="Thành tích" sub={achievements.length ? `${achievements.length} huy hiệu` : undefined} />
        {achievements.length === 0 ? (
          <PCard>
            <EmptyBlock emoji="🎖️" title="Chưa có thành tích" body="Ghi bữa đều đặn để mở khoá huy hiệu đầu tiên." />
          </PCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {achievements.map((a, i) => {
              const progress = Number(a.progress ?? 0);
              const target = Math.max(Number(a.target ?? 1), 1);
              const done = progress >= target;
              return (
                <Animated.View
                  key={a.id ?? a.code ?? i}
                  entering={FadeInDown.delay(140 + i * 50).duration(360)}
                  style={[js.badge, done && js.badgeDone]}
                >
                  <View style={[js.badgeIcon, done && { backgroundColor: '#FFE08A' }]}>
                    <Trophy size={22} color={done ? '#B26A00' : P.faint} />
            </View>
                  <Text style={js.badgeName} numberOfLines={2}>
                    {a.name}
                  </Text>
                  <Text style={js.badgeProgress}>
                    {progress}/{target}
                  </Text>
                  <View style={{ width: '100%', marginTop: 6 }}>
                    <ProgressBar pct={(progress / target) * 100} height={5} color={done ? '#FFB800' : '#E5D9BE'} />
        </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <SectionTitle title="Tiến độ tháng này" />
        <PCard delay={200}>
          {monthlyGoals.length === 0 ? (
            <Text style={{ color: P.muted, textAlign: 'center', paddingVertical: 8 }}>Chưa có mục tiêu tháng.</Text>
          ) : (
            monthlyGoals.map((g, i) => {
              const current = Number(g.current ?? 0);
              const target = Math.max(Number(g.target ?? 1), 1);
              const pct = Math.min(100, Math.round((current / target) * 100));
  return (
                <View key={g.code ?? g.label} style={{ paddingVertical: 8, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: '#F6EFE2' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: P.ink, flex: 1 }}>{g.label}</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: pct >= 100 ? P.success : P.accentDeep }}>
                      {current}/{target}
                    </Text>
      </View>
                  <ProgressBar pct={pct} color={pct >= 100 ? '#22C55E' : P.accent} />
      </View>
              );
            })
          )}
        </PCard>
      </LoadBlock>
    </PageScaffold>
  );
}

function FlameBadge() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + t.value * 0.08 }, { rotate: `${(t.value - 0.5) * 8}deg` }] }));
  return (
    <Animated.View style={[js.flame, st]}>
      <Text style={{ fontSize: 36 }}>🔥</Text>
    </Animated.View>
  );
}

const js = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  heroValue: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, lineHeight: 44 },
  heroUnit: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 7 },
  heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  badge: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: P.card,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#5D490F',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  badgeDone: { borderWidth: 1.5, borderColor: '#FFD54F' },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F6F0E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeName: { fontSize: 14, fontWeight: '800', color: P.ink, textAlign: 'center' },
  badgeProgress: { fontSize: 12.5, color: P.muted, marginTop: 2 },
});
