#!/usr/bin/env python3
"""Generate Aetherklang's static 64 px painterly block textures.

The animated resonance crystals, rift, and portal are intentionally outside
this pass.  The renderer is deterministic and uses only the Python standard
library so the committed PNGs can always be reproduced with this script.
"""

from __future__ import annotations

import argparse
import math
import random
import struct
import zlib
from dataclasses import dataclass
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from typing import Iterable, Sequence


ROOT = Path(__file__).resolve().parents[1]
TEXTURE_DIR = ROOT / "src/main/resources/assets/aetherklang/textures/block"
SIZE = 64

# These assets belong to the separate animated crystal/portal pass.
RESERVED_ANIMATED_TEXTURES = frozenset(
    {
        "dissonanzanker",
        "dissonanzanker_active",
        "dissonanzriss",
        "glockenspiel_portal",
        "klangblume",
        "klanglaterne",
        "kristallresonator",
        "kristallresonator_charged",
        "metronomblock",
        "metronomblock_lit",
        "notenpult",
        "resonanzkristall_cyan",
        "resonanzkristall_gold",
        "resonanzkristall_indigo",
        "resonanzkristall_magenta",
        "stimmaltar",
        "stimmpfeiler",
        "stimmpfeiler_attuned",
    }
)

STATIC_TEXTURES = (
    "arpeggienquarzit",
    "arpeggienquarzit_poliert",
    "arpeggienquarzit_ziegel",
    "bassschiefer",
    "bassschiefer_poliert",
    "bassschiefer_ziegel",
    "resonanzarchiv",
    "resonanzholz",
    "resonanzholz_planken",
    "riffbasalt",
    "riffbasalt_poliert",
    "riffbasalt_ziegel",
    "taktbruecke",
)

Color = tuple[int, int, int, int]
Point = tuple[float, float]


def rgba(hex_color: str, alpha: int = 255) -> Color:
    value = hex_color.removeprefix("#")
    return (
        int(value[0:2], 16),
        int(value[2:4], 16),
        int(value[4:6], 16),
        alpha,
    )


def mix(first: Color, second: Color, amount: float) -> Color:
    amount = max(0.0, min(1.0, amount))
    return tuple(
        round(first[channel] * (1.0 - amount) + second[channel] * amount)
        for channel in range(4)
    )  # type: ignore[return-value]


def shade(color: Color, amount: float) -> Color:
    target = rgba("#FFFFFF") if amount >= 0.0 else rgba("#000000")
    return mix(color, target, abs(amount))


def seed_for(name: str, salt: str = "") -> int:
    digest = sha256(f"aetherklang-uhd-v2:{name}:{salt}".encode()).digest()
    return int.from_bytes(digest[:8], "big")


