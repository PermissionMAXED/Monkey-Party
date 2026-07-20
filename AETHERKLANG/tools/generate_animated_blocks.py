#!/usr/bin/env python3
"""Generate deterministic 64 px animated flipbooks for luminous blocks."""

from __future__ import annotations

import argparse
import json
import math
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "src/main/resources/assets/aetherklang/textures/block"
SIZE = 64
FRAME_COUNT = 8

Color = tuple[int, int, int, int]
Point = tuple[int, int]


@dataclass(frozen=True)
class Animation:
    name: str
    style: str
    primary: tuple[int, int, int]
    secondary: tuple[int, int, int]
    frametime: int = 3
    intensity: float = 1.0


ANIMATIONS = (
    Animation("resonanzkristall_indigo", "crystal", (145, 94, 255), (95, 245, 224)),
    Animation("resonanzkristall_cyan", "crystal", (95, 245, 224), (118, 178, 255)),
    Animation("resonanzkristall_gold", "crystal", (245, 201, 95), (255, 244, 178)),
    Animation("resonanzkristall_magenta", "crystal", (224, 58, 140), (255, 126, 214)),
    Animation("stimmaltar", "altar", (95, 245, 224), (245, 201, 95), 3),
    Animation("dissonanzriss", "rift", (255, 45, 158), (113, 232, 255), 2, 1.15),
    Animation("glockenspiel_portal", "portal", (95, 245, 224), (245, 201, 95), 2, 1.15),
    Animation("klanglaterne", "lantern", (245, 201, 95), (95, 245, 224), 2, 1.1),
    Animation("klangblume", "flower", (95, 245, 224), (224, 58, 140), 3),
    Animation("notenpult", "score", (245, 201, 95), (145, 94, 255), 4, 0.8),
    Animation("stimmpfeiler", "pillar", (145, 94, 255), (95, 245, 224), 4, 0.55),
    Animation("stimmpfeiler_attuned", "pillar", (95, 245, 224), (245, 201, 95), 2, 1.15),
    Animation("metronomblock", "metronome", (245, 201, 95), (145, 94, 255), 3, 0.65),
    Animation("metronomblock_lit", "metronome", (245, 201, 95), (95, 245, 224), 2, 1.15),
    Animation("dissonanzanker", "anchor", (140, 35, 105), (145, 94, 255), 4, 0.6),
    Animation("dissonanzanker_active", "anchor", (255, 45, 158), (113, 232, 255), 2, 1.2),
    Animation("kristallresonator", "resonator", (78, 164, 176), (145, 94, 255), 4, 0.65),
    Animation("kristallresonator_charged", "resonator", (95, 245, 224), (245, 201, 95), 2, 1.2),
)


def clamp(value: float) -> int:
    return max(0, min(255, round(value)))


def rgba(rgb: tuple[int, int, int], alpha: int = 255, scale: float = 1.0) -> Color:
    return clamp(rgb[0] * scale), clamp(rgb[1] * scale), clamp(rgb[2] * scale), alpha


def stable_seed(name: str) -> int:
    value = 0x811C9DC5
    for byte in name.encode("utf-8"):
        value = ((value ^ byte) * 0x01000193) & 0xFFFFFFFF
    return value


def noise(seed: int, x: int, y: int) -> int:
    value = seed ^ (x * 0x45D9F3B) ^ (y * 0x119DE1F3)
    value = (value ^ (value >> 16)) * 0x45D9F3B
    value = (value ^ (value >> 16)) * 0x45D9F3B
    return (value ^ (value >> 16)) & 0xFF


