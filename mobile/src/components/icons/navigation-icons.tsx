import type { LucideIcon, LucideProps } from 'lucide-react-native';
import * as React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { moguBrand } from '@/theme/brand';

type IconProps = LucideProps;

function activeAccent(fill: IconProps['fill']) {
  return fill && fill !== 'none' && fill !== 'transparent'
    ? String(fill)
    : 'transparent';
}

function iconBase(
  render: (props: IconProps) => React.ReactNode,
  name: string,
) {
  const Component = (props: IconProps) => render(props);
  Component.displayName = name;
  return Component as unknown as LucideIcon;
}

function scaledStroke(value: IconProps['strokeWidth'], factor: number) {
  return (typeof value === 'number' ? value : moguBrand.icon.strokeWidth) * factor;
}

export const MoguHomeIcon = iconBase(({ size = 24, color = moguBrand.color.ink, fill, strokeWidth = 2.15, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="M3.5 10.4 12 3.8l8.5 6.6v8.1a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" fill={activeAccent(fill)} />
    <Path d="M8.4 15.2c1.1.8 2.3 1.2 3.6 1.2s2.5-.4 3.6-1.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
), 'MoguHomeIcon');

export const MoguExploreIcon = iconBase(({ size = 24, color = moguBrand.color.ink, fill, strokeWidth = 2.15, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} fill={activeAccent(fill)} />
    <Path d="m14.9 8.2-1.7 5-4.1 2.6 1.7-5Z" fill={fill && fill !== 'transparent' ? moguBrand.color.cream : moguBrand.color.yellow} stroke={color} strokeWidth={scaledStroke(strokeWidth, 0.82)} strokeLinejoin="round" />
  </Svg>
), 'MoguExploreIcon');

export const MoguRandomIcon = iconBase(({ size = 24, color = moguBrand.color.ink, strokeWidth = 2.15, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="m12 3 1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7Z" fill={moguBrand.color.cream} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" fill={moguBrand.color.yellow} stroke={color} strokeWidth={scaledStroke(strokeWidth, 0.72)} strokeLinejoin="round" />
    <Path d="M4 16.5c1.1-1.4 2.3-2.1 3.8-2.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
), 'MoguRandomIcon');

export const MoguHealthIcon = iconBase(({ size = 24, color = moguBrand.color.ink, fill, strokeWidth = 2.15, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="M20.3 5.8c-2.2-2.3-5.8-1.9-8.3.8-2.5-2.7-6.1-3.1-8.3-.8-2.3 2.4-1.7 6.1.3 8.4 2.1 2.4 5.1 4.5 8 6 2.9-1.5 5.9-3.6 8-6 2-2.3 2.6-6 .3-8.4Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" fill={activeAccent(fill)} />
    <Path d="m6.8 12 2.2.1 1.5-3 2.2 5.8 1.5-2.9h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
), 'MoguHealthIcon');

export const MoguProfileIcon = iconBase(({ size = 24, color = moguBrand.color.ink, fill, strokeWidth = 2.15, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="M8.3 8.4 12 5.2l3.7 3.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={activeAccent(fill)} />
    <Circle cx="12" cy="10.2" r="3.2" stroke={color} strokeWidth={strokeWidth} fill={activeAccent(fill)} />
    <Path d="M5.5 20c.6-3.5 3-5.4 6.5-5.4s5.9 1.9 6.5 5.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
), 'MoguProfileIcon');
