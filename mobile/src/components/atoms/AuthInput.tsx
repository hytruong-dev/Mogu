import * as React from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { type TextInputProps } from 'react-native';
import { Input } from '../ui/input';

type Props = TextInputProps & {
  icon?: ComponentType<LucideProps>;
  secure?: boolean;
  error?: string;
  label?: string;
};

export function AuthInput({ icon, secure, error, label, ...props }: Props) {
  return (
    <Input
      icon={icon}
      secure={secure}
      error={error}
      label={label}
      containerClassName="mb-3"
      {...props}
    />
  );
}
