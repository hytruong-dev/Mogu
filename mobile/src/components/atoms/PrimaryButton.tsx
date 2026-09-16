import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

type Props = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function PrimaryButton({ label, loading, disabled, onPress }: Props) {
  return (
    <Button
      variant="default"
      disabled={disabled || loading}
      onPress={onPress}
      className="bg-primary h-12 rounded-2xl"
    >
      {loading ? (
        <ActivityIndicator color="#18181B" />
      ) : (
        <Text className="font-bold text-base text-foreground">{label}</Text>
      )}
    </Button>
  );
}
