import * as React from 'react';
import { Button } from '../ui/button';

type Props = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function PrimaryButton({ label, loading, disabled, onPress }: Props) {
  return <Button label={label} variant="default" loading={loading} disabled={disabled} onPress={onPress} />;
}
