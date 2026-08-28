import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: '',
      h1: 'text-4xl font-black tracking-tight',
      h2: 'text-3xl font-extrabold tracking-tight',
      h3: 'text-2xl font-bold',
      h4: 'text-xl font-bold',
      large: 'text-lg font-semibold',
      body: 'text-base',
      small: 'text-sm',
      xs: 'text-xs',
      muted: 'text-sm text-muted-foreground',
      label: 'text-sm font-medium',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {}

export function Text({ variant, className, ...props }: TextProps) {
  return <RNText className={cn(textVariants({ variant }), className)} {...props} />
}
