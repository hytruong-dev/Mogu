import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Skeleton } from '../ui/skeleton';

/* ────────────────────────────────────────────────────────────────────────────
 * Design tokens for every skeleton. Keep these in one place so all loading
 * states share the same rhythm: 12px between rows, 16px between cards/sections,
 * 20px horizontal screen padding.
 * ──────────────────────────────────────────────────────────────────────────── */
export const SK = {
  pageX: 20,
  pageTop: 12,
  pageBottom: 32,
  /** vertical distance between cards / sections */
  section: 16,
  /** vertical distance between repeated rows / list items */
  row: 12,
  /** space between bones inside a row */
  inner: 12,
  /** space between text lines inside a block */
  line: 8,
  cardPad: 16,
  radius: 18,
  radiusLg: 22,
  bone: '#EDE4D0',
  boneSoft: '#F4EEE1',
  card: '#FFFFFF',
  border: '#EDE5D2',
  divider: '#EFE8DA',
} as const;

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/** Single skeleton block. */
export function Bone({ width = '100%', height = 14, radius = 8, style }: BoneProps) {
  return <Skeleton style={[{ width, height, borderRadius: radius }, style]} />;
}

export function BoneCircle({ size = 36, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <Bone width={size} height={size} radius={size / 2} style={style} />;
}

/** Horizontal row of bones with a guaranteed gap. */
export function BoneRow({
  children,
  gap = SK.inner,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[sk.row, { gap }, style]}>{children}</View>;
}

/** Vertical stack of bones with a guaranteed gap. */
export function BoneStack({
  children,
  gap = SK.line,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** White card container used by all skeletons. Children are stacked with `gap`. */
export function BoneCard({
  children,
  gap = SK.inner,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[sk.card, { gap }, style]}>{children}</View>;
}

/** Full-screen padding wrapper. Sections are separated by `SK.section`. */
export function BonePage({
  children,
  gap = SK.section,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[sk.page, { gap }, style]}>{children}</View>;
}

/** Two-line text block: title + subtitle. */
function BoneText({ title = '70%', sub = '45%', titleH = 16, subH = 12 }: {
  title?: BoneProps['width'];
  sub?: BoneProps['width'];
  titleH?: number;
  subH?: number;
}) {
  return (
    <BoneStack style={{ flex: 1 }}>
      <Bone width={title} height={titleH} />
      <Bone width={sub} height={subH} />
    </BoneStack>
  );
}

/** Icon + two-line text + optional trailing chevron. Used for form/list rows. */
function BoneListRow({
  leading = 'square',
  leadingSize = 40,
  trailing = true,
  title,
  sub,
}: {
  leading?: 'square' | 'circle';
  leadingSize?: number;
  trailing?: boolean;
  title?: BoneProps['width'];
  sub?: BoneProps['width'];
}) {
  return (
    <BoneCard style={sk.listCard}>
      {leading === 'circle' ? (
        <BoneCircle size={leadingSize} />
      ) : (
        <Bone width={leadingSize} height={leadingSize} radius={12} />
      )}
      <BoneText title={title} sub={sub} />
      {trailing ? <Bone width={18} height={18} radius={5} /> : null}
    </BoneCard>
  );
}

/** Row of N centered stat tiles (value + label). */
function BoneStats({ count = 3, valueW = 40 }: { count?: number; valueW?: number }) {
  return (
    <BoneRow gap={0}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={sk.statCell}>
          <Bone width={valueW} height={20} radius={6} />
          <Bone width={56 + (i % 3) * 8} height={12} radius={4} />
        </View>
      ))}
    </BoneRow>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Screen skeletons
 * ──────────────────────────────────────────────────────────────────────────── */

/** Boot / splash auth check */
export function BootSkeleton() {
  return (
    <BonePage style={{ paddingTop: 80 }}>
      <BoneStack gap={SK.inner}>
        <Bone width={120} height={36} radius={10} />
        <Bone width="70%" height={22} radius={8} />
      </BoneStack>
      <Bone width="100%" height={160} radius={SK.radius} />
      <Bone width="100%" height={100} radius={SK.radius} />
      <Bone width="100%" height={100} radius={SK.radius} />
    </BonePage>
  );
}

/** Profile main dashboard */
export function ProfileMainSkeleton() {
  return (
    <BoneStack gap={SK.section}>
      {/* Identity card */}
      <BoneCard gap={SK.section}>
        <BoneRow gap={14}>
          <BoneCircle size={96} />
          <BoneStack style={{ flex: 1 }} gap={10}>
            <Bone width="70%" height={22} />
            <Bone width="45%" height={14} />
            <Bone width={120} height={32} radius={12} />
          </BoneStack>
        </BoneRow>
        <View style={sk.divider} />
        <BoneStats />
      </BoneCard>

      {/* Weekly summary card */}
      <BoneCard gap={SK.section}>
        <Bone width={160} height={18} />
        <BoneStats />
        <BoneRow style={{ justifyContent: 'space-between' }} gap={0}>
          {Array.from({ length: 7 }).map((_, i) => (
            <BoneCircle key={i} size={28} />
          ))}
        </BoneRow>
      </BoneCard>

      {/* Quick-action grid 2×2 */}
      <View style={sk.grid2}>
        {[0, 1, 2, 3].map((i) => (
          <BoneCard key={i} style={sk.grid2Cell} gap={10}>
            <Bone width={36} height={36} radius={12} />
            <Bone width="70%" height={14} />
            <Bone width="45%" height={11} />
          </BoneCard>
        ))}
      </View>
    </BoneStack>
  );
}

export function ProfileEditSkeleton() {
  return (
    <BoneStack gap={SK.section} style={{ paddingBottom: SK.pageBottom }}>
      <View style={sk.avatarBlock}>
        <BoneCircle size={112} />
        <Bone width={72} height={14} />
      </View>
      <BoneStack gap={SK.row}>
        {Array.from({ length: 6 }).map((_, i) => (
          <BoneListRow key={i} title="35%" sub="55%" />
        ))}
      </BoneStack>
      <Bone width="100%" height={52} radius={16} />
    </BoneStack>
  );
}

export function FormRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <BoneStack gap={SK.row}>
      {Array.from({ length: rows }).map((_, i) => (
        <BoneListRow key={i} title="40%" sub="65%" trailing={false} />
      ))}
    </BoneStack>
  );
}

