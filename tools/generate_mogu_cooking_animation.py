"""Build a seamless raster cooking loop from the exact Mogu PNG artwork.

The source pixels are never repainted. Motion is produced with transforms plus
transparent steam, sparkle and motion-line overlays so the character identity
and rendering style remain unchanged.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mobile/src/assets/images/mascot/mogu-cooking.png"
OUTPUT_DIR = ROOT / "mobile/src/assets/animations"
WEBP_OUTPUT = OUTPUT_DIR / "mogu-cooking-exact.webp"
GIF_OUTPUT = OUTPUT_DIR / "mogu-cooking-exact-preview.gif"

SIZE = 640
FPS = 30
FRAME_COUNT = 72
DURATION_MS = round(1000 / FPS)


def ease_wave(phase: float) -> float:
    return math.sin(phase * math.tau)


def fit_source(source: Image.Image) -> Image.Image:
    # Leave safe room for the tossing arc and movement at all frames.
    target = 566
    scale = min(target / source.width, target / source.height)
    return source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )


def draw_steam(layer: Image.Image, frame: int) -> None:
    draw = ImageDraw.Draw(layer)
    for index, x in enumerate((418, 478)):
        local = ((frame / FRAME_COUNT) + index * 0.35) % 1.0
        alpha = round(180 * math.sin(local * math.pi) ** 1.4)
        rise = round(local * 72)
        points = []
        for step in range(18):
            y = 215 - rise - step * 4
            dx = math.sin(step * 0.55 + local * math.tau) * 10
            points.append((x + dx, y))
        draw.line(points, fill=(255, 255, 255, alpha), width=8, joint="curve")


def draw_sparkles(layer: Image.Image, frame: int) -> None:
    draw = ImageDraw.Draw(layer)
    pulse = (math.sin(frame / FRAME_COUNT * math.tau * 2) + 1) / 2
    alpha = round(110 + pulse * 145)
    color = (255, 197, 26, alpha)
    for x, y, radius in ((91, 276, 9), (110, 241, 7), (542, 204, 8)):
        draw.polygon(
            [(x, y - radius), (x + radius // 3, y - radius // 3),
             (x + radius, y), (x + radius // 3, y + radius // 3),
             (x, y + radius), (x - radius // 3, y + radius // 3),
             (x - radius, y), (x - radius // 3, y - radius // 3)],
            fill=color,
        )


def make_frame(source: Image.Image, frame: int) -> Image.Image:
    phase = frame / FRAME_COUNT
    primary = ease_wave(phase)
    secondary = math.sin(phase * math.tau * 2)

    # A tiny pan-toss rock and vertical bounce animates the exact illustration
    # without redrawing or distorting the mascot's face and proportions.
    angle = -1.8 * primary + 0.55 * secondary
    bounce = round(-7 * abs(primary) - 2 * secondary)
    scale = 1.0 + 0.010 * abs(primary)

    artwork = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    ).rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

    frame_image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Soft shadow reacts inversely to the bounce.
    shadow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_width = round(215 - abs(primary) * 18)
    shadow_draw.ellipse(
        (SIZE // 2 - shadow_width // 2, 570, SIZE // 2 + shadow_width // 2, 596),
        fill=(88, 65, 30, 52),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(8))
    frame_image.alpha_composite(shadow_layer)

    x = (SIZE - artwork.width) // 2
    y = 25 + bounce + (SIZE - 590) // 2
    frame_image.alpha_composite(artwork, (x, y))

    effects = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_steam(effects, frame)
    draw_sparkles(effects, frame)
    frame_image.alpha_composite(effects)
    return frame_image


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = fit_source(Image.open(SOURCE).convert("RGBA"))
    frames = [make_frame(source, frame) for frame in range(FRAME_COUNT)]

    frames[0].save(
        WEBP_OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,
        lossless=False,
        quality=84,
        method=4,
    )

    # Lightweight preview fallback. The WebP above is the production source.
    preview_frames = [frame.resize((320, 320), Image.Resampling.LANCZOS) for frame in frames]
    preview_frames[0].save(
        GIF_OUTPUT,
        save_all=True,
        append_images=preview_frames[1:],
        duration=DURATION_MS,
        loop=0,
        disposal=2,
        transparency=0,
    )

    print(WEBP_OUTPUT)
    print(GIF_OUTPUT)


if __name__ == "__main__":
    main()
