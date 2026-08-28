import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — merge Tailwind classes safely (shadcn/ui pattern)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
