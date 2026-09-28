import Svg, { Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  accessibilityLabel?: string;
};

/**
 * Custom Mogu wordmark. The rounded golden glyphs echo the mascot's soft body,
 * while the cocoa outline keeps the mark readable on cream, white, and imagery.
 */
export function MoguWordmark({
  width = 148,
  height = 52,
  accessibilityLabel = 'Mogu',
}: Props) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 238 82"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Path
        d="M8 58V19C8 11 13 6 21 6c6 0 10 3 13 9l7 13 7-13c3-6 8-9 14-9 8 0 13 5 13 13v39H58V29l-9 17c-2 5-5 7-9 7s-7-2-9-7l-8-17v29H8Z"
        fill="#FFC928"
        stroke="#2A1D12"
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <Path
        d="M102 16c-15 0-25 10-25 23s10 23 25 23 25-10 25-23-10-23-25-23Zm0 15c6 0 10 3 10 8s-4 8-10 8-10-3-10-8 4-8 10-8Z"
        fill="#FFC928"
        fillRule="evenodd"
        stroke="#2A1D12"
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <Path
        d="M151 16c-14 0-23 10-23 23s9 22 22 22c5 0 9-2 12-5v2c0 7-4 10-11 10-6 0-10-2-14-6l-9 10c6 6 14 9 24 9 16 0 27-9 27-24V19h-16v4c-3-5-7-7-12-7Zm1 15c6 0 10 3 10 8s-4 8-10 8-10-3-10-8 4-8 10-8Z"
        fill="#FFC928"
        fillRule="evenodd"
        stroke="#2A1D12"
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <Path
        d="M181 18v24c0 13 8 21 20 21 6 0 11-2 15-6v4h15V18h-17v23c0 6-3 9-8 9s-8-3-8-9V18Z"
        fill="#FFC928"
        stroke="#2A1D12"
        strokeWidth={4.5}
        strokeLinejoin="round"
      />

      {/* Soft mascot-like highlights; kept large enough to survive small sizes. */}
      <Path d="M16 18c2-4 5-6 9-5" fill="none" stroke="#FFF8E8" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M88 29c3-5 7-7 12-7" fill="none" stroke="#FFF8E8" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M139 29c3-5 7-7 12-7" fill="none" stroke="#FFF8E8" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M190 24v13" fill="none" stroke="#FFF8E8" strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}
