import { Image, StyleSheet, Text, View } from 'react-native';

export function LoginHeader({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.mascotCrop, compact && styles.mascotCropCompact]}>
        <Image
          source={require('../../assets/images/mascots/mogu-login.png')}
          resizeMode="contain"
          style={[styles.mascot, compact && styles.mascotCompact]}
        />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>Chào mừng trở lại!</Text>
      <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
        Đăng nhập để Mogu tiếp tục chọn món{`\n`}hợp gu cho bạn.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  containerCompact: {},
  mascotCrop: { width: 130, height: 142, overflow: 'hidden' },
  mascotCropCompact: { width: 124, height: 136 },
  mascot: { width: 130, height: 142 },
  mascotCompact: { width: 124, height: 136 },
  title: {
    marginTop: 4,
    color: '#111111',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  titleCompact: { marginTop: 2, fontSize: 28, lineHeight: 34 },
  subtitle: {
    marginTop: 7,
    color: '#555555',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitleCompact: { marginTop: 4, fontSize: 14, lineHeight: 20 },
});
