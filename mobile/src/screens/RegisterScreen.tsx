import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, LockKeyhole, ShieldCheck, User } from '@/components/icons';
import { StyledPressable } from '../components/ui/styled-pressable';
import {
  A,
  AuthButton,
  AuthCard,
  AuthCheckbox,
  AuthError,
  AuthField,
  AuthHero,
  AuthLink,
  AuthScaffold,
  PasswordStrength,
} from './auth/AuthUI';

type Props = {
  onLogin: () => void;
  onRegister: (username: string, password: string) => Promise<void>;
};

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;

export function RegisterScreen({ onLogin, onRegister }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | 'confirm' | null>(null);

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const u = username.trim();
  const usernameError =
    u.length > 0 && !USERNAME_RE.test(u)
      ? 'Chỉ dùng chữ, số, dấu chấm và gạch dưới.'
      : u.length > 0 && u.length < 3
        ? 'Tối thiểu 3 ký tự.'
        : null;
  const confirmError = confirm.length > 0 && confirm !== password ? 'Mật khẩu xác nhận chưa khớp.' : null;

  const submit = async () => {
    if (loading) return;
    setFocusedField(null);
    Keyboard.dismiss();
    if (!u || !password) return setError('Vui lòng nhập đầy đủ thông tin.');
    if (u.length < 3) return setError('Tên đăng nhập tối thiểu 3 ký tự.');
    if (!USERNAME_RE.test(u)) return setError('Tên đăng nhập chỉ gồm chữ, số, dấu chấm và gạch dưới.');
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
      return setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.');
    if (password !== confirm) return setError('Mật khẩu xác nhận chưa trùng khớp.');
    if (!accepted) return setError('Vui lòng đồng ý Điều khoản và Chính sách bảo mật.');
    setLoading(true);
    setError('');
    try {
      await onRegister(u.toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => error && setError('');

  return (
    <AuthScaffold
      onDismissKeyboard={() => setFocusedField(null)}
      top={
        <View style={styles.topBar}>
          <StyledPressable
            onPress={onLogin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quay lại đăng nhập"
            style={({ pressed }) => [styles.back, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <ArrowLeft size={20} color={A.ink} strokeWidth={2.4} />
          </StyledPressable>
          <View style={styles.stepPill}>
            <Text style={styles.stepText}>Tài khoản mới</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      }
    >
      <AuthHero
        size="sm"
        title="Tạo tài khoản NOAN"
        subtitle="Chỉ mất 30 giây để bắt đầu hành trình tìm món ngon dành riêng cho bạn."
      />

      <AuthCard>
        <AuthField
          ref={usernameRef}
          label="Tên đăng nhập"
          icon={User}
          placeholder="VD: nguyenvana"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
          value={username}
          isFocused={focusedField === 'username'}
          onFocus={() => setFocusedField('username')}
          onBlur={() => {
            if (focusedField === 'username') setFocusedField(null);
          }}
          error={usernameError}
          onChangeText={(v) => {
            setUsername(v);
            clear();
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          label="Mật khẩu"
          icon={LockKeyhole}
          placeholder="Tạo mật khẩu"
          secure
          autoComplete="new-password"
          returnKeyType="next"
          value={password}
          isFocused={focusedField === 'password'}
          onFocus={() => setFocusedField('password')}
          onBlur={() => {
            if (focusedField === 'password') setFocusedField(null);
          }}
          onChangeText={(v) => {
            setPassword(v);
            clear();
          }}
          onSubmitEditing={() => confirmRef.current?.focus()}
          hint={<PasswordStrength password={password} />}
        />
        <AuthField
          ref={confirmRef}
          label="Xác nhận mật khẩu"
          icon={ShieldCheck}
          placeholder="Nhập lại mật khẩu"
          secure
          autoComplete="new-password"
          returnKeyType="done"
          value={confirm}
          isFocused={focusedField === 'confirm'}
          onFocus={() => setFocusedField('confirm')}
          onBlur={() => {
            if (focusedField === 'confirm') setFocusedField(null);
          }}
          error={confirmError}
          onChangeText={(v) => {
            setConfirm(v);
            clear();
          }}
          onSubmitEditing={submit}
        />

        <AuthCheckbox
          checked={accepted}
          onChange={(v) => {
            setAccepted(v);
            clear();
          }}
        >
          Tôi đồng ý với <Text style={styles.term}>Điều khoản sử dụng</Text> và{' '}
          <Text style={styles.term}>Chính sách bảo mật</Text> của NOAN.
        </AuthCheckbox>

        <AuthError message={error} />

        <AuthButton
          label={loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
          loading={loading}
          onPress={submit}
        />
      </AuthCard>

      <AuthLink question="Đã có tài khoản?" action="Đăng nhập" onPress={onLogin} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B88A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  stepPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  stepText: { color: A.sub, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  term: { color: A.link, fontWeight: '800' },
});
