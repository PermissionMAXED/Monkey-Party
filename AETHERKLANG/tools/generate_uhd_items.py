#!/usr/bin/env python3
"""Generate deterministic 64 px item textures and animated shimmer frames."""

from __future__ import annotations

import argparse
import json
import struct
import zlib
from hashlib import sha256
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
ITEM_TEXTURES = ROOT / "src/main/resources/assets/aetherklang/textures/item"
FRAME_SIZE = 64
SHIMMER_CENTERS = (-18, 2, 20, 38, 56, 74, 92, 110, 128, 146)
SOURCE_WIDTH_KEY = "aetherklang.source_width"

Pixel = tuple[int, int, int, int]


def paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    left_distance = abs(estimate - left)
    above_distance = abs(estimate - above)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= above_distance and left_distance <= upper_left_distance:
        return left
    if above_distance <= upper_left_distance:
        return above
    return upper_left


def read_png(path: Path) -> tuple[int, int, list[Pixel], dict[str, str]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")

    width = height = 0
    bit_depth = color_type = interlace = -1
    compressed = bytearray()
    metadata: dict[str, str] = {}
    position = 8
    while position < len(data):
        length = struct.unpack(">I", data[position : position + 4])[0]
        chunk_type = data[position + 4 : position + 8]
        payload = data[position + 8 : position + 8 + length]
        position += length + 12
        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
        elif chunk_type == b"IDAT":
            compressed.extend(payload)
        elif chunk_type == b"tEXt":
            key, separator, value = payload.partition(b"\0")
            if separator:
                metadata[key.decode("latin-1")] = value.decode("latin-1")
        elif chunk_type == b"IEND":
            break

    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise ValueError(
            f"{path} must be a non-interlaced 8-bit RGBA PNG "
            f"(found depth={bit_depth}, color={color_type}, interlace={interlace})"
        )

    inflated = zlib.decompress(compressed)
    bytes_per_pixel = 4
    row_size = width * bytes_per_pixel
    expected_size = height * (row_size + 1)
    if len(inflated) != expected_size:
        raise ValueError(
            f"Unexpected decompressed size for {path}: "
            f"{len(inflated)} != {expected_size}"
        )

    pixels: list[Pixel] = []
    previous = bytearray(row_size)
    position = 0
    for _ in range(height):
        filter_type = inflated[position]
        position += 1
        filtered = inflated[position : position + row_size]
        position += row_size
        row = bytearray(row_size)
        for index, value in enumerate(filtered):
            left = row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
            above = previous[index]
            upper_left = (
                previous[index - bytes_per_pixel]
                if index >= bytes_per_pixel
                else 0
            )
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                predictor = paeth(left, above, upper_left)
            else:
                raise ValueError(f"Unsupported PNG filter {filter_type} in {path}")
            row[index] = (value + predictor) & 0xFF
        previous = row
        pixels.extend(
            tuple(row[index : index + bytes_per_pixel])  # type: ignore[arg-type]
            for index in range(0, row_size, bytes_per_pixel)
        )
    return width, height, pixels, metadata


def png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(payload))
        + chunk_type
        + payload
        + struct.pack(">I", checksum)
    )


def encode_png(
    width: int,
    height: int,
    pixels: Iterable[Pixel],
    source_width: int,
) -> bytes:
    pixel_list = list(pixels)
    if len(pixel_list) != width * height:
        raise ValueError(
            f"Pixel count {len(pixel_list)} does not match {width}x{height}"
        )

    raw = bytearray()
    for y in range(height):
        row_pixels = pixel_list[y * width : (y + 1) * width]
        row = bytearray(
            channel
            for pixel in row_pixels
            for channel in pixel
        )
        raw.append(1)
        for index, value in enumerate(row):
            left = row[index - 4] if index >= 4 else 0
            raw.append((value - left) & 0xFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    text = SOURCE_WIDTH_KEY.encode("latin-1") + b"\0" + str(source_width).encode()
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"tEXt", text)
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )


def source_pixels(path: Path) -> tuple[int, list[Pixel]]:
    width, height, pixels, metadata = read_png(path)
    if width in {16, 32} and height == width:
        return width, pixels
    if width != FRAME_SIZE or height % FRAME_SIZE != 0:
        raise ValueError(
            f"{path} must be a square 16/32 px source or generated 64 px frames, "
            f"found {width}x{height}"
        )

    try:
        source_width = int(metadata[SOURCE_WIDTH_KEY])
    except (KeyError, ValueError) as error:
        raise ValueError(
            f"{path} is already 64 px but lacks {SOURCE_WIDTH_KEY} metadata"
        ) from error
    if source_width not in {16, 32}:
        raise ValueError(f"Unsupported source width {source_width} in {path}")

    scale = FRAME_SIZE // source_width
    first_frame = pixels[: FRAME_SIZE * FRAME_SIZE]
    recovered = [
        first_frame[(y * scale) * FRAME_SIZE + x * scale]
        for y in range(source_width)
        for x in range(source_width)
    ]
    return source_width, recovered


