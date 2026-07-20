#!/usr/bin/env python3
"""Generate unique palette-shifted PNG textures for Aetherklang assets."""

from __future__ import annotations

import json
import struct
import zlib
import zlib as _zlib
from hashlib import sha256
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src/main/resources/assets/aetherklang"
TEXTURES = ASSETS / "textures"
MODELS = ASSETS / "models"

FORBIDDEN = {
    (0x1A, 0x10, 0x33),
    (0x12, 0x08, 0x2A),
    (0x00, 0x00, 0x00),
}

ITEM_BASE = TEXTURES / "item/klangstaub.png"
BLOCK_BASE = TEXTURES / "block/stimmaltar.png"
CRYSTAL_BASE = TEXTURES / "block/resonanzkristall_cyan.png"


def read_png(path: Path) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    pos = 8
    width = height = 0
    raw_data = b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if chunk_type == b"IHDR":
            width, height = struct.unpack(">II", chunk[:8])
        elif chunk_type == b"IDAT":
            raw_data += chunk
        elif chunk_type == b"IEND":
            break
    inflated = zlib.decompress(raw_data)
    pixels: list[tuple[int, int, int, int]] = []
    stride = width * 4 + 1
    previous = bytes(width * 4)
    index = 0
    for _y in range(height):
        filter_type = inflated[index]
        index += 1
        row = bytearray(inflated[index : index + width * 4])
        index += width * 4
        if filter_type == 1:
            for i in range(3, len(row), 4):
                row[i - 3] = (row[i - 3] + row[i - 7]) & 0xFF
                row[i - 2] = (row[i - 2] + row[i - 6]) & 0xFF
                row[i - 1] = (row[i - 1] + row[i - 5]) & 0xFF
                row[i] = (row[i] + row[i - 4]) & 0xFF
        elif filter_type == 2:
            for i in range(0, len(row), 4):
                row[i] = (row[i] + previous[i]) & 0xFF
                row[i + 1] = (row[i + 1] + previous[i + 1]) & 0xFF
                row[i + 2] = (row[i + 2] + previous[i + 2]) & 0xFF
                row[i + 3] = (row[i + 3] + previous[i + 3]) & 0xFF
        elif filter_type == 0:
            pass
        else:
            raise ValueError(f"Unsupported PNG filter {filter_type}")
        previous = bytes(row)
        for i in range(0, len(row), 4):
            pixels.append((row[i], row[i + 1], row[i + 2], row[i + 3]))
    return width, height, pixels