export function JourneySkeleton() {
  return (
    <BoneStack gap={SK.section}>
      <BoneCard>
        <BoneStats />
      </BoneCard>
      <BoneCard gap={14}>
        <Bone width={120} height={16} />
        <View style={sk.wrapGrid}>
          {Array.from({ length: 28 }).map((_, i) => (
            <BoneCircle key={i} size={28} />
          ))}
        </View>
      </BoneCard>
      <BoneCard gap={SK.line}>
        <Bone width="50%" height={14} style={{ marginBottom: 4 }} />
        <Bone width="100%" height={12} />
        <Bone width="80%" height={12} />
      </BoneCard>
    </BoneStack>
  );
}

export function EditPlanSkeleton() {
  return (
    <BonePage>
      <BoneRow style={{ justifyContent: 'center', minHeight: 28 }}>
        <Bone width={72} height={12} />
        <Bone width={88} height={12} />
        <Bone width={96} height={12} />
      </BoneRow>

      <BoneCard gap={SK.section}>
        <Bone width={140} height={13} />
        <BoneRow style={{ justifyContent: 'space-between' }}>
          <BoneCircle size={44} />
          <Bone width={160} height={28} radius={10} />
          <BoneCircle size={44} />
        </BoneRow>
        <Bone width="85%" height={11} />
      </BoneCard>

      <BoneCard gap={SK.section}>
        <Bone width={150} height={13} />
        <BoneRow style={{ justifyContent: 'space-between' }}>
          <BoneCircle size={44} />
          <Bone width={140} height={28} radius={10} />
          <BoneCircle size={44} />
        </BoneRow>
        <Bone width="100%" height={40} radius={12} />
      </BoneCard>

      <BoneCard gap={14}>
        <Bone width={80} height={13} />
        <BoneRow gap={10}>
          <Bone width="48%" height={48} radius={12} />
          <Bone width="48%" height={48} radius={12} />
        </BoneRow>
        <BoneRow gap={8} style={{ flexWrap: 'wrap' }}>
          <Bone width={72} height={36} radius={18} />
          <Bone width={96} height={36} radius={18} />
          <Bone width={84} height={36} radius={18} />
          <Bone width={88} height={36} radius={18} />
        </BoneRow>
      </BoneCard>

      <BoneStack gap={10}>
        <Bone width="100%" height={52} radius={14} />
        <Bone width="100%" height={52} radius={14} />
      </BoneStack>
      <Bone width={64} height={14} style={{ alignSelf: 'center' }} />
    </BonePage>
  );
}