class Canvas:
    def __init__(self, color: Color) -> None:
        self.pixels = [color] * (SIZE * SIZE)

    def blend(self, x: int, y: int, color: Color, opacity: float = 1.0) -> None:
        if not 0 <= x < SIZE or not 0 <= y < SIZE:
            return
        source_alpha = (color[3] / 255.0) * max(0.0, min(1.0, opacity))
        if source_alpha <= 0.0:
            return
        index = y * SIZE + x
        base = self.pixels[index]
        self.pixels[index] = (
            round(base[0] * (1.0 - source_alpha) + color[0] * source_alpha),
            round(base[1] * (1.0 - source_alpha) + color[1] * source_alpha),
            round(base[2] * (1.0 - source_alpha) + color[2] * source_alpha),
            255,
        )

    def brush(
        self,
        center_x: float,
        center_y: float,
        radius_x: float,
        radius_y: float,
        color: Color,
        opacity: float = 1.0,
        *,
        wrap: bool = False,
        seed: int = 0,
    ) -> None:
        rng = random.Random(seed)
        min_x = math.floor(center_x - radius_x - 1)
        max_x = math.ceil(center_x + radius_x + 1)
        min_y = math.floor(center_y - radius_y - 1)
        max_y = math.ceil(center_y + radius_y + 1)
        for raw_y in range(min_y, max_y + 1):
            for raw_x in range(min_x, max_x + 1):
                dx = (raw_x + 0.5 - center_x) / max(radius_x, 0.1)
                dy = (raw_y + 0.5 - center_y) / max(radius_y, 0.1)
                distance = math.sqrt(dx * dx + dy * dy)
                bristle = rng.uniform(-0.13, 0.13)
                if distance > 1.0 + bristle:
                    continue
                edge = max(0.0, min(1.0, (1.1 - distance) * 2.8))
                grain = rng.uniform(0.72, 1.0)
                x = raw_x % SIZE if wrap else raw_x
                y = raw_y % SIZE if wrap else raw_y
                self.blend(x, y, color, opacity * edge * grain)

    def line(
        self,
        start: Point,
        end: Point,
        color: Color,
        width: float,
        opacity: float = 1.0,
        *,
        seed: int = 0,
        roughness: float = 0.5,
    ) -> None:
        rng = random.Random(seed)
        length = max(1.0, math.dist(start, end))
        steps = max(2, math.ceil(length * 1.4))
        for step in range(steps + 1):
            amount = step / steps
            x = start[0] + (end[0] - start[0]) * amount
            y = start[1] + (end[1] - start[1]) * amount
            x += rng.uniform(-roughness, roughness)
            y += rng.uniform(-roughness, roughness)
            radius = width * rng.uniform(0.38, 0.55)
            self.brush(
                x,
                y,
                radius,
                radius * rng.uniform(0.8, 1.2),
                color,
                opacity,
                seed=rng.randrange(1 << 30),
            )

    def polyline(
        self,
        points: Sequence[Point],
        color: Color,
        width: float,
        opacity: float = 1.0,
        *,
        seed: int = 0,
        closed: bool = False,
    ) -> None:
        pairs = list(zip(points, points[1:]))
        if closed and len(points) > 2:
            pairs.append((points[-1], points[0]))
        for index, (start, end) in enumerate(pairs):
            self.line(
                start,
                end,
                color,
                width,
                opacity,
                seed=seed + index * 104729,
            )

    def polygon(
        self,
        points: Sequence[Point],
        color: Color,
        opacity: float = 1.0,
    ) -> None:
        min_x = max(0, math.floor(min(point[0] for point in points)))
        max_x = min(SIZE - 1, math.ceil(max(point[0] for point in points)))
        min_y = max(0, math.floor(min(point[1] for point in points)))
        max_y = min(SIZE - 1, math.ceil(max(point[1] for point in points)))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                inside = False
                previous = points[-1]
                for current in points:
                    if (current[1] > y + 0.5) != (previous[1] > y + 0.5):
                        crossing = (previous[0] - current[0]) * (
                            y + 0.5 - current[1]
                        ) / (previous[1] - current[1]) + current[0]
                        if x + 0.5 < crossing:
                            inside = not inside
                    previous = current
                if inside:
                    self.blend(x, y, color, opacity)

    def ring(
        self,
        center: Point,
        radius_x: float,
        radius_y: float,
        color: Color,
        width: float,
        opacity: float = 1.0,
        *,
        seed: int = 0,
    ) -> None:
        points = []
        for index in range(49):
            angle = math.tau * index / 48
            points.append(
                (
                    center[0] + math.cos(angle) * radius_x,
                    center[1] + math.sin(angle) * radius_y,
                )
            )
        self.polyline(points, color, width, opacity, seed=seed)


@dataclass(frozen=True)
class Palette:
    shadow: Color
    base: Color
    light: Color
    accent: Color