def adjust_channel(channel: int, offset: int) -> int:
    return max(0, min(255, channel + offset))


def upscale(source_width: int, source: list[Pixel]) -> list[Pixel]:
    scale = FRAME_SIZE // source_width
    output: list[Pixel] = []
    for y in range(FRAME_SIZE):
        for x in range(FRAME_SIZE):
            pixel = source[(y // scale) * source_width + x // scale]
            red, green, blue, alpha = pixel
            local_x = x % scale
            local_y = y % scale
            if alpha == 0 or (local_x == 0 and local_y == 0):
                output.append(pixel)
                continue

            # Add a restrained top-left bevel inside each enlarged source pixel.
            # The untouched local origin lets subsequent runs recover the source.
            offset = (scale - 1 - local_x - local_y) * 2
            if alpha < 96:
                offset //= 2
            output.append(
                (
                    adjust_channel(red, offset),
                    adjust_channel(green, offset),
                    adjust_channel(blue, offset),
                    alpha,
                )
            )
    return output


def is_animated(name: str) -> bool:
    return (
        name.startswith("relikt_")
        or "elixier" in name
        or name.startswith("partitur_disc_")
    )


def shimmer_color(name: str) -> tuple[int, int, int]:
    palettes = (
        (95, 245, 224),
        (245, 201, 95),
        (224, 58, 140),
        (190, 156, 255),
    )
    return palettes[sha256(name.encode()).digest()[0] % len(palettes)]


def shimmer_frame(
    base: list[Pixel],
    name: str,
    center: int,
) -> list[Pixel]:
    accent = shimmer_color(name)
    output: list[Pixel] = []
    for index, pixel in enumerate(base):
        x = index % FRAME_SIZE
        y = index // FRAME_SIZE
        red, green, blue, alpha = pixel
        distance = abs(x + y - center)
        if alpha == 0 or distance > 10:
            output.append(pixel)
            continue
        strength = 0.46 if distance <= 3 else 0.20 * (10 - distance) / 7
        output.append(
            (
                round(red + (accent[0] - red) * strength),
                round(green + (accent[1] - green) * strength),
                round(blue + (accent[2] - blue) * strength),
                alpha,
            )
        )
    return output


def animation_metadata() -> bytes:
    data = {
        "animation": {
            "frametime": 2,
            "interpolate": True,
        }
    }
    return (json.dumps(data, indent=2) + "\n").encode()


def generated_files(path: Path) -> tuple[bytes, bytes | None]:
    source_width, source = source_pixels(path)
    base = upscale(source_width, source)
    if is_animated(path.stem):
        frames = [
            pixel
            for center in SHIMMER_CENTERS
            for pixel in shimmer_frame(base, path.stem, center)
        ]
        png = encode_png(
            FRAME_SIZE,
            FRAME_SIZE * len(SHIMMER_CENTERS),
            frames,
            source_width,
        )
        return png, animation_metadata()
    return encode_png(FRAME_SIZE, FRAME_SIZE, base, source_width), None


def process(check: bool) -> None:
    textures = sorted(ITEM_TEXTURES.glob("*.png"))
    if not textures:
        raise FileNotFoundError(f"No item textures found in {ITEM_TEXTURES}")

    animated = 0
    failures: list[str] = []
    for path in textures:
        png, metadata = generated_files(path)
        metadata_path = path.with_suffix(path.suffix + ".mcmeta")
        if metadata is not None:
            animated += 1
        if check:
            if path.read_bytes() != png:
                failures.append(str(path.relative_to(ROOT)))
            if metadata is None:
                if metadata_path.exists():
                    failures.append(str(metadata_path.relative_to(ROOT)))
            elif not metadata_path.exists() or metadata_path.read_bytes() != metadata:
                failures.append(str(metadata_path.relative_to(ROOT)))
            continue

        path.write_bytes(png)
        if metadata is None:
            metadata_path.unlink(missing_ok=True)
        else:
            metadata_path.write_bytes(metadata)

    if failures:
        formatted = "\n  ".join(failures)
        raise SystemExit(f"UHD item assets are stale:\n  {formatted}")
    action = "Verified" if check else "Generated"
    print(
        f"{action} {len(textures)} item textures at 64 px "
        f"({animated} animated shimmer textures)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if committed item textures differ from generated output",
    )
    arguments = parser.parse_args()
    process(arguments.check)


if __name__ == "__main__":
    main()
