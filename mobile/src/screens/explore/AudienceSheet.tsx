import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Globe, Lock, Users } from 'lucide-react-native';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Separator } from '../../components/ui/separator';
import type { PostVisibility } from '../../services/api/explore';

const OPTIONS: Array<{
  value: PostVisibility;
  label: string;
  desc: string;
  Icon: typeof Globe;
}> = [
  {
    value: 'PUBLIC',
    label: 'Mọi người',
    desc: 'Bất kỳ ai trên Mogu đều có thể xem bài viết của bạn.',
    Icon: Globe,
  },
  {
    value: 'FOLLOWERS',
    label: 'Người theo dõi',
    desc: 'Chỉ những người theo dõi bạn mới có thể xem bài viết này.',
    Icon: Users,
  },
  {
    value: 'PRIVATE',
    label: 'Chỉ mình tôi',
    desc: 'Chỉ bạn mới có thể xem bài viết này.',
    Icon: Lock,
  },
];

type Props = {
  open: boolean;
  value: PostVisibility;
  onOpenChange: (open: boolean) => void;
  onSelect: (v: PostVisibility) => void;
  /** Khi BE chưa enforce đầy đủ, khóa FOLLOWERS/PRIVATE */
  enforceEnabled?: boolean;
};

export function AudienceSheet({
  open,
  value,
  onOpenChange,
  onSelect,
  enforceEnabled = true,
}: Props) {
  const [local, setLocal] = useState<PostVisibility>(value);

  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapHeight={420}>
      <DrawerHeader className="flex-row items-center justify-between px-4">
        <DrawerClose onPress={() => onOpenChange(false)} />
        <DrawerTitle className="text-base font-extrabold text-[#161616]">
          Ai có thể xem bài viết?
        </DrawerTitle>
        <View className="w-10" />
      </DrawerHeader>
      <DrawerContent className="px-4">
        <RadioGroup value={local} onValueChange={(v) => setLocal(v as PostVisibility)}>
          {OPTIONS.map((opt, i) => {
            const disabled = !enforceEnabled && opt.value !== 'PUBLIC';
            const selected = local === opt.value;
            return (
              <View key={opt.value}>
                {i > 0 ? <Separator className="my-1" /> : null}
                <Pressable
                  disabled={disabled}
                  onPress={() => !disabled && setLocal(opt.value)}
                  className="min-h-14 flex-row items-center gap-3 py-3"
                  style={disabled ? { opacity: 0.45 } : undefined}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF1B3]">
                    <opt.Icon size={20} color="#161616" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-[#161616]">{opt.label}</Text>
                    <Text className="text-[13px] text-[#8A8A8A]">{opt.desc}</Text>
                  </View>
                  <RadioGroupItem value={opt.value} />
                </Pressable>
              </View>
            );
          })}
        </RadioGroup>
      </DrawerContent>
      <DrawerFooter className="px-4 pb-6">
        <Button
          className="h-12 rounded-full bg-[#FFD54F]"
          onPress={() => {
            onSelect(local);
            onOpenChange(false);
          }}
        >
          <Text className="font-extrabold text-[#161616]">Xong</Text>
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
