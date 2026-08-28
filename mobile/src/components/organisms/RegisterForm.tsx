import { useState } from 'react';
import { Text, View } from 'react-native';
import { LockKeyhole, User } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { AuthInput } from '../atoms/AuthInput';
import { CheckboxRow } from '../atoms/CheckboxRow';
import { PrimaryButton } from '../atoms/PrimaryButton';
import { AuthFooter } from '../molecules/AuthFooter';
import { SocialLogin } from '../molecules/SocialLogin';

type Props = {
  onLogin: () => void;
  onRegister: (username: string, password: string) => Promise<void>;
  compact?: boolean;
  className?: string;
};

export function RegisterForm({ onLogin, onRegister, compact = false, className }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return setError('Vui lòng nhập đầy đủ thông tin.');
    if (username.trim().length < 3) return setError('Tên đăng nhập tối thiểu 3 ký tự.');
    if (!/^[a-zA-Z0-9._]+$/.test(username.trim())) return setError('Tên đăng nhập chỉ gồm chữ, số, dấu chấm và gạch dưới.');
    if (password !== confirm) return setError('Mật khẩu xác nhận chưa trùng khớp.');
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    )
      return setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.');
    setLoading(true);
    setError('');
    try {
      await onRegister(username.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className={cn(
        'w-full rounded-[26px] bg-white',
        compact ? '-mt-[10px] p-[14px]' : '-mt-[6px] p-[15px]',
        className,
      )}
      style={{
        shadowColor: '#D9B94F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 4,
      }}
    >
      <View className="gap-2.5">
        <AuthInput
          icon={User}
          placeholder="Tên đăng nhập (VD: nguyenvana)"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          value={username}
          onChangeText={setUsername}
        />
        <AuthInput
          icon={LockKeyhole}
          placeholder="Mật khẩu"
          secure
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <AuthInput
          icon={LockKeyhole}
          placeholder="Xác nhận mật khẩu"
          secure
          value={confirm}
          onChangeText={setConfirm}
        />
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
      <CheckboxRow className="mt-2.5" />
      <View className="mt-[11px]">
        <PrimaryButton
          label={loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          onPress={submit}
          disabled={loading}
        />
      </View>
      <SocialLogin label="Hoặc đăng ký với" compact />
      <AuthFooter question="Đã có tài khoản?" action="Đăng nhập" onPress={onLogin} compact />
    </View>
  );
}
