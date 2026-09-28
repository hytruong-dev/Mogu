import { Text } from 'react-native';

export function Tagline() {
  return (
    <Text
      className="text-foreground text-[17px] font-bold text-center"
      style={{ lineHeight: 24, letterSpacing: -0.3 }}
    >
      Hôm nay ăn gì? NOAN chọn giúp bạn!
    </Text>
  );
}
