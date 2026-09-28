# NOAN food reel asset kit

These PNG layers are intended to be stacked for the animated food-selection modal.

## Layer order (back to front)

1. `machine-shadow.png`
2. Three clipped food reel tracks (`dish-pho-v1.png`, `dish-com-tam-v1.png`, `dish-banh-cuon-v1.png`, and other dish images)
3. `reel-glass-overlay.png`, repeated once per window
4. `machine-body.png` with transparent window holes
5. `lights-off.png` or `lights-on.png`
6. `machine-handle.png`
7. `noan-thinking.png` and `question-bubble.png`

## Animation anchors

- Rotate `machine-handle.png` around the center of its lower circular pivot.
- Pull the handle downward about 40 px or tap it to start the request and reel motion.
- Cross-fade `lights-off.png` and `lights-on.png`; do not resize between states.
- Clip each food track inside one of the three transparent windows in `machine-body.png`.
- Repeat `reel-glass-overlay.png` above each food track with `pointerEvents="none"`.
- Keep UI copy, progress indicators, and the NOAN nameplate as native text/components rather than baked into PNG files.

The three `-v1` dish photos were generated with built-in ImageGen using the approved NOAN mockup as a style reference. Earlier dish PNGs are conversions of existing project photographs.

Short local UI sounds live in `src/assets/audio/food-reel/`. Rebuild them with `node scripts/generate-food-reel-sounds.mjs`. The app plays pull, spin, stop and success cues through `expo-audio`.