export function WeeklyPlanSkeleton() {
  return (
    <BonePage gap={SK.row}>
      {/* Overview card */}
      <BoneCard style={{ padding: 14 }} gap={SK.inner}>
        <View style={sk.spaceBetween}>
          <BoneStack gap={6}>
            <Bone width={76} height={20} radius={999} />
            <Bone width={130} height={18} />
          </BoneStack>
          <Bone width={86} height={34} radius={999} />
        </View>
        <BoneRow gap={10}>
          {[0, 1].map((i) => (
            <View key={i} style={sk.softTile}>
              <Bone width={70} height={12} />
              <Bone width={i === 0 ? 85 : 95} height={16} />
              <Bone width="100%" height={6} radius={3} />
            </View>
          ))}
        </BoneRow>
      </BoneCard>

      {/* Calendar row */}
      <BoneCard style={{ padding: 8 }}>
        <BoneRow style={{ justifyContent: 'space-between' }} gap={6}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={sk.calCell}>
              <Bone width={20} height={10} />
              <Bone width={22} height={14} radius={4} />
            </View>
          ))}
        </BoneRow>
      </BoneCard>

      {/* Day header */}
      <View style={[sk.spaceBetween, { paddingHorizontal: 4, marginTop: 4 }]}>
        <Bone width={120} height={18} />
        <BoneRow gap={6}>
          <Bone width={36} height={20} radius={999} />
          <Bone width={58} height={20} radius={999} />
          <Bone width={30} height={20} radius={999} />
        </BoneRow>
      </View>

      {/* 3 Meal cards */}
      <BoneStack gap={SK.row}>
        {[0, 1, 2].map((i) => (
          <BoneCard key={i} style={sk.listCard}>
            <Bone width={76} height={76} radius={14} />
            <BoneStack style={{ flex: 1 }} gap={6}>
              <Bone width={64} height={16} radius={999} />
              <Bone width={i === 0 ? '80%' : i === 1 ? '70%' : '75%'} height={16} />
              <Bone width={100} height={12} />
            </BoneStack>
            <BoneStack gap={8} style={{ alignItems: 'center' }}>
              <BoneCircle size={32} />
              <BoneCircle size={32} />
            </BoneStack>
          </BoneCard>
        ))}
      </BoneStack>

      {/* Tool grid */}
      <BoneRow gap={10}>
        {[0, 1].map((i) => (
          <BoneCard key={i} style={[sk.listCard, { flex: 1, padding: 12 }]} gap={10}>
            <Bone width={36} height={36} radius={12} />
            <BoneStack style={{ flex: 1 }} gap={5}>
              <Bone width={70} height={13} />
              <Bone width={60} height={11} />
            </BoneStack>
          </BoneCard>
        ))}
      </BoneRow>
    </BonePage>
  );
}

/** Generic list (Notifications, Grocery, Day ingredients, Profile lists) */
export function ListSkeleton({ rows = 6, padded = true }: { rows?: number; padded?: boolean }) {
  return (
    <BonePage gap={SK.row} style={padded ? undefined : sk.noPad}>
      {Array.from({ length: rows }).map((_, i) => (
        <BoneListRow
          key={i}
          leading="circle"
          leadingSize={44}
          title={i % 2 === 0 ? '75%' : '62%'}
          sub={i % 2 === 0 ? '50%' : '38%'}
        />
      ))}
    </BonePage>
  );
}

