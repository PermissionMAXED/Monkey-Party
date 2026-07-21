#!/usr/bin/env python3
"""Generate models, recipes, and loot tables for the decorative block kit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src/main/resources/assets/aetherklang"
DATA = ROOT / "src/main/resources/data/aetherklang"

PLANTS = ("klangkoralle", "notenranke", "klanggras")
GLASS = ("resonanzglas", "resonanzglas_cyan", "resonanzglas_gold", "resonanzglas_magenta")
QUARTZ = ("sternenquarz", "sternenquarz_poliert", "sternenquarz_ziegel")
BLOCKS = PLANTS + GLASS + QUARTZ


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def blockstate(block: str) -> dict[str, Any]:
    return {"variants": {"": {"model": f"aetherklang:block/{block}"}}}


def block_model(block: str) -> dict[str, Any]:
    if block in PLANTS:
        return {
            "parent": "minecraft:block/cross",
            "render_type": "minecraft:cutout",
            "textures": {
                "cross": f"aetherklang:block/{block}",
                "particle": f"aetherklang:block/{block}",
            },
        }
    model: dict[str, Any] = {
        "parent": "minecraft:block/cube_all",
        "textures": {"all": f"aetherklang:block/{block}"},
    }
    if block in GLASS:
        model["render_type"] = "minecraft:translucent"
    return model


def item_model(block: str) -> dict[str, Any]:
    return {"parent": f"aetherklang:block/{block}"}


def item_definition(block: str) -> dict[str, Any]:
    return {
        "model": {
            "type": "minecraft:model",
            "model": f"aetherklang:item/{block}",
        }
    }


def self_drop(block: str) -> dict[str, Any]:
    return {
        "type": "minecraft:block",
        "pools": [
            {
                "bonus_rolls": 0.0,
                "conditions": [{"condition": "minecraft:survives_explosion"}],
                "entries": [{"type": "minecraft:item", "name": f"aetherklang:{block}"}],
                "rolls": 1.0,
            }
        ],
        "random_sequence": f"aetherklang:blocks/{block}",
    }


def shaped(pattern: list[str], key: dict[str, str], result: str, count: int) -> dict[str, Any]:
    return {
        "type": "minecraft:crafting_shaped",
        "category": "building",
        "key": key,
        "pattern": pattern,
        "result": {"count": count, "id": f"aetherklang:{result}"},
    }


def shapeless(ingredients: list[str], result: str, count: int = 1) -> dict[str, Any]:
    return {
        "type": "minecraft:crafting_shapeless",
        "category": "building",
        "ingredients": ingredients,
        "result": {"count": count, "id": f"aetherklang:{result}"},
    }


def recipes() -> dict[str, dict[str, Any]]:
    return {
        "klangkoralle": shaped(
            [" P ", "PCP", " A "],
            {
                "A": "minecraft:amethyst_shard",
                "C": "aetherklang:resonanzkristall_cyan",
                "P": "minecraft:prismarine_crystals",
            },
            "klangkoralle",
            4,
        ),
        "notenranke": shaped(
            [" V ", "VGV", " A "],
            {
                "A": "minecraft:amethyst_shard",
                "G": "minecraft:gold_nugget",
                "V": "minecraft:twisting_vines",
            },
            "notenranke",
            4,
        ),
        "klanggras": shapeless(
            ["minecraft:short_grass", "minecraft:glow_berries", "minecraft:amethyst_shard"],
            "klanggras",
            3,
        ),
        "resonanzglas": shaped(
            ["GGG", "GAG", "GGG"],
            {"A": "minecraft:amethyst_shard", "G": "minecraft:glass"},
            "resonanzglas",
            8,
        ),
        "resonanzglas_cyan": shapeless(
            ["aetherklang:resonanzglas", "minecraft:cyan_dye"],
            "resonanzglas_cyan",
        ),
        "resonanzglas_gold": shapeless(
            ["aetherklang:resonanzglas", "minecraft:yellow_dye"],
            "resonanzglas_gold",
        ),
        "resonanzglas_magenta": shapeless(
            ["aetherklang:resonanzglas", "minecraft:magenta_dye"],
            "resonanzglas_magenta",
        ),
        "sternenquarz": shaped(
            ["QAQ", "AGA", "QAQ"],
            {
                "A": "minecraft:amethyst_shard",
                "G": "minecraft:glowstone_dust",
                "Q": "minecraft:quartz",
            },
            "sternenquarz",
            4,
        ),
        "sternenquarz_poliert": shaped(
            ["SS", "SS"],
            {"S": "aetherklang:sternenquarz"},
            "sternenquarz_poliert",
            4,
        ),
        "sternenquarz_ziegel": shaped(
            ["SS", "SS"],
            {"S": "aetherklang:sternenquarz_poliert"},
            "sternenquarz_ziegel",
            4,
        ),
    }


def generated_files() -> dict[Path, bytes]:
    files: dict[Path, bytes] = {}
    recipe_values = recipes()
    for block in BLOCKS:
        files[ASSETS / "blockstates" / f"{block}.json"] = json_bytes(blockstate(block))
        files[ASSETS / "models" / "block" / f"{block}.json"] = json_bytes(block_model(block))
        files[ASSETS / "models" / "item" / f"{block}.json"] = json_bytes(item_model(block))
        files[ASSETS / "items" / f"{block}.json"] = json_bytes(item_definition(block))
        files[DATA / "loot_table" / "blocks" / f"{block}.json"] = json_bytes(self_drop(block))
        files[DATA / "recipe" / f"{block}.json"] = json_bytes(recipe_values[block])
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed resources are stale")
    args = parser.parse_args()

    stale: list[Path] = []
    for path, content in generated_files().items():
        if args.check:
            if not path.exists() or path.read_bytes() != content:
                stale.append(path.relative_to(ROOT))
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    if stale:
        raise SystemExit("Stale decorative block resources:\n" + "\n".join(f"  {path}" for path in stale))
    action = "Validated" if args.check else "Generated"
    print(f"{action} {len(BLOCKS)} decorative blocks ({len(generated_files())} resource files).")


if __name__ == "__main__":
    main()
