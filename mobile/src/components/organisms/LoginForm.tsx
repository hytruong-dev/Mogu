import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Info, LockKeyhole, User } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { AuthInput } from '../atoms/AuthInput';
import { PrimaryButton } from '../atoms/PrimaryButton';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Text } from '../ui/text';

type Props = {
  onLogin: (username: string, password: string) => Promise<void>;
  compact?: boolean;
  className?: string;
};

export function LoginForm({ onLogin, compact = false, className }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
    setLoading(true);
    setError('');
    try {
      await onLogin(username.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className={cn(
        'w-full rounded-[25px] bg-white',
        compact ? 'mt-[15px] p-[13px]' : 'mt-[18px] p-[14px]',
        className,
      )}
      style={{
        shadowColor: '#D9B94F',
        shadowOffset: { width: 0, height: 9 },
        shadowOpacity: 0.13,
        shadowRadius: 22,
        elevation: 4,
      }}
    >
      <View className="gap-2.5">
        <AuthInput
          icon={User}
          placeholder="Tên đăng nhập"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <AuthInput
          icon={LockKeyhole}
          placeholder="Mật khẩu"
          secure
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      {error ? <Text className="mt-1 text-xs text-destructive">{error}</Text> : null}
      <Pressable
        className={cn('self-end', compact ? 'mt-2' : 'mt-2.5')}
        onPress={() => setForgotVisible(true)}
      >
        <Text className="text-sm font-semibold text-foreground underline">Quên mật khẩu?</Text>
      </Pressable>
      <View className="mt-3">
        <PrimaryButton
          label={loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          onPress={submit}
          disabled={loading}
        />
      </View>

      <ConfirmDialog
        visible={forgotVisible}
        tone="info"
        title="Quên mật khẩu?"
        description="Vui lòng liên hệ bộ phận hỗ trợ để được reset mật khẩu. Tính năng tự phục vụ đang được phát triển."
        confirmLabel="Đã hiểu"
        cancelLabel="Đóng"
        onCancel={() => setForgotVisible(false)}
        onConfirm={() => setForgotVisible(false)}
      />
    </View>
  );
}