class Canvas:
    def __init__(self) -> None:
        self.pixels: list[Color] = [(0, 0, 0, 0)] * (SIZE * SIZE)

    def blend(self, x: int, y: int, color: Color) -> None:
        if x < 0 or y < 0 or x >= SIZE or y >= SIZE or color[3] == 0:
            return
        index = y * SIZE + x
        old = self.pixels[index]
        alpha = color[3] / 255.0
        inverse = 1.0 - alpha
        output_alpha = alpha + old[3] / 255.0 * inverse
        if output_alpha <= 0:
            return
        self.pixels[index] = (
            clamp((color[0] * alpha + old[0] * old[3] / 255.0 * inverse) / output_alpha),
            clamp((color[1] * alpha + old[1] * old[3] / 255.0 * inverse) / output_alpha),
            clamp((color[2] * alpha + old[2] * old[3] / 255.0 * inverse) / output_alpha),
            clamp(output_alpha * 255),
        )

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: Color) -> None:
        for y in range(max(0, y0), min(SIZE, y1)):
            for x in range(max(0, x0), min(SIZE, x1)):
                self.blend(x, y, color)

    def disc(self, cx: float, cy: float, radius: float, color: Color) -> None:
        radius_squared = radius * radius
        for y in range(max(0, int(cy - radius - 1)), min(SIZE, int(cy + radius + 2))):
            for x in range(max(0, int(cx - radius - 1)), min(SIZE, int(cx + radius + 2))):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius_squared:
                    self.blend(x, y, color)

    def line(self, start: Point, end: Point, color: Color, width: int = 1) -> None:
        x0, y0 = start
        x1, y1 = end
        dx = abs(x1 - x0)
        sx = 1 if x0 < x1 else -1
        dy = -abs(y1 - y0)
        sy = 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.disc(x0, y0, max(0.5, width / 2), color)
            if x0 == x1 and y0 == y1:
                break
            doubled = 2 * error
            if doubled >= dy:
                error += dy
                x0 += sx
            if doubled <= dx:
                error += dx
                y0 += sy

    def polygon(self, points: list[Point], color: Color) -> None:
        minimum_y = max(0, min(point[1] for point in points))
        maximum_y = min(SIZE - 1, max(point[1] for point in points))
        for y in range(minimum_y, maximum_y + 1):
            intersections: list[float] = []
            previous = points[-1]
            for current in points:
                if (current[1] > y) != (previous[1] > y):
                    intersections.append(
                        current[0]
                        + (y - current[1])
                        * (previous[0] - current[0])
                        / (previous[1] - current[1])
                    )
                previous = current
            intersections.sort()
            for index in range(0, len(intersections), 2):
                if index + 1 >= len(intersections):
                    break
                self.rect(math.ceil(intersections[index]), y, math.floor(intersections[index + 1]) + 1, y + 1, color)

    def arc(
        self,
        cx: float,
        cy: float,
        radius: float,
        start: float,
        sweep: float,
        color: Color,
        width: int = 1,
    ) -> None:
        steps = max(12, round(abs(sweep) * radius * 1.4))
        previous: Point | None = None
        for step in range(steps + 1):
            angle = start + sweep * step / steps
            current = round(cx + math.cos(angle) * radius), round(cy + math.sin(angle) * radius)
            if previous is not None:
                self.line(previous, current, color, width)
            previous = current


def stone_surface(canvas: Canvas, name: str, frame: int, tint: tuple[int, int, int] = (30, 22, 48)) -> None:
    seed = stable_seed(name)
    pulse = math.sin(frame * math.tau / FRAME_COUNT)
    for y in range(SIZE):
        for x in range(SIZE):
            grain = noise(seed, x, y) / 255.0
            seam = 0.72 if x in {0, 1, SIZE - 2, SIZE - 1} or y in {0, 1, SIZE - 2, SIZE - 1} else 1.0
            shade = seam * (0.72 + grain * 0.34 + pulse * 0.015)
            canvas.blend(x, y, rgba(tint, 255, shade))
    canvas.rect(2, 2, 62, 3, (88, 67, 119, 130))
    canvas.rect(2, 61, 62, 62, (8, 6, 18, 180))
    canvas.rect(2, 3, 3, 61, (65, 48, 92, 110))
    canvas.rect(61, 3, 62, 61, (7, 5, 16, 180))


