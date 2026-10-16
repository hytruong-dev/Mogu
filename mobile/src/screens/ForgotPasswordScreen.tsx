import { useRef, useState, useEffect } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  RotateCcw,
  ShieldCheck,
  User,
} from '@/components/icons';
import { StyledPressable } from '../components/ui/styled-pressable';
import { authApi } from '../services/api/auth';
import {
  A,
  AuthButton,
  AuthCard,
  AuthError,
  AuthField,
  AuthHero,
  AuthLink,
  AuthScaffold,
  PasswordStrength,
} from './auth/AuthUI';

type Props = {
  onBackToLogin: () => void;
  initialIdentifier?: string;
};

export function ForgotPasswordScreen({ onBackToLogin, initialIdentifier = '' }: Props) {
  // Step: 1: Request OTP, 2: Enter OTP, 3: New Password, 4: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [focusedField, setFocusedField] = useState<
    'identifier' | 'otp' | 'newPassword' | 'confirmPassword' | null
  >(null);

  const identifierRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Timer cooldown for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const clearError = () => error && setError('');

  // ── Step 1: Request OTP ──
  const handleRequestOtp = async () => {
    const id = identifier.trim();
    if (!id) return setError('Vui lòng nhập tên đăng nhập hoặc email.');
    setLoading(true);
    setError('');
    Keyboard.dismiss();
    try {
      const res = await authApi.requestPasswordReset(id);
      const maybeDevOtp = (res as any)?.devOtp;
      if (maybeDevOtp) {
        setDevOtp(maybeDevOtp);
      }
      setResendCooldown(60);
      setStep(2);
      setSuccessMsg('Mã OTP xác thực gồm 6 số đã được khởi tạo.');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Validate OTP locally & proceed to Step 3 ──
  const handleVerifyOtp = () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      return setError('Vui lòng nhập đủ 6 chữ số mã OTP.');
    }
    setError('');
    Keyboard.dismiss();
    setStep(3);
  };

  // ── Step 3: Confirm new password ──
  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!newPassword || newPassword.length < 8) {
      return setError('Mật khẩu mới cần tối thiểu 8 ký tự.');
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return setError('Mật khẩu cần gồm chữ hoa, chữ thường và chữ số.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Mật khẩu xác nhận chưa trùng khớp.');
    }

    setLoading(true);
    setError('');
    try {
      await authApi.confirmPasswordReset(otp.trim(), newPassword);
      setStep(4);
    } catch (e: any) {
      setError(
        e instanceof Error
          ? e.message
          : 'Không thể đặt lại mật khẩu. Mã OTP có thể đã hết hạn hoặc không đúng.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      onDismissKeyboard={() => setFocusedField(null)}
      top={
        <View style={styles.topBar}>
          <StyledPressable
            onPress={onBackToLogin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quay lại đăng nhập"
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={A.ink} />
            <Text style={styles.backText}>Đăng nhập</Text>
          </StyledPressable>
        </View>
      }
    >
      {/* ── Step 1: Identifier ── */}
      {step === 1 && (
        <>
          <AuthHero
            size="sm"
            title="Quên mật khẩu?"
            subtitle="Nhập tên đăng nhập hoặc email bạn đã dùng đăng ký để nhận mã xác thực OTP."
          />

          <AuthCard>
            <AuthField
              ref={identifierRef}
              label="Tên đăng nhập hoặc Email"
              icon={User}
              placeholder="VD: nguyenvana hoặc email@vidu.com"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              value={identifier}
              isFocused={focusedField === 'identifier'}
              onFocus={() => setFocusedField('identifier')}
              onBlur={() => {
                if (focusedField === 'identifier') setFocusedField(null);
              }}
              onChangeText={(v) => {
                setIdentifier(v);
                clearError();
              }}
              onSubmitEditing={handleRequestOtp}
            />

            <AuthError message={error} />

            <AuthButton
              label={loading ? 'Đang gửi mã…' : 'Gửi mã xác thực'}
              loading={loading}
              onPress={handleRequestOtp}
            />
          </AuthCard>

          <AuthLink
            question="Nhớ lại mật khẩu?"
            action="Đăng nhập ngay"
            onPress={onBackToLogin}
          />
        </>
      )}

      {/* ── Step 2: Enter OTP ── */}
      {step === 2 && (
        <>
          <AuthHero
            size="sm"
            title="Nhập mã OTP"
            subtitle={`Mã xác thực 6 số có hiệu lực trong 15 phút. Nhập mã để tiếp tục khôi phục tài khoản ${identifier}.`}
          />

          <AuthCard>
            {devOtp && (
              <StyledPressable
                onPress={() => setOtp(devOtp)}
                style={styles.devBanner}
              >
                <Text style={styles.devBannerText}>
                  💡 [Môi trường thử nghiệm] Mã OTP của bạn là: <Text style={styles.devCode}>{devOtp}</Text> (Chạm để tự điền)
                </Text>
              </StyledPressable>
            )}

            <AuthField
              ref={otpRef}
              label="Mã OTP 6 chữ số"
              icon={KeyRound}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              value={otp}
              isFocused={focusedField === 'otp'}
              onFocus={() => setFocusedField('otp')}
              onBlur={() => {
                if (focusedField === 'otp') setFocusedField(null);
              }}
              onChangeText={(v) => {
                setOtp(v.replace(/\D/g, ''));
                clearError();
              }}
              onSubmitEditing={handleVerifyOtp}
            />

            {/* Resend OTP button */}
            <View style={styles.resendRow}>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Gửi lại mã sau {resendCooldown}s
                </Text>
              ) : (
                <StyledPressable
                  onPress={handleRequestOtp}
                  disabled={loading}
                  style={styles.resendBtn}
                >
                  <RotateCcw size={13} color={A.link} />
                  <Text style={styles.resendText}>Gửi lại mã OTP</Text>
                </StyledPressable>
              )}
            </View>

            <AuthError message={error} />

            <AuthButton
              label="Tiếp tục"
              loading={loading}
              onPress={handleVerifyOtp}
            />
          </AuthCard>

          <AuthLink
            question="Nhập sai tài khoản?"
            action="Chọn tài khoản khác"
            onPress={() => {
              setStep(1);
              setError('');
            }}
          />
        </>
      )}

      {/* ── Step 3: Enter New Password ── */}
      {step === 3 && (
        <>
          <AuthHero
            size="sm"
            title="Tạo mật khẩu mới"
            subtitle="Mật khẩu mới cần tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và số."
          />

          <AuthCard>
            <AuthField
              ref={newPasswordRef}
              label="Mật khẩu mới"
              icon={LockKeyhole}
              placeholder="Nhập mật khẩu mới"
              secure
              autoComplete="new-password"
              returnKeyType="next"
              value={newPassword}
              isFocused={focusedField === 'newPassword'}
              onFocus={() => setFocusedField('newPassword')}
              onBlur={() => {
                if (focusedField === 'newPassword') setFocusedField(null);
              }}
              onChangeText={(v) => {
                setNewPassword(v);
                clearError();
              }}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              hint={<PasswordStrength password={newPassword} />}
            />

            <AuthField
              ref={confirmPasswordRef}
              label="Xác nhận mật khẩu mới"
              icon={ShieldCheck}
              placeholder="Nhập lại mật khẩu mới"
              secure
              autoComplete="new-password"
              returnKeyType="done"
              value={confirmPassword}
              isFocused={focusedField === 'confirmPassword'}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => {
                if (focusedField === 'confirmPassword') setFocusedField(null);
              }}
              onChangeText={(v) => {
                setConfirmPassword(v);
                clearError();
              }}
              onSubmitEditing={handleResetPassword}
            />

            <AuthError message={error} />

            <AuthButton
              label={loading ? 'Đang cập nhật…' : 'Đổi mật khẩu & Hoàn tất'}
              loading={loading}
              onPress={handleResetPassword}
            />
          </AuthCard>
        </>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && (
        <>
          <AuthHero
            size="sm"
            title="Thành công!"
            subtitle="Mật khẩu của bạn đã được đặt lại an toàn."
          />

          <AuthCard>
            <View style={styles.successBox}>
              <CheckCircle2 size={48} color="#16a34a" />
              <Text style={styles.successTitle}>Đổi mật khẩu thành công</Text>
              <Text style={styles.successDesc}>
                Các phiên đăng nhập cũ đã được đăng xuất an toàn. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
              </Text>
            </View>

            <AuthButton
              label="Đăng nhập ngay"
              onPress={onBackToLogin}
            />
          </AuthCard>
        </>
      )}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  backText: {
    color: A.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  devBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  devBannerText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  devCode: {
    fontWeight: '800',
    color: '#b45309',
    textDecorationLine: 'underline',
  },
  resendRow: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 6,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  resendText: {
    color: A.link,
    fontSize: 13,
    fontWeight: '700',
  },
  cooldownText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: A.ink,
    marginTop: 4,
  },
  successDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