PALETTES = {
    "arpeggienquarzit": Palette(
        rgba("#17293B"), rgba("#35596A"), rgba("#7EB7B8"), rgba("#E8C96A")
    ),
    "bassschiefer": Palette(
        rgba("#11152B"), rgba("#252C49"), rgba("#526482"), rgba("#61E7D6")
    ),
    "riffbasalt": Palette(
        rgba("#102622"), rgba("#275147"), rgba("#57917A"), rgba("#A6DB79")
    ),
    "resonanzholz": Palette(
        rgba("#102D36"), rgba("#1D5962"), rgba("#58A79E"), rgba("#F0C96A")
    ),
}

FUNCTION_PALETTES = {
    "indigo": Palette(
        rgba("#110D24"), rgba("#28204B"), rgba("#5D5485"), rgba("#66EBDD")
    ),
    "cyan": Palette(
        rgba("#0B2630"), rgba("#18515B"), rgba("#4C9A9C"), rgba("#72F4DF")
    ),
    "gold": Palette(
        rgba("#2B2113"), rgba("#69502A"), rgba("#B9924D"), rgba("#F5D56D")
    ),
    "magenta": Palette(
        rgba("#260D27"), rgba("#5C214C"), rgba("#A94A7C"), rgba("#F06BAB")
    ),
    "wood": Palette(
        rgba("#21151C"), rgba("#553246"), rgba("#9B5F69"), rgba("#F0C96A")
    ),
}


@lru_cache(maxsize=None)
def noise_grid(seed: int, cells: int) -> tuple[tuple[float, ...], ...]:
    rng = random.Random(seed)
    return tuple(tuple(rng.random() for _ in range(cells)) for _ in range(cells))


def periodic_noise(seed: int, x: float, y: float, cells: int) -> float:
    grid = noise_grid(seed, cells)
    gx = x / SIZE * cells
    gy = y / SIZE * cells
    x0 = math.floor(gx) % cells
    y0 = math.floor(gy) % cells
    x1 = (x0 + 1) % cells
    y1 = (y0 + 1) % cells
    tx = gx - math.floor(gx)
    ty = gy - math.floor(gy)
    tx = tx * tx * (3.0 - 2.0 * tx)
    ty = ty * ty * (3.0 - 2.0 * ty)
    top = grid[y0][x0] * (1.0 - tx) + grid[y0][x1] * tx
    bottom = grid[y1][x0] * (1.0 - tx) + grid[y1][x1] * tx
    return top * (1.0 - ty) + bottom * ty


def painterly_surface(name: str, palette: Palette, smooth: bool = False) -> Canvas:
    pixels: list[Color] = []
    seed = seed_for(name, "surface")
    for y in range(SIZE):
        for x in range(SIZE):
            broad = periodic_noise(seed, x, y, 4)
            medium = periodic_noise(seed ^ 0xBADC0FFE, x, y, 8)
            fine = periodic_noise(seed ^ 0x5EED1234, x, y, 16)
            value = broad * 0.48 + medium * 0.37 + fine * (0.08 if smooth else 0.15)
            value /= 0.93 if smooth else 1.0
            if value < 0.5:
                pixels.append(mix(palette.shadow, palette.base, value * 2.0))
            else:
                pixels.append(mix(palette.base, palette.light, (value - 0.5) * 1.5))
    canvas = Canvas(pixels[0])
    canvas.pixels = pixels

    rng = random.Random(seed_for(name, "brushes"))
    strokes = 34 if smooth else 54
    for _ in range(strokes):
        color = rng.choice((palette.shadow, palette.base, palette.light))
        canvas.brush(
            rng.uniform(0, SIZE),
            rng.uniform(0, SIZE),
            rng.uniform(1.2, 5.5),
            rng.uniform(0.8, 2.4),
            color,
            rng.uniform(0.05, 0.16),
            wrap=True,
            seed=rng.randrange(1 << 30),
        )
    return canvas


