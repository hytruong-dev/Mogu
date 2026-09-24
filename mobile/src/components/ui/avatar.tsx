import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';

type AvatarProps = Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, 'alt'> & {
  alt?: string;
};

function Avatar({
  className,
  alt = 'Avatar',
  style,
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      alt={alt}
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full aspect-square', className)}
      style={[{ aspectRatio: 1, flexShrink: 0 }, style]}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square size-full', className)}
      style={[{ width: '100%', height: '100%', aspectRatio: 1 }, style]}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted flex size-full flex-row items-center justify-center rounded-full',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