def glow(canvas: Canvas, x: float, y: float, color: tuple[int, int, int], strength: float, radius: float = 6) -> None:
    for layer in range(round(radius), 0, -1):
        alpha = clamp(12 * strength * (radius - layer + 1) / radius)
        canvas.disc(x, y, layer, rgba(color, alpha))
    canvas.disc(x, y, max(1, radius / 4), rgba(color, clamp(210 * strength)))


def crystal_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (20, 15, 39))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.78 + 0.22 * math.sin(phase))
    canvas.polygon([(8, 52), (19, 12), (31, 4), (38, 18), (55, 9), (49, 52)], rgba(animation.primary, 255, 0.28))
    canvas.polygon([(19, 12), (31, 4), (28, 51), (8, 52)], rgba(animation.primary, 255, 0.48))
    canvas.polygon([(31, 4), (38, 18), (49, 52), (28, 51)], rgba(animation.primary, 255, 0.72))
    canvas.polygon([(38, 18), (55, 9), (49, 52)], rgba(animation.secondary, 255, 0.38))
    canvas.line((8, 52), (49, 52), rgba(animation.primary, 220, 0.8), 2)
    canvas.line((31, 4), (28, 51), rgba(animation.secondary, clamp(180 * pulse)), 2)
    canvas.line((55, 9), (38, 18), rgba(animation.secondary, clamp(190 * pulse)), 2)
    for offset in (0, 3, 6):
        progress = (frame * 8 + offset * 13) % 52
        x = 17 + progress * 0.52
        y = 51 - progress * 0.72
        glow(canvas, x, y, animation.secondary, pulse, 3.5)
    canvas.arc(32, 32, 25 + math.sin(phase) * 2, phase, math.pi * 0.42, rgba(animation.primary, 90), 1)
    return canvas


def portal_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    phase = frame * math.tau / FRAME_COUNT
    canvas.disc(32, 32, 31, (10, 7, 30, 215))
    canvas.disc(32, 32, 27, (20, 12, 50, 220))
    for ring, color in ((27, animation.primary), (20, animation.secondary), (12, animation.primary)):
        canvas.arc(32, 32, ring, phase * (1 if ring != 20 else -1), math.tau * 0.78, rgba(color, 210), 3)
    previous: Point | None = None
    for step in range(220):
        progress = step / 219
        angle = phase + progress * math.tau * 2.6
        radius = 2 + progress * 27
        point = round(32 + math.cos(angle) * radius), round(32 + math.sin(angle) * radius)
        if previous is not None:
            color = animation.primary if step % 32 < 16 else animation.secondary
            canvas.line(previous, point, rgba(color, 205), 2)
        previous = point
    glow(canvas, 32, 32, animation.secondary, 1.2, 7)
    return canvas


def rift_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    phase = frame * math.tau / FRAME_COUNT
    seed = stable_seed(animation.name)
    points: list[Point] = []
    for index in range(10):
        y = 2 + index * 7
        x = 32 + round(math.sin(index * 1.9 + phase) * (4 + index % 3))
        points.append((x, y))
    for start, end in zip(points, points[1:]):
        canvas.line(start, end, rgba(animation.primary, 80), 8)
        canvas.line(start, end, rgba(animation.primary, 190), 4)
        canvas.line(start, end, rgba(animation.secondary, 245), 1)
    for index, point in enumerate(points[1:-1], 1):
        direction = -1 if (noise(seed, index, frame) & 1) else 1
        length = 6 + noise(seed, frame, index) % 8
        branch_end = point[0] + direction * length, point[1] + 3 + index % 3
        canvas.line(point, branch_end, rgba(animation.primary, 170), 2)
        if index % 2 == frame % 2:
            glow(canvas, point[0], point[1], animation.secondary, 1.1, 4)
    return canvas