def paint_raw_stone(name: str, palette: Palette) -> Canvas:
    canvas = painterly_surface(name, palette)
    rng = random.Random(seed_for(name, "raw-stone"))
    for index in range(15):
        x = rng.uniform(2, 62)
        y = rng.uniform(2, 62)
        color = palette.light if index % 3 == 0 else palette.shadow
        canvas.line(
            (x, y),
            (x + rng.uniform(-5, 5), y + rng.uniform(-2, 3)),
            color,
            rng.uniform(0.7, 1.5),
            rng.uniform(0.18, 0.42),
            seed=rng.randrange(1 << 30),
        )
    for index in range(3):
        center = (rng.uniform(12, 52), rng.uniform(12, 52))
        canvas.ring(
            center,
            rng.uniform(5, 11),
            rng.uniform(2, 5),
            palette.accent,
            0.8,
            0.12,
            seed=seed_for(name, f"fossil-{index}"),
        )
    return canvas


def paint_polished_stone(name: str, palette: Palette) -> Canvas:
    canvas = painterly_surface(name, palette, smooth=True)
    rng = random.Random(seed_for(name, "polished"))
    for index in range(5):
        y = rng.uniform(-8, 72)
        points = [
            (-4, y),
            (12, y + rng.uniform(-5, 5)),
            (31, y + rng.uniform(-4, 4)),
            (50, y + rng.uniform(-5, 5)),
            (68, y + rng.uniform(-3, 3)),
        ]
        canvas.polyline(
            points,
            palette.light if index % 2 == 0 else palette.shadow,
            rng.uniform(0.8, 1.5),
            0.27,
            seed=rng.randrange(1 << 30),
        )
    canvas.line((0, 1), (63, 1), palette.light, 1.1, 0.2, seed=seed_for(name, "top"))
    canvas.line((0, 62), (63, 62), palette.shadow, 1.1, 0.25, seed=seed_for(name, "bottom"))
    return canvas


def paint_bricks(name: str, palette: Palette) -> Canvas:
    canvas = painterly_surface(name, palette)
    rng = random.Random(seed_for(name, "bricks"))
    for y in (0, 16, 32, 48, 63):
        canvas.line((0, y), (63, y), palette.shadow, 2.3, 0.85, seed=rng.randrange(1 << 30))
        if y < 63:
            canvas.line((0, y + 2), (63, y + 2), palette.light, 0.8, 0.28, seed=rng.randrange(1 << 30))
    for row, y in enumerate((0, 16, 32, 48)):
        seams = (0, 32, 63) if row % 2 == 0 else (16, 48)
        for x in seams:
            canvas.line(
                (x, y),
                (x, min(63, y + 16)),
                palette.shadow,
                2.0,
                0.82,
                seed=rng.randrange(1 << 30),
            )
    for _ in range(18):
        x = rng.uniform(3, 61)
        y = rng.uniform(3, 61)
        canvas.brush(
            x,
            y,
            rng.uniform(0.8, 2.1),
            rng.uniform(0.5, 1.2),
            rng.choice((palette.shadow, palette.light)),
            0.24,
            seed=rng.randrange(1 << 30),
        )
    return canvas


def paint_wood(name: str, palette: Palette, planks: bool) -> Canvas:
    canvas = painterly_surface(name, palette, smooth=planks)
    rng = random.Random(seed_for(name, "wood"))
    if planks:
        for y in (0, 16, 32, 48, 63):
            canvas.line((0, y), (63, y), palette.shadow, 2.1, 0.88, seed=rng.randrange(1 << 30))
            if y < 63:
                canvas.line((0, y + 2), (63, y + 2), palette.light, 0.8, 0.22, seed=rng.randrange(1 << 30))
        for row, y in enumerate((0, 16, 32, 48)):
            x = 20 if row % 2 == 0 else 44
            canvas.line((x, y), (x, min(y + 16, 63)), palette.shadow, 1.5, 0.68, seed=rng.randrange(1 << 30))
        for _ in range(22):
            y = rng.uniform(3, 61)
            length = rng.uniform(5, 15)
            x = rng.uniform(0, 64 - length)
            canvas.line((x, y), (x + length, y + rng.uniform(-1, 1)), palette.light, 0.7, 0.21, seed=rng.randrange(1 << 30))
    else:
        for index in range(11):
            x = index * 6 + rng.uniform(-2, 2)
            points = [(x, -3), (x + rng.uniform(-3, 3), 21), (x + rng.uniform(-3, 3), 43), (x + rng.uniform(-2, 2), 67)]
            canvas.polyline(
                points,
                palette.light if index % 3 == 0 else palette.shadow,
                rng.uniform(0.6, 1.4),
                0.24,
                seed=rng.randrange(1 << 30),
            )
        for index in range(3):
            canvas.ring(
                (rng.uniform(10, 54), rng.uniform(10, 54)),
                rng.uniform(3, 7),
                rng.uniform(1.5, 3.0),
                palette.accent,
                0.8,
                0.24,
                seed=seed_for(name, f"knot-{index}"),
            )
    return canvas