/** Lịch sử Random — stats card + food cards */
export function RandomHistorySkeleton() {
  return (
    <BoneStack gap={SK.section}>
      <BoneCard style={sk.cardLg} gap={SK.section}>
        <View style={sk.center}>
          <BoneCircle size={30} />
          <Bone width={64} height={32} radius={8} />
          <Bone width={84} height={14} radius={6} />
        </View>
        <View style={sk.divider} />
        <BoneStats valueW={36} />
      </BoneCard>

      <BoneStack gap={SK.row}>
        {Array.from({ length: 4 }).map((_, i) => (
          <FoodCardBone key={i} />
        ))}
      </BoneStack>
    </BoneStack>
  );
}

function FoodCardBone({ withBadge = true }: { withBadge?: boolean }) {
  return (
    <BoneCard style={[sk.cardLg, sk.listCard, { padding: 10 }]} gap={14}>
      <Bone width={100} height={92} radius={16} />
      <BoneStack style={{ flex: 1 }} gap={10}>
        <Bone width="70%" height={18} radius={6} />
        {withBadge ? (
          <BoneRow gap={6}>
            <Bone width={56} height={18} radius={10} />
            <Bone width={64} height={13} radius={4} />
          </BoneRow>
        ) : (
          <Bone width="48%" height={13} radius={4} />
        )}
      </BoneStack>
      <Bone width={18} height={18} radius={5} style={{ marginRight: 6 }} />
    </BoneCard>
  );
}

/** Food list (Món đã lưu / Nhật ký món) */
export function FoodListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <BoneStack gap={SK.row}>
      {Array.from({ length: count }).map((_, i) => (
        <FoodCardBone key={i} withBadge={false} />
      ))}
    </BoneStack>
  );
}

export function DetailSkeleton() {
  return (
    <View>
      <Bone width="100%" height={240} radius={0} />
      <BonePage style={{ paddingTop: SK.section }}>
        <BoneStack gap={SK.line}>
          <Bone width="70%" height={24} style={{ marginBottom: 4 }} />
          <Bone width="100%" height={12} />
          <Bone width="90%" height={12} />
          <Bone width="60%" height={12} />
        </BoneStack>
        <BoneRow gap={10}>
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} width={72} height={56} radius={12} />
          ))}
        </BoneRow>
        <Bone width="100%" height={120} radius={14} />
      </BonePage>
    </View>
  );
}

export function HealthSkeleton() {
  return (
    <BonePage>
      <Bone width={160} height={22} />
      <BoneCard style={{ minHeight: 120 }} gap={SK.inner}>
        <Bone width="50%" height={16} />
        <Bone width="100%" height={10} radius={5} />
        <Bone width="80%" height={10} radius={5} />
      </BoneCard>
      <BoneRow gap={10}>
        {[0, 1, 2].map((i) => (
          <BoneCard key={i} style={{ flex: 1, minHeight: 96 }} gap={8}>
            <Bone width={28} height={28} radius={10} />
            <Bone width="80%" height={14} />
            <Bone width="55%" height={11} />
          </BoneCard>
        ))}
      </BoneRow>
      <BoneCard style={{ minHeight: 160 }} gap={SK.inner}>
        <Bone width="45%" height={16} />
        <Bone width="100%" height={88} radius={12} />
      </BoneCard>
    </BonePage>
  );
}

/* ─── Explore feed ─────────────────────────────────────────────────────────── */

function FeedActionRow({ extra = false }: { extra?: boolean }) {
  return (
    <View style={sk.exploreActionRow}>
      <BoneRow gap={8}>
        <Bone width={52} height={24} radius={12} />
        <Bone width={44} height={24} radius={12} />
        {extra ? <BoneCircle size={24} /> : null}
      </BoneRow>
      <BoneCircle size={24} />
    </View>
  );
}

export function DishFeedSkeleton() {
  return (
    <View style={sk.exploreCard}>
      <View style={sk.exploreMediaWrap}>
        <Bone width="100%" height={200} radius={16} />
      </View>
      <BoneStack style={sk.exploreBody} gap={SK.line}>
        <Bone width="72%" height={20} radius={6} />
        <Bone width="40%" height={14} radius={4} />
      </BoneStack>
      <FeedActionRow />
    </View>
  );
}

