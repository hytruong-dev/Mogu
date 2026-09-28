import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from '@/components/icons';
import { SparkleField } from '../components/molecules/SparkleField';
import { RegisterForm } from '../components/organisms/RegisterForm';
import { NoanWordmark } from '../components/brand/NoanWordmark';

type Props = {
  onLogin: () => void;
  onRegister: (username: string, password: string) => Promise<void>;
};

export function RegisterScreen({ onLogin, onRegister }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <SparkleField width={width} height={height} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="w-full"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 22,
            paddingTop: 6,
            paddingBottom: 10,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar */}
          <View className="h-[52px] items-center justify-center">
            <Pressable
              onPress={onLogin}
              className="absolute left-0 w-12 h-12 rounded-full bg-card items-center justify-center"
              style={{ elevation: 2 }}
            >
              <ArrowLeft size={27} color="#111" />
            </Pressable>

            <View className="w-[135px] h-12 items-center justify-center">
              <NoanWordmark width={135} height={46} />
            </View>
          </View>

          {/* Title */}
          <Text
            className="mt-2 text-foreground text-[26px] font-black text-center"
            style={{ lineHeight: 32, letterSpacing: -0.6 }}
          >
            Tạo tài khoản NOAN
          </Text>
          <Text
            className="mt-[3px] text-muted-foreground text-sm font-medium text-center"
            style={{ lineHeight: 19 }}
          >
            Bắt đầu hành trình tìm món ngon{`\n`}dành riêng cho bạn.
          </Text>

          {/* Mascot */}
          <View className="self-center w-[150px] h-32 overflow-hidden mt-0">
            <Image
              source={require('../assets/images/noan/noan-mascot-master-v1.png')}
              resizeMode="contain"
              style={{ width: 150, height: 128 }}
            />
          </View>

          <RegisterForm onLogin={onLogin} onRegister={onRegister} compact />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