def base_function(name: str, palette_name: str) -> tuple[Canvas, Palette]:
    palette = FUNCTION_PALETTES[palette_name]
    return painterly_surface(name, palette, smooth=True), palette


def paint_altar() -> Canvas:
    name = "stimmaltar"
    canvas, palette = base_function(name, "indigo")
    cyan = rgba("#70F2E1")
    gold = rgba("#F5CD67")
    canvas.ring((32, 32), 23, 23, palette.shadow, 3.2, 0.82, seed=seed_for(name, "outer-shadow"))
    canvas.ring((32, 32), 22, 22, gold, 1.6, 0.78, seed=seed_for(name, "outer"))
    canvas.ring((32, 32), 14, 14, cyan, 1.8, 0.84, seed=seed_for(name, "inner"))
    canvas.ring((32, 32), 7, 7, shade(cyan, 0.45), 1.4, 0.75, seed=seed_for(name, "core"))
    diamond = ((32, 20), (44, 32), (32, 44), (20, 32))
    canvas.polyline(diamond, gold, 2.0, 0.76, seed=seed_for(name, "diamond"), closed=True)
    canvas.brush(32, 32, 4.5, 4.5, shade(cyan, 0.65), 0.85, seed=seed_for(name, "glow"))
    return canvas


def paint_anchor(active: bool) -> Canvas:
    name = "dissonanzanker_active" if active else "dissonanzanker"
    canvas, palette = base_function(name, "magenta" if active else "indigo")
    dark = rgba("#100B20")
    glow = rgba("#FF69B4") if active else rgba("#6BE8D6")
    canvas.ring((32, 32), 22, 22, dark, 3.2, 0.88, seed=seed_for(name, "ring-shadow"))
    canvas.ring((32, 32), 20, 20, glow, 1.8, 0.78 if active else 0.42, seed=seed_for(name, "ring"))
    for index, endpoints in enumerate(
        (
            ((17, 13), (47, 51)),
            ((47, 13), (17, 51)),
            ((32, 9), (32, 55)),
        )
    ):
        canvas.line(*endpoints, dark, 4.5, 0.88, seed=seed_for(name, f"dark-{index}"))
        canvas.line(*endpoints, glow, 1.3, 0.78 if active else 0.45, seed=seed_for(name, f"glow-{index}"))
    canvas.brush(32, 32, 7, 7, glow, 0.72 if active else 0.26, seed=seed_for(name, "core"))
    return canvas


def paint_flower() -> Canvas:
    name = "klangblume"
    canvas, palette = base_function(name, "cyan")
    leaf = rgba("#72C986")
    petal = rgba("#E55B9D")
    gold = rgba("#F5D06D")
    canvas.line((32, 58), (32, 30), leaf, 3.2, 0.82, seed=seed_for(name, "stem"))
    canvas.line((31, 45), (17, 38), leaf, 4.0, 0.62, seed=seed_for(name, "leaf-left"))
    canvas.line((33, 50), (48, 42), leaf, 4.0, 0.62, seed=seed_for(name, "leaf-right"))
    for index in range(8):
        angle = math.tau * index / 8
        canvas.brush(
            32 + math.cos(angle) * 13,
            27 + math.sin(angle) * 13,
            6.2,
            3.5,
            petal,
            0.86,
            seed=seed_for(name, f"petal-{index}"),
        )
    canvas.brush(32, 27, 7, 7, gold, 0.92, seed=seed_for(name, "center"))
    canvas.ring((32, 27), 5, 5, shade(gold, -0.42), 1.2, 0.7, seed=seed_for(name, "center-ring"))
    return canvas


