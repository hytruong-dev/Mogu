
type Props = {
  label: string;
  compact?: boolean;
  className?: string;
};

/** OAuth chưa triển khai — ẩn nút giả cho đến khi có POST /auth/oauth/exchange. */
export function SocialLogin(_props: Props) {
  return null;
}