def sigil_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame)
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.72 + 0.28 * math.sin(phase))
    for radius, direction in ((25, 1), (19, -1), (12, 1)):
        canvas.arc(
            32,
            32,
            radius,
            phase * direction + radius,
            math.tau * 0.68,
            rgba(animation.primary if direction > 0 else animation.secondary, clamp(180 * pulse)),
            2,
        )
    for index in range(8):
        angle = phase + index * math.tau / 8
        inner = (round(32 + math.cos(angle) * 7), round(32 + math.sin(angle) * 7))
        outer = (round(32 + math.cos(angle) * 15), round(32 + math.sin(angle) * 15))
        canvas.line(inner, outer, rgba(animation.secondary, clamp(145 * pulse)), 1)
    glow(canvas, 32, 32, animation.primary, pulse, 5)
    return canvas


def altar_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (31, 20, 49))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.76 + 0.24 * math.sin(phase))
    for index in range(4):
        angle = phase * 0.25 + math.pi / 4 + index * math.pi / 2
        x = 32 + math.cos(angle) * 23
        y = 32 + math.sin(angle) * 23
        canvas.polygon(
            [
                (round(x), round(y - 4)),
                (round(x + 3), round(y)),
                (round(x), round(y + 4)),
                (round(x - 3), round(y)),
            ],
            rgba(animation.primary, clamp(205 * pulse)),
        )
    canvas.arc(32, 32, 26, phase, math.tau * 0.82, rgba(animation.secondary, clamp(170 * pulse)), 2)
    canvas.arc(32, 32, 18, -phase, math.tau * 0.7, rgba(animation.primary, clamp(210 * pulse)), 3)
    for index in range(6):
        angle = index * math.tau / 6 - phase * 0.35
        canvas.line(
            (round(32 + math.cos(angle) * 8), round(32 + math.sin(angle) * 8)),
            (round(32 + math.cos(angle) * 15), round(32 + math.sin(angle) * 15)),
            rgba(animation.secondary, clamp(150 * pulse)),
            1,
        )
    canvas.line((27, 25), (27, 39), rgba(animation.primary, clamp(210 * pulse)), 2)
    canvas.line((27, 25), (38, 25), rgba(animation.primary, clamp(210 * pulse)), 2)
    glow(canvas, 36, 38, animation.secondary, pulse, 5)
    return canvas


def lantern_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (29, 24, 34))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.76 + 0.24 * math.sin(phase))
    canvas.rect(11, 8, 53, 12, (70, 51, 38, 255))
    canvas.rect(11, 52, 53, 56, (35, 25, 28, 255))
    canvas.rect(8, 11, 12, 53, (61, 43, 37, 255))
    canvas.rect(52, 11, 56, 53, (31, 22, 27, 255))
    canvas.rect(16, 16, 48, 48, (15, 13, 28, 255))
    radius = 10 + 2 * math.sin(phase)
    glow(canvas, 32, 32, animation.primary, pulse * 1.15, radius)
    canvas.arc(32, 32, 18, phase, math.tau * 0.72, rgba(animation.secondary, clamp(180 * pulse)), 2)
    canvas.arc(32, 32, 24, -phase, math.tau * 0.62, rgba(animation.primary, clamp(145 * pulse)), 2)
    for offset in (-12, -6, 0, 6, 12):
        shimmer = math.sin(phase + offset * 0.3)
        canvas.line(
            (20, 32 + offset),
            (44, 32 + offset),
            rgba(animation.primary, clamp((65 + shimmer * 35) * pulse)),
            1,
        )
    return canvas