def paint_lantern() -> Canvas:
    name = "klanglaterne"
    canvas, palette = base_function(name, "gold")
    frame = rgba("#D29D42")
    light = rgba("#8BFFF0")
    canvas.polygon(((17, 11), (47, 11), (53, 53), (11, 53)), palette.shadow, 0.74)
    canvas.polygon(((20, 15), (44, 15), (48, 49), (16, 49)), light, 0.72)
    for index, endpoints in enumerate(
        (
            ((17, 11), (11, 53)),
            ((47, 11), (53, 53)),
            ((17, 11), (47, 11)),
            ((11, 53), (53, 53)),
            ((20, 32), (48, 32)),
        )
    ):
        canvas.line(*endpoints, frame, 3.0, 0.88, seed=seed_for(name, f"frame-{index}"))
    canvas.brush(32, 31, 10, 13, shade(light, 0.65), 0.52, seed=seed_for(name, "lamp-glow"))
    return canvas


def paint_resonator(charged: bool) -> Canvas:
    name = "kristallresonator_charged" if charged else "kristallresonator"
    canvas, palette = base_function(name, "gold" if charged else "indigo")
    brass = rgba("#E0B557")
    crystal = rgba("#86FFF0") if charged else rgba("#58AFA9")
    canvas.ring((32, 32), 24, 24, palette.shadow, 4.0, 0.82, seed=seed_for(name, "housing"))
    canvas.ring((32, 32), 21, 21, brass, 2.0, 0.76, seed=seed_for(name, "rim"))
    for index in range(8):
        angle = math.tau * index / 8
        start = (32 + math.cos(angle) * 16, 32 + math.sin(angle) * 16)
        end = (32 + math.cos(angle) * 24, 32 + math.sin(angle) * 24)
        canvas.line(start, end, brass, 2.0, 0.74, seed=seed_for(name, f"spoke-{index}"))
    diamond = ((32, 15), (45, 32), (32, 49), (19, 32))
    canvas.polygon(diamond, crystal, 0.78)
    canvas.polyline(diamond, shade(crystal, 0.48), 1.8, 0.84, seed=seed_for(name, "crystal"), closed=True)
    canvas.line((32, 17), (32, 47), shade(crystal, 0.7), 1.2, 0.62, seed=seed_for(name, "facet"))
    if charged:
        canvas.brush(32, 32, 8, 8, rgba("#E4FFF7"), 0.72, seed=seed_for(name, "charged"))
    return canvas


def paint_metronome(lit: bool) -> Canvas:
    name = "metronomblock_lit" if lit else "metronomblock"
    canvas, palette = base_function(name, "gold" if lit else "wood")
    body = rgba("#7C4954")
    trim = rgba("#F2C965") if lit else rgba("#B58859")
    canvas.polygon(((14, 55), (24, 13), (40, 13), (50, 55)), shade(body, -0.3), 0.92)
    canvas.polygon(((18, 51), (27, 17), (37, 17), (46, 51)), body, 0.94)
    canvas.polyline(((14, 55), (24, 13), (40, 13), (50, 55)), trim, 2.3, 0.8, seed=seed_for(name, "case"))
    canvas.line((32, 45), (39 if lit else 27, 12), trim, 2.5, 0.9, seed=seed_for(name, "pendulum"))
    canvas.brush(39 if lit else 27, 14, 4.5, 3.0, trim, 0.95, seed=seed_for(name, "weight"))
    for index, y in enumerate((26, 34, 42)):
        canvas.line((27, y), (37, y), shade(trim, 0.25), 1.0, 0.64, seed=seed_for(name, f"tick-{index}"))
    return canvas


