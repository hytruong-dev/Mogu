# NOAN — Brand direction 2026

## Brand idea

**NOAN** is the compact name of **Nghé Ơi, Ăn Ngon**. The name is always written in uppercase in the primary wordmark. The spoken name is “Nô-an”.

## Character model

- Vietnamese golden water-buffalo calf; friendly, curious and useful rather than childish.
- Ivory `nón lá`, short dark-brown horns, wide horizontal ears and a warm taupe muzzle.
- Charcoal cooking apron with a single ivory bowl-shaped pocket.
- Core palette: golden yellow `#FFC928`, deep brown `#2A1A10`, ivory `#FFF7E8`, coral `#FF725E`.
- Do not add sunglasses, headphones, a hoodie or the former rice-grain silhouette.
- Every pose must preserve horn, ear, muzzle, hat, apron and body proportions from the master asset.

## Logo system

- Primary lockup: buffalo head/mark above or left of the uppercase `NOAN` wordmark.
- App icon: close-up face only; no wordmark, because the icon must remain readable at 48 px.
- The proprietary wordmark always keeps four readable letters: `N-O-A-N`.
- First `N`: two subtly split hoof terminals.
- `O`: a front-facing food bowl in the counter with one ivory steam/leaf shape.
- `A`: a broad nón-lá-inspired silhouette with a three-leaf coral accent.
- Final `N`: one small upward buffalo-tail terminal.
- These pictorial details belong only to the primary/display wordmark. At very small text sizes, use plain uppercase `NOAN` for accessibility.
- Clear space: at least one eye-width around the full lockup.

## Voice

NOAN speaks in short, warm Vietnamese sentences. Prefer “NOAN chọn món cho bạn” and “Nghé đã sẵn sàng” over third-person technical explanations.

## Application color roots

Use semantic names in screens and components. Raw primitives are reserved for the theme layer.

- `primary` — `#FFC928`: primary buttons, selected tabs, active navigation and small emphasis areas.
- `primaryPressed` — `#E6AC00`: pressed/loading interaction state; do not use as a large background.
- `primarySoft` — `#FFF1B8`: selected chips, badges and gentle highlights.
- `onPrimary` — `#2A1A10`: text and icons placed on yellow.
- `background` — `#FFF9EE`: default app/page background.
- `surface` — `#FFFFFF`: cards, sheets, dialogs and input surfaces.
- `surfaceWarm` — `#FFF7E8`: warm secondary sections and mascot panels.
- `surfaceMuted` — `#F7F2E9`: disabled rows and quiet separators.
- `text` — `#2A1A10`: headings and primary body text; replaces pure black.
- `textSecondary` — `#6B625B`: supporting copy and metadata.
- `textMuted` — `#91877F`: placeholders and low-emphasis labels.
- `border` — `#E9DEC9`: card, divider and input borders.
- `accent` — `#FF725E`: restrained brand accent, likes and small highlights.
- `success` — `#2E9D63`; `info` — `#3B82F6`; `warning` — `#B98500`; `danger` — `#E5484D`.

Accessibility rules:

- Always use `onPrimary` rather than white text on the yellow primary color.
- Reserve coral, green, blue and red for meaning; never replace all four with yellow.
- Prefer `background` for screens and `surface` for cards so elevation remains visible.
- Use `textSecondary` for metadata; `textMuted` is not intended for long paragraphs.

Implementation source: `mobile/src/theme/tokens.ts`. `mobile/src/theme/colors.ts` provides concise aliases, `mobile/global.css` maps semantic tokens to NativeWind, and `mobile/tailwind.config.js` exposes the `noan-*` utilities. The legacy `mogu-*` namespace temporarily resolves to the same NOAN palette during migration.

## Technical migration boundary

Visible names and artwork migrate to NOAN. Existing application IDs, API hosts, deep-link scheme and notification channel IDs remain unchanged until a separate store/backend migration is approved; changing those identifiers can break upgrades, links and saved preferences.

## Production assets

- `mobile/src/assets/images/noan/noan-primary-logo-v2.png`: current primary transparent logo lockup with proprietary lettering.
- `mobile/src/assets/images/noan/noan-primary-logo-v1.png`: archived first lockup for comparison only.
- `mobile/src/assets/images/noan/noan-wordmark-custom-v2.png`: proprietary standalone NOAN lettering.
- `mobile/src/assets/images/noan/noan-app-icon-v1.png`: 1024 px store/app icon artwork.
- `mobile/src/assets/images/noan/noan-adaptive-foreground-v1.png`: Android adaptive foreground.
- `mobile/src/assets/images/noan/noan-mascot-master-v1.png`: canonical full-body character.
- `mobile/src/assets/images/noan/noan-serving-v1.png`: food recommendation and home hero.
- `mobile/src/assets/images/noan/noan-thinking-v1.png`: Random loading, goal and body-information states.
- `mobile/src/assets/images/noan/noan-celebrate-v1.png`: onboarding completion and success states.
- `mobile/src/components/brand/NoanWordmark.tsx`: reusable in-app wrapper for the proprietary wordmark.

The generated raster assets were created in `logo-brand` mode from one canonical visual reference. New poses must use `noan-mascot-master-v1.png` as the character reference and keep the negative constraints in this document.

## Default avatar collection

The app ships with ten square mascot avatars under `mobile/src/assets/images/noan/avatars/`: five masculine options and five feminine options. Every avatar keeps the same golden calf identity, face proportions, horns, ears and muzzle. Personality comes from expression, accessory and background rather than changing the mascot anatomy.

Mobile consumes the collection through `mobile/src/theme/default-avatars.ts`. Persist only the stable avatar key in the profile, such as `male_calm`, `male_active`, `female_gentle` or `female_creative`. Do not persist a bundled file path. A future backend field should be nullable `defaultAvatarKey` with a constrained string/enum matching the registry; a custom uploaded `avatarUrl` should take precedence when present.