def flower_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (18, 28, 39))
    phase = frame * math.tau / FRAME_COUNT
    pulse = 0.8 + math.sin(phase) * 0.2
    for index in range(8):
        angle = phase * 0.18 + index * math.tau / 8
        x = 32 + math.cos(angle) * (13 + 2 * math.sin(phase + index))
        y = 32 + math.sin(angle) * (13 + 2 * math.sin(phase + index))
        canvas.disc(x, y, 7, rgba(animation.primary, 90, pulse))
        canvas.disc(x, y, 3, rgba(animation.secondary, 210, pulse))
    canvas.arc(32, 32, 24, -phase, math.tau * 0.74, rgba(animation.primary, 180), 2)
    glow(canvas, 32, 32, animation.primary, 1.0, 6)
    return canvas


def score_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (35, 24, 45))
    phase = frame * math.tau / FRAME_COUNT
    for y in range(20, 45, 6):
        canvas.line((10, y), (54, y), rgba(animation.secondary, 120), 1)
    for index, x in enumerate((18, 30, 43)):
        bob = round(math.sin(phase + index * 1.8) * 2)
        canvas.line((x + 4, 17 + bob), (x + 4, 37 + bob), rgba(animation.primary, 220), 2)
        glow(canvas, x, 39 + bob, animation.primary, 0.75, 4)
    canvas.arc(32, 32, 27, phase, math.pi * 0.5, rgba(animation.secondary, 155), 2)
    return canvas


def pillar_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (25, 21, 44))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.72 + 0.28 * math.sin(phase))
    canvas.rect(25, 5, 39, 59, (13, 11, 26, 255))
    canvas.rect(27, 5, 29, 59, rgba(animation.primary, clamp(105 * pulse)))
    canvas.rect(36, 5, 38, 59, rgba(animation.secondary, clamp(80 * pulse)))
    for index, y in enumerate(range(10, 59, 9)):
        direction = -1 if index % 2 else 1
        canvas.line((32, y), (32 + direction * 7, y + 4), rgba(animation.primary, clamp(210 * pulse)), 2)
        canvas.line((32 + direction * 7, y + 4), (32, y + 8), rgba(animation.secondary, clamp(180 * pulse)), 2)
    spark_y = 57 - (frame * 8) % 56
    glow(canvas, 32, spark_y, animation.secondary, pulse, 4)
    return canvas


def metronome_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (42, 28, 37))
    phase = frame * math.tau / FRAME_COUNT
    canvas.polygon([(13, 55), (24, 10), (40, 10), (51, 55)], (30, 18, 28, 255))
    canvas.line((13, 55), (51, 55), rgba(animation.primary, 190), 3)
    canvas.line((24, 10), (40, 10), rgba(animation.secondary, 125), 2)
    angle = math.sin(phase) * 0.48 - math.pi / 2
    end = round(32 + math.cos(angle) * 27), round(45 + math.sin(angle) * 27)
    canvas.line((32, 45), end, rgba(animation.primary, 230, animation.intensity), 3)
    glow(canvas, end[0], end[1], animation.secondary, animation.intensity, 4)
    for y in (28, 36, 44):
        canvas.line((27, y), (37, y), rgba(animation.secondary, 90), 1)
    return canvas


def anchor_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (25, 12, 35))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.72 + 0.28 * math.sin(phase))
    for radius in (25, 18, 11):
        canvas.arc(32, 31, radius, phase + radius, math.pi * 0.76, rgba(animation.primary, clamp(180 * pulse)), 3)
        canvas.arc(32, 31, radius, phase + radius + math.pi, math.pi * 0.55, rgba(animation.secondary, clamp(95 * pulse)), 1)
    canvas.line((32, 10), (32, 48), rgba(animation.primary, clamp(210 * pulse)), 3)
    canvas.arc(32, 44, 13, 0.1, math.pi * 0.9, rgba(animation.primary, clamp(220 * pulse)), 3)
    canvas.arc(32, 44, 13, math.pi, -math.pi * 0.9, rgba(animation.primary, clamp(220 * pulse)), 3)
    glow(canvas, 32, 17 + frame * 4 % 29, animation.secondary, pulse, 4)
    return canvas


