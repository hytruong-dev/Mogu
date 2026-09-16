# Mogu Cooking — Lottie Asset Specification

## Deliverable

- Source: `mobile/src/assets/images/mascot/mogu-cooking-layered-animated.svg`
- Canvas: 512 × 512, transparent
- Loop: 2.4 seconds
- Intended frame rate after import: 30 FPS (72 frames)
- Intended marker after export: `cooking_loop`, frames 0–71

## Layer map

- `ground-shadow`: squash synced to the character bounce
- `mogu-character`: global body bounce
- `body`: base mascot body
- `chef-hat`: delayed secondary bounce
- `left-eye`, `right-eye`: synchronized blink
- `left-cheek`, `right-cheek`, `mouth`: separate face elements
- `back-arm`, `spoon-arm`, `wooden-spoon`: stirring action
- `pan-arm`, `frying-pan`: pan toss action
- `apron`, `left-foot`, `right-foot`: costume and secondary motion
- `tomato`, `herbs`, `carrot-slice`: independent motion paths and rotations
- `noodles`: pan contents
- `steam-01`, `steam-02`: alternating rise and fade
- `motion-sparks`: cooking energy accent

## Import into Lottie Creator

1. Open **Upload assets** and select the SVG.
2. Insert it using **Vector** mode, not Rasterized mode.
3. Confirm that the SMIL animations were converted into native keyframes.
4. Set the scene to 512 × 512, 30 FPS, 2.4 seconds.
5. Add the `cooking_loop` segment from frame 0 through frame 71.
6. Preview with loop enabled and verify that frame 71 transitions into frame 0 without a jump.
7. Export an Optimized Lottie JSON for the existing React Native player, or dotLottie when the mobile runtime supports it.

## Runtime behavior

- Start playback when the random-meal API request begins.
- Keep looping while the request is pending.
- Do not use a fake fixed delay. Complete the current loop or cross-fade out when the API resolves.
- Respect reduced-motion settings: replace continuous animation with a static frame or very slow opacity pulse.
- Keep the rendered mascot between 180 and 260 dp on normal phones.

## QA checklist

- No raster images embedded in the exported animation.
- Transparent background remains transparent.
- Exactly two arms are visible and remain attached during motion.
- Pan handle stays visually inside the right hand.
- Spoon remains visually inside the left hand.
- Ingredients land inside the pan at the loop boundary.
- No path is clipped outside the 512 × 512 scene.
- Android and iOS render the same colors and strokes.
