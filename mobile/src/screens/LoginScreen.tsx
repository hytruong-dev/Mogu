import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SparkleField } from '../components/molecules/SparkleField';
import { LoginHeader } from '../components/organisms/LoginHeader';
import { LoginForm } from '../components/organisms/LoginForm';
import { SocialLogin } from '../components/molecules/SocialLogin';
import { AuthFooter } from '../components/molecules/AuthFooter';

export function LoginScreen({
  onRegister,
  onLogin,
}: {
  onRegister: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const { width, height } = useWindowDimensions();

  return (
    <SafeAreaView className="flex-1 bg-mogu-cream" edges={['top', 'left', 'right']}>
      <SparkleField opacity={undefined} width={width} height={height} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="w-full"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 22,
            paddingTop: 34,
            paddingBottom: 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1">
            <LoginHeader compact />
            <LoginForm compact onLogin={onLogin} />
            <SocialLogin label="Hoặc tiếp tục với" compact />
            <AuthFooter
              question="Chưa có tài khoản?"
              action="Đăng ký"
              onPress={onRegister}
              compact
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