def paint_lectern() -> Canvas:
    name = "notenpult"
    canvas, palette = base_function(name, "wood")
    page = rgba("#E8D7B0")
    ink = rgba("#27203A")
    gold = rgba("#E4B957")
    canvas.polygon(((8, 14), (31, 18), (31, 52), (8, 46)), page, 0.91)
    canvas.polygon(((33, 18), (56, 14), (56, 46), (33, 52)), shade(page, -0.08), 0.91)
    canvas.line((32, 17), (32, 53), gold, 2.3, 0.85, seed=seed_for(name, "spine"))
    for index, y in enumerate((25, 31, 37, 43)):
        canvas.line((12, y), (27, y + 2), ink, 0.9, 0.6, seed=seed_for(name, f"left-{index}"))
        canvas.line((37, y + 2), (52, y), ink, 0.9, 0.6, seed=seed_for(name, f"right-{index}"))
    canvas.line((22, 23), (22, 38), ink, 1.5, 0.86, seed=seed_for(name, "note-stem"))
    canvas.brush(19, 39, 3.4, 2.5, ink, 0.86, seed=seed_for(name, "note-head"))
    return canvas


def paint_archive() -> Canvas:
    name = "resonanzarchiv"
    canvas, palette = base_function(name, "indigo")
    wood = rgba("#5C3C58")
    cyan = rgba("#68E8DB")
    gold = rgba("#E8C15F")
    for index, y in enumerate((7, 28, 49)):
        canvas.line((4, y), (60, y), wood, 4.0, 0.92, seed=seed_for(name, f"shelf-{index}"))
        canvas.line((5, y - 1), (59, y - 1), gold, 0.9, 0.44, seed=seed_for(name, f"shelf-light-{index}"))
    rng = random.Random(seed_for(name, "folios"))
    colors = (cyan, gold, rgba("#C15891"), rgba("#7594C8"), rgba("#73A66D"))
    for row, top in enumerate((9, 30)):
        x = 7
        entry = 0
        while x < 58:
            width = rng.randint(4, 7)
            height = rng.randint(13, 18)
            color = colors[(row * 7 + entry) % len(colors)]
            canvas.polygon(
                ((x, top + 18 - height), (x + width, top + 17 - height), (x + width, top + 18), (x, top + 18)),
                shade(color, -0.2),
                0.88,
            )
            canvas.line((x + 1, top + 19 - height), (x + 1, top + 17), color, 1.3, 0.8, seed=rng.randrange(1 << 30))
            x += width + rng.randint(1, 2)
            entry += 1
    return canvas


def paint_pillar(attuned: bool) -> Canvas:
    name = "stimmpfeiler_attuned" if attuned else "stimmpfeiler"
    canvas, palette = base_function(name, "cyan" if attuned else "indigo")
    cyan = rgba("#7AFFF0")
    gold = rgba("#F2CD69")
    for index, x in enumerate((5, 17, 32, 47, 59)):
        canvas.line((x, 0), (x, 63), palette.shadow, 2.2, 0.68, seed=seed_for(name, f"flute-{index}"))
        canvas.line((x + 2, 0), (x + 2, 63), palette.light, 0.8, 0.26, seed=seed_for(name, f"flute-light-{index}"))
    rune = gold if attuned else cyan
    canvas.polyline(
        ((14, 50), (25, 38), (19, 30), (32, 18), (45, 29), (39, 38), (50, 48)),
        rune,
        2.0,
        0.82 if attuned else 0.55,
        seed=seed_for(name, "rune"),
    )
    for index, center in enumerate(((14, 50), (32, 18), (50, 48))):
        canvas.brush(*center, 3.0, 3.0, shade(rune, 0.5), 0.8, seed=seed_for(name, f"node-{index}"))
    return canvas


