import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/** Skeleton block — wraps react-native-reusables Skeleton. */
export function Bone({ width = '100%', height = 14, radius = 8, style, className }: BoneProps) {
  return (
    <Skeleton
      className={cn('bg-[#E8DFC8]', className)}
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}

export function BoneCircle({ size = 36, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <Bone width={size} height={size} radius={size / 2} style={style} />;
}

export function BoneRow({
  children,
  gap = 10,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Boot / splash auth check */
export function BootSkeleton() {
  return (
    <View style={[sk.pad, { paddingTop: 80 }]}>
      <Bone width={120} height={36} radius={10} />
      <Bone width="70%" height={22} radius={8} style={{ marginTop: 16 }} />
      <Bone width="100%" height={160} radius={18} style={{ marginTop: 16 }} />
      <Bone width="100%" height={100} radius={18} style={{ marginTop: 12 }} />
      <Bone width="100%" height={100} radius={18} style={{ marginTop: 12 }} />
    </View>
  );
}

/** Profile main dashboard */
export function ProfileMainSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View style={sk.card}>
        <BoneRow gap={14}>
          <BoneCircle size={96} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="70%" height={22} />
            <Bone width="45%" height={14} />
            <Bone width={120} height={32} radius={12} style={{ marginTop: 4 }} />
          </View>
        </BoneRow>
        <BoneRow style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E8E4DC' }} gap={0}>
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Bone width={36} height={18} />
            <Bone width={56} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Bone width={36} height={18} />
            <Bone width={64} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Bone width={36} height={18} />
            <Bone width={72} height={12} />
          </View>
        </BoneRow>
      </View>
      <View style={sk.card}>
        <Bone width={160} height={18} />
        <BoneRow style={{ marginTop: 16 }} gap={0}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Bone width={40} height={18} />
              <Bone width={64} height={12} />
            </View>
          ))}
        </BoneRow>
        <BoneRow style={{ marginTop: 16, justifyContent: 'space-between' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <BoneCircle key={i} size={28} />
          ))}
        </BoneRow>
      </View>
      <BoneRow gap={12} style={{ flexWrap: 'wrap' }}>
        <Bone width="47%" height={88} radius={16} />
        <Bone width="47%" height={88} radius={16} />
        <Bone width="47%" height={88} radius={16} />
        <Bone width="47%" height={88} radius={16} />
      </BoneRow>
    </View>
  );
}

export function ProfileEditSkeleton() {
  return (
    <View style={{ gap: 14, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <BoneCircle size={112} />
        <Bone width={72} height={14} style={{ marginTop: 12 }} />
      </View>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[sk.card, sk.fieldRow]}>
          <Bone width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="35%" height={11} />
            <Bone width="55%" height={16} />
          </View>
          <Bone width={18} height={18} radius={4} />
        </View>
      ))}
      <Bone width="100%" height={52} radius={16} style={{ marginTop: 8 }} />
    </View>
  );
}

export function FormRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[sk.card, sk.fieldRow]}>
          <Bone width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="40%" height={12} />
            <Bone width="65%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function JourneySkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <BoneRow gap={0}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Bone width={40} height={20} />
            <Bone width={72} height={12} />
          </View>
        ))}
      </BoneRow>
      <View style={sk.card}>
        <Bone width={120} height={16} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <BoneCircle key={i} size={28} />
          ))}
        </View>
      </View>
      <View style={sk.card}>
        <Bone width="50%" height={14} style={{ marginBottom: 12 }} />
        <Bone width="100%" height={12} style={{ marginBottom: 8 }} />
        <Bone width="80%" height={12} />
      </View>
    </View>
  );
}

