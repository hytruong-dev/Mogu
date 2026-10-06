import { createElement, useState, type ComponentProps } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

/**
 * Pressable that resolves `style={({ pressed }) => ...}` in JS before handing it to native.
 *
 * NativeWind's Babel plugin rewrites createElement → createInteropElement, which flattens
 * function styles away in release builds (the element renders completely unstyled).
 * Always use this component when the style depends on `pressed`.
 */
export function StyledPressable(props: ComponentProps<typeof Pressable>) {
  const [pressed, setPressed] = useState(false);
  const nativeProps = {
    ...props,
    cssInterop: false,
    style: typeof props.style === 'function' ? props.style({ pressed }) : props.style,
    children:
      typeof props.children === 'function'
        ? props.children({ pressed })
        : props.children,
    onPressIn: (event: GestureResponderEvent) => {
      setPressed(true);
      props.onPressIn?.(event);
    },
    onPressOut: (event: GestureResponderEvent) => {
      setPressed(false);
      props.onPressOut?.(event);
    },
  };
  return createElement(Pressable, nativeProps);
}
