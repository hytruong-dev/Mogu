import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Expo components are not React Native host components, so NativeWind cannot
// reliably map `className` to `style` unless the mapping is registered once.
// Keep this bootstrap imported before any screen is rendered.
cssInterop(LinearGradient, { className: 'style' });
cssInterop(BlurView, { className: 'style' });
cssInterop(SafeAreaView, { className: 'style' });
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Image, { className: 'style' });