export function EditPlanSkeleton() {
  return (
    <View style={sk.pad}>
      <BoneRow style={sk.stats} gap={12}>
        <Bone width={72} height={12} />
        <Bone width={88} height={12} />
        <Bone width={96} height={12} />
      </BoneRow>
      <View style={sk.card}>
        <Bone width={140} height={13} />
        <BoneRow style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <BoneCircle size={44} />
          <Bone width={160} height={28} radius={10} />
          <BoneCircle size={44} />
        </BoneRow>
        <Bone width="85%" height={11} style={{ marginTop: 16 }} />
      </View>
      <View style={sk.card}>
        <Bone width={150} height={13} />
        <BoneRow style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <BoneCircle size={44} />
          <Bone width={140} height={28} radius={10} />
          <BoneCircle size={44} />
        </BoneRow>
        <Bone width="100%" height={40} radius={12} style={{ marginTop: 16 }} />
      </View>
      <View style={sk.card}>
        <Bone width={80} height={13} />
        <BoneRow style={{ marginTop: 14 }} gap={10}>
          <Bone width="48%" height={48} radius={12} />
          <Bone width="48%" height={48} radius={12} />
        </BoneRow>
        <BoneRow style={{ marginTop: 14, flexWrap: 'wrap' }} gap={8}>
          <Bone width={72} height={36} radius={18} />
          <Bone width={72} height={36} radius={18} />
          <Bone width={72} height={36} radius={18} />
          <Bone width={88} height={36} radius={18} />
        </BoneRow>
      </View>
      <Bone width="100%" height={52} radius={14} style={{ marginTop: 8 }} />
      <Bone width="100%" height={52} radius={14} style={{ marginTop: 10 }} />
      <Bone width={64} height={14} style={{ marginTop: 16, alignSelf: 'center' }} />
    </View>
  );
}

export function WeeklyPlanSkeleton() {
  return (
    <View style={sk.pad}>
      <BoneRow style={{ marginBottom: 16 }} gap={8}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Bone key={i} width={40} height={56} radius={12} />
        ))}
      </BoneRow>
      <Bone width={180} height={18} style={{ marginBottom: 14 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[sk.card, sk.mealCard]}>
          <Bone width={88} height={88} radius={12} />
          <View style={{ flex: 1, gap: 8, paddingVertical: 4 }}>
            <Bone width={72} height={12} />
            <Bone width="70%" height={16} />
            <Bone width="45%" height={12} />
            <Bone width={56} height={12} />
          </View>
          <View style={{ gap: 10, alignItems: 'center' }}>
            <BoneCircle size={28} />
            <BoneCircle size={28} />
          </View>
        </View>
      ))}
      <View style={[sk.card, { marginTop: 4 }]}>
        <BoneRow gap={12}>
          <BoneCircle size={40} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="60%" height={14} />
            <Bone width="40%" height={12} />
          </View>
        </BoneRow>
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={sk.pad}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[sk.card, sk.listRow]}>
          <BoneCircle size={44} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="75%" height={14} />
            <Bone width="50%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DetailSkeleton() {
  return (
    <View>
      <Bone width="100%" height={240} radius={0} />
      <View style={sk.pad}>
        <Bone width="70%" height={24} style={{ marginBottom: 12 }} />
        <Bone width="100%" height={12} style={{ marginBottom: 8 }} />
        <Bone width="90%" height={12} style={{ marginBottom: 8 }} />
        <Bone width="60%" height={12} style={{ marginBottom: 20 }} />
        <BoneRow gap={10} style={{ marginBottom: 20 }}>
          <Bone width={72} height={56} radius={12} />
          <Bone width={72} height={56} radius={12} />
          <Bone width={72} height={56} radius={12} />
          <Bone width={72} height={56} radius={12} />
        </BoneRow>
        <Bone width="100%" height={120} radius={14} />
      </View>
    </View>
  );
}

export function HealthSkeleton() {
  return (
    <View style={sk.pad}>
      <Bone width={160} height={22} style={{ marginBottom: 16 }} />
      <View style={[sk.card, { height: 120, marginBottom: 12 }]} />
      <BoneRow gap={10} style={{ marginBottom: 12 }}>
        <Bone width="48%" height={96} radius={16} />
        <Bone width="48%" height={96} radius={16} />
      </BoneRow>
      <View style={[sk.card, { height: 160 }]} />
    </View>
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

const sk = {
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 } as ViewStyle,
  stats: { justifyContent: 'center', marginBottom: 12, minHeight: 28 } as ViewStyle,
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#EDE5D2',
  } as ViewStyle,
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  } as ViewStyle,
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginBottom: 12,
  } as ViewStyle,
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    marginBottom: 10,
  } as ViewStyle,
};
