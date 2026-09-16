import { AlertTriangle, Info, Trash2 } from 'lucide-react-native';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ConfirmDialogTone = 'warning' | 'danger' | 'info';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  /** Dialog quan trọng có thể chặn đóng bằng tap nền hoặc nút back. */
  dismissOnBackdrop?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const toneConfig = {
  warning: {
    Icon: AlertTriangle,
    iconBg: '#FFE8A3',
    iconColor: '#18181B',
    confirmBg: '#FFC72C',
    confirmText: '#18181B',
  },
  danger: {
    Icon: Trash2,
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
    confirmBg: '#DC2626',
    confirmText: '#FFFFFF',
  },
  info: {
    Icon: Info,
    iconBg: '#E0F2FE',
    iconColor: '#0284C7',
    confirmBg: '#FFC72C',
    confirmText: '#18181B',
  },
} as const;

/**
 * Mogu confirmation dialog dùng cho thao tác mất dữ liệu, xoá, hoặc cảnh báo.
 * Chuẩn thiết kế Mogu 100%, hỗ trợ mở an toàn trong mọi Modal/Drawer, khắc phục triệt để lỗi không click được trên Android.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Huỷ',
  tone = 'warning',
  loading = false,
  dismissOnBackdrop = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const config = toneConfig[tone];
  const Icon = config.Icon;

  const requestDismiss = () => {
    if (!loading && dismissOnBackdrop) onCancel();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={requestDismiss}
    >
      <View style={styles.root}>
        <TouchableOpacity
          activeOpacity={1}
          accessibilityLabel="Đóng hộp thoại xác nhận"
          accessibilityRole="button"
          disabled={!dismissOnBackdrop || loading}
          onPress={requestDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal accessibilityRole="alert" style={styles.dialog}>
          <View style={[styles.iconWrap, { backgroundColor: config.iconBg }]}>
            <Icon size={28} color={config.iconColor} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              disabled={loading}
              onPress={onCancel}
              style={[styles.cancelButton, loading && styles.disabled]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={styles.cancelText}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              disabled={loading}
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                { backgroundColor: config.confirmBg },
                loading && styles.disabled,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[styles.confirmText, { color: config.confirmText }]}
              >
                {loading ? 'Đang xử lý…' : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: '#18181B',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#71717A',
    textAlign: 'center',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#18181B',
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
});