def paint_bridge() -> Canvas:
    name = "taktbruecke"
    canvas, palette = base_function(name, "cyan")
    gold = rgba("#F3CC65")
    dark = rgba("#132837")
    for index, y in enumerate((7, 23, 39, 55)):
        canvas.line((0, y), (63, y), dark, 3.0, 0.82, seed=seed_for(name, f"joint-{index}"))
        canvas.line((0, y + 2), (63, y + 2), gold, 1.2, 0.62, seed=seed_for(name, f"beat-{index}"))
    for index, x in enumerate((8, 24, 40, 56)):
        canvas.line((x, 0), (x, 63), palette.light, 1.1, 0.3, seed=seed_for(name, f"rail-{index}"))
    canvas.polyline(
        ((0, 51), (12, 43), (23, 47), (35, 31), (47, 35), (63, 16)),
        rgba("#78F4E2"),
        2.0,
        0.68,
        seed=seed_for(name, "cadence"),
    )
    return canvas


def render_texture(name: str) -> Canvas:
    for material, palette in PALETTES.items():
        if name == material:
            if material == "resonanzholz":
                return paint_wood(name, palette, False)
            return paint_raw_stone(name, palette)
        if name == f"{material}_poliert":
            return paint_polished_stone(name, palette)
        if name == f"{material}_ziegel":
            return paint_bricks(name, palette)
        if name == f"{material}_planken":
            return paint_wood(name, palette, True)

    renderers = {
        "dissonanzanker": lambda: paint_anchor(False),
        "dissonanzanker_active": lambda: paint_anchor(True),
        "klangblume": paint_flower,
        "klanglaterne": paint_lantern,
        "kristallresonator": lambda: paint_resonator(False),
        "kristallresonator_charged": lambda: paint_resonator(True),
        "metronomblock": lambda: paint_metronome(False),
        "metronomblock_lit": lambda: paint_metronome(True),
        "notenpult": paint_lectern,
        "resonanzarchiv": paint_archive,
        "stimmaltar": paint_altar,
        "stimmpfeiler": lambda: paint_pillar(False),
        "stimmpfeiler_attuned": lambda: paint_pillar(True),
        "taktbruecke": paint_bridge,
    }
    try:
        return renderers[name]()
    except KeyError as error:
        raise ValueError(f"No static block texture renderer for {name}") from error


def png_bytes(pixels: Iterable[Color]) -> bytes:
    pixel_list = list(pixels)
    if len(pixel_list) != SIZE * SIZE:
        raise ValueError(f"Expected {SIZE * SIZE} pixels, got {len(pixel_list)}")
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)
        for color in pixel_list[y * SIZE : (y + 1) * SIZE]:
            raw.extend(color)

    def chunk(tag: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", checksum)

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def generated_pngs() -> dict[str, bytes]:
    overlap = RESERVED_ANIMATED_TEXTURES.intersection(STATIC_TEXTURES)
    if overlap:
        raise ValueError(f"Reserved animated textures entered the static pass: {sorted(overlap)}")
    return {
        name: png_bytes(render_texture(name).pixels)
        for name in STATIC_TEXTURES
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when committed static block textures differ from generated output",
    )
    args = parser.parse_args()

    generated = generated_pngs()
    if args.check:
        stale = [
            name
            for name, content in generated.items()
            if not (TEXTURE_DIR / f"{name}.png").exists()
            or (TEXTURE_DIR / f"{name}.png").read_bytes() != content
        ]
        if stale:
            raise SystemExit(f"Stale 64 px static block textures: {', '.join(stale)}")
        print(
            f"Verified {len(generated)} deterministic 64 px static block textures; "
            f"{len(RESERVED_ANIMATED_TEXTURES)} animated assets excluded."
        )
        return

    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in generated.items():
        (TEXTURE_DIR / f"{name}.png").write_bytes(content)
    print(
        f"Generated {len(generated)} painterly 64 px static block textures; "
        f"left {len(RESERVED_ANIMATED_TEXTURES)} animated assets untouched."
    )


if __name__ == "__main__":
    main()