def resonator_frame(animation: Animation, frame: int) -> Canvas:
    canvas = Canvas()
    stone_surface(canvas, animation.name, frame, (17, 28, 42))
    phase = frame * math.tau / FRAME_COUNT
    pulse = animation.intensity * (0.75 + 0.25 * math.sin(phase))
    canvas.polygon([(32, 6), (46, 27), (32, 56), (18, 27)], rgba(animation.primary, 255, 0.33 + pulse * 0.22))
    canvas.polygon([(32, 6), (32, 56), (18, 27)], rgba(animation.primary, 210, 0.62))
    canvas.polygon([(32, 6), (46, 27), (32, 56)], rgba(animation.secondary, 190, 0.55))
    canvas.line((18, 27), (46, 27), rgba(animation.secondary, clamp(190 * pulse)), 2)
    canvas.line((32, 6), (32, 56), rgba(animation.primary, clamp(220 * pulse)), 2)
    canvas.arc(32, 31, 27, phase, math.pi * 0.65, rgba(animation.secondary, clamp(170 * pulse)), 2)
    canvas.arc(32, 31, 23, -phase, math.pi * 0.55, rgba(animation.primary, clamp(150 * pulse)), 2)
    glow(canvas, 32, 31, animation.secondary, pulse, 6)
    return canvas


def render_frame(animation: Animation, frame: int) -> Canvas:
    if animation.style == "crystal":
        return crystal_frame(animation, frame)
    if animation.style == "altar":
        return altar_frame(animation, frame)
    if animation.style == "portal":
        return portal_frame(animation, frame)
    if animation.style == "rift":
        return rift_frame(animation, frame)
    if animation.style == "lantern":
        return lantern_frame(animation, frame)
    if animation.style == "flower":
        return flower_frame(animation, frame)
    if animation.style == "score":
        return score_frame(animation, frame)
    if animation.style == "pillar":
        return pillar_frame(animation, frame)
    if animation.style == "metronome":
        return metronome_frame(animation, frame)
    if animation.style == "anchor":
        return anchor_frame(animation, frame)
    if animation.style == "resonator":
        return resonator_frame(animation, frame)
    return sigil_frame(animation, frame)


def png_bytes(width: int, height: int, pixels: Iterable[Color]) -> bytes:
    pixel_list = list(pixels)
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for color in pixel_list[y * width : (y + 1) * width]:
            raw.extend(color)

    def chunk(kind: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def outputs(animation: Animation) -> tuple[bytes, bytes]:
    frames = [render_frame(animation, frame).pixels for frame in range(FRAME_COUNT)]
    if len({bytes(channel for pixel in frame for channel in pixel) for frame in frames}) < 4:
        raise ValueError(f"{animation.name} does not contain enough distinct frames")
    flipbook = png_bytes(SIZE, SIZE * FRAME_COUNT, (pixel for frame in frames for pixel in frame))
    metadata = json.dumps(
        {"animation": {"frametime": animation.frametime, "interpolate": True}},
        indent=2,
    ).encode("utf-8") + b"\n"
    return flipbook, metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed flipbooks are stale")
    args = parser.parse_args()

    stale: list[str] = []
    for animation in ANIMATIONS:
        flipbook, metadata = outputs(animation)
        png_path = TEXTURES / f"{animation.name}.png"
        metadata_path = TEXTURES / f"{animation.name}.png.mcmeta"
        for path, expected in ((png_path, flipbook), (metadata_path, metadata)):
            if args.check:
                if not path.exists() or path.read_bytes() != expected:
                    stale.append(str(path.relative_to(ROOT)))
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(expected)

    if stale:
        raise SystemExit("Stale generated assets:\n" + "\n".join(f"  {path}" for path in stale))
    action = "Validated" if args.check else "Generated"
    print(f"{action} {len(ANIMATIONS)} animated {SIZE}px block flipbooks ({FRAME_COUNT} frames each).")


if __name__ == "__main__":
    main()
