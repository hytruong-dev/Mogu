import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput } from 'react-native';
import { LockKeyhole, User } from '@/components/icons';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { StyledPressable } from '../components/ui/styled-pressable';
import {
  A,
  AuthButton,
  AuthCard,
  AuthError,
  AuthField,
  AuthHero,
  AuthLink,
  AuthScaffold,
} from './auth/AuthUI';

export function LoginScreen({
  onRegister,
  onLogin,
}: {
  onRegister: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (loading) return;
    setFocusedField(null);
    Keyboard.dismiss();
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
    <AuthScaffold onDismissKeyboard={() => setFocusedField(null)}>
      <AuthHero
        title="Chào mừng trở lại!"
        subtitle="Đăng nhập để NOAN tiếp tục chọn món hợp gu cho bạn."
      />

      <AuthCard>
        <AuthField
          ref={usernameRef}
          label="Tên đăng nhập"
          icon={User}
          placeholder="VD: nguyenvana"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          value={username}
          isFocused={focusedField === 'username'}
          onFocus={() => setFocusedField('username')}
          onBlur={() => {
            if (focusedField === 'username') setFocusedField(null);
          }}
          onChangeText={(v) => {
            setUsername(v);
            if (error) setError('');
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          label="Mật khẩu"
          icon={LockKeyhole}
          placeholder="Nhập mật khẩu"
          secure
          autoComplete="current-password"
          returnKeyType="go"
          value={password}
          isFocused={focusedField === 'password'}
          onFocus={() => setFocusedField('password')}
          onBlur={() => {
            if (focusedField === 'password') setFocusedField(null);
          }}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError('');
          }}
          onSubmitEditing={submit}
        />

        <StyledPressable onPress={() => setForgotVisible(true)} hitSlop={8} style={styles.forgot}>
          <Text style={styles.forgotText}>Quên mật khẩu?</Text>
        </StyledPressable>

        <AuthError message={error} />

        <AuthButton
          label={loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          loading={loading}
          onPress={submit}
        />
      </AuthCard>

      <AuthLink question="Chưa có tài khoản?" action="Đăng ký ngay" onPress={onRegister} />

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
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { color: A.link, fontSize: 13.5, fontWeight: '800' },
});