def write_png(path: Path, width: int, height: int, pixels: Iterable[tuple[int, int, int, int]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = bytearray()
    pixel_list = list(pixels)
    previous = bytes(width * 4)
    for y in range(height):
        row = bytearray(width * 4)
        for x in range(width):
            r, g, b, a = pixel_list[y * width + x]
            offset = x * 4
            row[offset : offset + 4] = bytes((r, g, b, a))
        filtered = bytearray([1])  # Sub filter
        for i in range(len(row)):
            left = row[i - 4] if i >= 4 else 0
            filtered.append((row[i] - left) & 0xFF)
        raw.extend(filtered)
        previous = bytes(row)

    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = _zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.write_bytes(png)


def palette_seed(name: str) -> tuple[int, int, int]:
    digest = sha256(name.encode()).digest()
    return digest[0], digest[1], digest[2]


def shift_pixel(
    rgba: tuple[int, int, int, int],
    hue_shift: tuple[int, int, int],
    index: int,
) -> tuple[int, int, int, int]:
    r, g, b, a = rgba
    if a < 16:
        return rgba
    hr, hg, hb = hue_shift
    mix = (index % 7) / 6.0
    nr = int(r * (0.55 + hr / 255.0 * 0.45) + hg * mix * 0.08)
    ng = int(g * (0.55 + hg / 255.0 * 0.45) + hb * mix * 0.08)
    nb = int(b * (0.55 + hb / 255.0 * 0.45) + hr * mix * 0.08)
    nr = max(24, min(255, nr))
    ng = max(24, min(255, ng))
    nb = max(24, min(255, nb))
    if (nr, ng, nb) in FORBIDDEN or (nr + ng + nb) < 90:
        nr = min(255, nr + 48)
        ng = min(255, ng + 32)
    return nr, ng, nb, a


def generate_texture(name: str, base: Path, out: Path) -> None:
    width, height, pixels = read_png(base)
    hue = palette_seed(name)
    shifted = [shift_pixel(pixel, hue, index) for index, pixel in enumerate(pixels)]
    write_png(out, width, height, shifted)


def collect_texture_refs() -> dict[str, str]:
    refs: dict[str, str] = {}
    for model in MODELS.rglob("*.json"):
        data = json.loads(model.read_text(encoding="utf-8"))
        rel = model.relative_to(MODELS)
        if rel.parts[0] == "block":
            asset_id = rel.parts[-1].replace(".json", "")
            kind = "block"
        elif rel.parts[0] == "item":
            asset_id = rel.stem
            kind = "item"
        else:
            continue

        layers: list[str] = []

        def walk(node: object) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in {"layer0", "all", "particle", "texture"} and isinstance(value, str):
                        layers.append(value)
                    else:
                        walk(value)
            elif isinstance(node, list):
                for entry in node:
                    walk(entry)

        walk(data)
        for layer in layers:
            if layer.startswith("minecraft:"):
                refs[f"{kind}/{asset_id}"] = layer
                break
    return refs


def choose_base(asset_key: str, minecraft_ref: str) -> Path:
    if asset_key.startswith("block/"):
        if "amethyst" in minecraft_ref or "crystal" in asset_key:
            return CRYSTAL_BASE
        return BLOCK_BASE
    if "elixier" in asset_key or "resonanzelixier" in asset_key:
        return TEXTURES / "item/elixier_freude.png"
    if "disc" in asset_key or "relikt" in asset_key:
        return TEXTURES / "item/partitur_disc_1.png"
    if "klangweber" in asset_key:
        return TEXTURES / "item/echostiefel.png"
    if any(token in asset_key for token in ("pauke", "sopranfloete", "kontrabass", "triangel")):
        return TEXTURES / "item/basshammer.png"
    if asset_key.endswith(
        (
            "tremolokern",
            "saitenherz",
            "schwarmauge",
            "stillesplitter",
            "chorherz",
            "resonanzelixier",
        )
    ):
        return TEXTURES / "item/kaskadenkern.png"
    return ITEM_BASE


def update_model(asset_key: str, texture_path: str) -> None:
    kind, asset_id = asset_key.split("/", 1)
    model_path = MODELS / kind / f"{asset_id}.json"
    data = json.loads(model_path.read_text(encoding="utf-8"))

    def rewrite(node: object) -> None:
        if isinstance(node, dict):
            for key, value in list(node.items()):
                if key in {"layer0", "all", "particle", "texture"} and isinstance(value, str):
                    if value.startswith("minecraft:"):
                        node[key] = texture_path
                else:
                    rewrite(value)
        elif isinstance(node, list):
            for entry in node:
                rewrite(entry)

    rewrite(data)
    with model_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> None:
    refs = collect_texture_refs()
    generated = 0
    for asset_key, minecraft_ref in sorted(refs.items()):
        kind, asset_id = asset_key.split("/", 1)
        out = TEXTURES / kind / f"{asset_id}.png"
        if out.exists():
            continue
        base = choose_base(asset_key, minecraft_ref)
        if not base.exists():
            raise FileNotFoundError(f"Missing base texture for {asset_key}: {base}")
        generate_texture(asset_id, base, out)
        update_model(asset_key, f"aetherklang:{kind}/{asset_id}")
        generated += 1
    print(f"Generated {generated} unique palette-shifted textures (skipped existing).")


if __name__ == "__main__":
    main()