export function PostFeedSkeleton() {
  return (
    <View style={sk.exploreCard}>
      <BoneRow style={sk.exploreHeader} gap={10}>
        <BoneCircle size={42} />
        <BoneStack style={{ flex: 1 }} gap={6}>
          <Bone width={110} height={15} radius={4} />
          <Bone width={90} height={12} radius={4} />
        </BoneStack>
        <Bone width={86} height={32} radius={999} style={{ backgroundColor: '#FFE9A8' }} />
        <BoneCircle size={22} />
      </BoneRow>

      <BoneStack style={sk.exploreBody} gap={SK.line}>
        <Bone width="92%" height={16} radius={4} />
        <Bone width="55%" height={16} radius={4} />
      </BoneStack>

      <View style={sk.exploreMediaWrap}>
        <Bone width="100%" height={220} radius={16} />
      </View>

      <FeedActionRow extra />
    </View>
  );
}

export function ArticleFeedSkeleton() {
  return (
    <View style={sk.exploreCard}>
      <BoneRow style={sk.exploreHeader} gap={10}>
        <BoneCircle size={42} />
        <BoneStack style={{ flex: 1 }} gap={6}>
          <Bone width={110} height={15} radius={4} />
          <Bone width={160} height={12} radius={4} />
        </BoneStack>
        <BoneCircle size={22} />
      </BoneRow>

      <View style={sk.exploreMediaWrap}>
        <Bone width="100%" height={210} radius={16} />
        <View style={sk.readBadge}>
          <Bone width={80} height={24} radius={999} style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} />
        </View>
      </View>

      <BoneStack style={sk.exploreBody} gap={SK.line}>
        <Bone width="90%" height={20} radius={6} />
        <Bone width="60%" height={20} radius={6} />
        <Bone width="95%" height={14} radius={4} style={{ marginTop: 4 }} />
        <Bone width="75%" height={14} radius={4} />
        <BoneRow gap={8} style={{ marginTop: 4 }}>
          <Bone width={65} height={14} radius={4} style={{ backgroundColor: '#FFF0BA' }} />
          <Bone width={58} height={14} radius={4} style={{ backgroundColor: '#FFF0BA' }} />
          <Bone width={62} height={14} radius={4} style={{ backgroundColor: '#FFF0BA' }} />
        </BoneRow>
      </BoneStack>

      <FeedActionRow extra />
    </View>
  );
}

export function ExploreFeedSkeleton({ scope = 'forYou' }: { scope?: 'forYou' | 'following' }) {
  if (scope === 'following') {
    return (
      <BoneStack gap={SK.section} style={{ paddingTop: SK.row }}>
        <PostFeedSkeleton />
        <PostFeedSkeleton />
      </BoneStack>
    );
  }
  return (
    <BoneStack gap={SK.section} style={{ paddingTop: SK.row }}>
      <ArticleFeedSkeleton />
      <PostFeedSkeleton />
    </BoneStack>
  );
}

/** @deprecated — giữ alias nếu còn import cũ */
export function ApiSpinner(_props?: {
  label?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'large';
}) {
  return <FormRowsSkeleton rows={4} />;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────────────────────────────── */
const sk = StyleSheet.create({
  page: {
    paddingHorizontal: SK.pageX,
    paddingTop: SK.pageTop,
    paddingBottom: SK.pageBottom,
  },
  noPad: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', gap: 10 },
  card: {
    backgroundColor: SK.card,
    borderRadius: SK.radius,
    padding: SK.cardPad,
    borderWidth: 1,
    borderColor: SK.border,
  },
  cardLg: {
    borderRadius: SK.radiusLg,
    borderWidth: 0,
    shadowColor: '#5D490F',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: SK.divider, width: '100%' },
  statCell: { flex: 1, alignItems: 'center', gap: 6 },
  avatarBlock: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: SK.row },
  grid2Cell: { width: '48%', flexGrow: 1, minHeight: 104 },
  wrapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  softTile: { flex: 1, backgroundColor: '#FAF6EE', borderRadius: 14, padding: 10, gap: 6 },
  calCell: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },

  exploreCard: {
    backgroundColor: SK.card,
    borderRadius: SK.radiusLg,
    marginHorizontal: 12,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#EDE6D8',
    shadowColor: '#6B4E12',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  exploreHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  exploreMediaWrap: {
    marginHorizontal: 10,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: SK.boneSoft,
  },
  readBadge: { position: 'absolute', right: 10, bottom: 10 },
  exploreBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  exploreActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
});
