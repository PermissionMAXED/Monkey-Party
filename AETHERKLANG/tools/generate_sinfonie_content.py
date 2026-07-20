#!/usr/bin/env python3
"""Deterministically generate Aetherklang's large Sinfonie content layer."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INNER_ISLAND_COUNT = 120
FERMATENRING_ISLAND_COUNT = 100
RESOURCES = ROOT / "src/main/resources"
DATA = RESOURCES / "data/aetherklang"
ASSETS = RESOURCES / "assets/aetherklang"
CONTENT = DATA / "content"
KLANGWERK = DATA / "klangwerk"
LANG_PATHS = {
    "de": ASSETS / "lang/de_de.json",
    "en": ASSETS / "lang/en_us.json",
}

ARCHETYPE_DATA = {
    "laeufer": {
        "de": "Läufer",
        "en": "Runner",
        "health": 22.0,
        "attack": 4.5,
        "speed": 0.28,
        "scale": 0.86,
        "names": [
            ("allegro", "Allegro-Kurier", "Allegro Courier"),
            ("accelerando", "Accelerando-Jäger", "Accelerando Hunter"),
            ("rubato", "Rubato-Pirscher", "Rubato Stalker"),
            ("vivace", "Vivace-Sprinter", "Vivace Sprinter"),
            ("rondo", "Rondo-Läufer", "Rondo Runner"),
            ("cadenz", "Kadenz-Späher", "Cadence Scout"),
            ("dolce", "Dolce-Wanderer", "Dolce Wanderer"),
            ("furioso", "Furioso-Stürmer", "Furioso Charger"),
            ("andante", "Andante-Wächter", "Andante Warden"),
            ("scherzo", "Scherzo-Hüpfer", "Scherzo Skipper"),
            ("coda", "Coda-Verfolger", "Coda Pursuer"),
            ("maestoso", "Maestoso-Herold", "Maestoso Herald"),
            ("ritardando", "Ritardando-Hüter", "Ritardando Keeper"),
            ("brillante", "Brillante-Renner", "Brillante Racer"),
            ("con_fuoco", "Con-Fuoco-Brecher", "Con Fuoco Breaker"),
            ("grazioso", "Grazioso-Pfadfinder", "Grazioso Pathfinder"),
            ("tempestoso", "Tempestoso-Jäger", "Tempestoso Hunter"),
            ("moderato", "Moderato-Läufer", "Moderato Runner"),
        ],
    },
    "schwinge": {
        "de": "Schwinge",
        "en": "Wing",
        "health": 16.0,
        "attack": 3.5,
        "speed": 0.30,
        "scale": 0.76,
        "names": [
            ("allegretto", "Allegretto-Falter", "Allegretto Moth"),
            ("cantabile", "Cantabile-Schwinge", "Cantabile Wing"),
            ("vibrato", "Vibrato-Segler", "Vibrato Glider"),
            ("dolcissimo", "Dolcissimo-Funke", "Dolcissimo Spark"),
            ("capriccio", "Capriccio-Flieger", "Capriccio Flier"),
            ("arabeske", "Arabesken-Schwinge", "Arabesque Wing"),
            ("sostenuto", "Sostenuto-Gleiter", "Sostenuto Glider"),
            ("volante", "Volante-Scherbe", "Volante Shard"),
            ("serenade", "Serenaden-Falter", "Serenade Moth"),
            ("rhapsodie", "Rhapsodie-Schwinge", "Rhapsody Wing"),
            ("intermezzo", "Intermezzo-Segler", "Intermezzo Glider"),
            ("arioso", "Arioso-Funke", "Arioso Spark"),
            ("etude", "Etüden-Flieger", "Etude Flier"),
            ("sonatine", "Sonatinen-Schwinge", "Sonatina Wing"),
            ("pastorale", "Pastorale-Gleiter", "Pastorale Glider"),
            ("sforzato", "Sforzato-Scherbe", "Sforzato Shard"),
            ("luminoso", "Luminoso-Falter", "Luminoso Moth"),
            ("misterioso", "Misterioso-Schwinge", "Misterioso Wing"),
        ],
    },
    "pulser": {
        "de": "Pulser",
        "en": "Pulser",
        "health": 30.0,
        "attack": 5.0,
        "speed": 0.22,
        "scale": 1.02,
        "names": [
            ("grave", "Grave-Pulser", "Grave Pulser"),
            ("adagio", "Adagio-Kern", "Adagio Core"),
            ("crescendo", "Crescendo-Pulser", "Crescendo Pulser"),
            ("decrescendo", "Decrescendo-Kern", "Decrescendo Core"),
            ("ostinato", "Ostinato-Pulser", "Ostinato Pulser"),
            ("marziale", "Marziale-Kern", "Marziale Core"),
            ("maestoso", "Maestoso-Pulser", "Maestoso Pulser"),
            ("lento", "Lento-Kern", "Lento Core"),
            ("passacaglia", "Passacaglia-Pulser", "Passacaglia Pulser"),
            ("chaconne", "Chaconne-Kern", "Chaconne Core"),
            ("organum", "Organum-Pulser", "Organum Pulser"),
            ("lamentoso", "Lamentoso-Kern", "Lamentoso Core"),
            ("solenne", "Solenne-Pulser", "Solenne Pulser"),
            ("profondo", "Profondo-Kern", "Profondo Core"),
            ("pesante", "Pesante-Pulser", "Pesante Pulser"),
            ("grandioso", "Grandioso-Kern", "Grandioso Core"),
            ("misterioso", "Misterioso-Pulser", "Misterioso Pulser"),
            ("trionfale", "Trionfale-Kern", "Trionfale Core"),
            ("sforzando", "Sforzando-Kern", "Sforzando Core"),
        ],
    },
    "koloss": {
        "de": "Koloss",
        "en": "Colossus",
        "health": 78.0,
        "attack": 10.0,
        "speed": 0.14,
        "scale": 1.62,
        "names": [
            ("monumental", "Monumental-Koloss", "Monumental Colossus"),
            ("bastion", "Bastions-Koloss", "Bastion Colossus"),
            ("glockensturm", "Glockensturm-Koloss", "Bellstorm Colossus"),
            ("pfeilerwacht", "Pfeilerwacht-Koloss", "Pillar Warden Colossus"),
            ("bruchwall", "Bruchwall-Koloss", "Breached Wall Colossus"),
            ("fundament", "Fundament-Koloss", "Foundation Colossus"),
            ("donnerstufe", "Donnerstufe-Koloss", "Thunderstep Colossus"),
            ("resonanzblock", "Resonanzblock-Koloss", "Resonance Block Colossus"),
            ("titan", "Titan-Koloss", "Titan Colossus"),
            ("schwerpunkt", "Schwerpunkt-Koloss", "Center Mass Colossus"),
            ("maestoso", "Maestoso-Koloss", "Maestoso Colossus"),
            ("gravitas", "Gravitas-Koloss", "Gravitas Colossus"),
            ("solenne", "Solenne-Koloss", "Solenne Colossus"),
            ("pesante", "Pesante-Koloss", "Pesante Colossus"),
            ("profondo", "Profondo-Koloss", "Profondo Colossus"),
            ("grandioso", "Grandioso-Koloss", "Grandioso Colossus"),
            ("fortissimo", "Fortissimo-Koloss", "Fortissimo Colossus"),
            ("marcato", "Marcato-Koloss", "Marcato Colossus"),
            ("larghetto", "Larghetto-Koloss", "Larghetto Colossus"),
        ],
    },
    "weber": {
        "de": "Weber",
        "en": "Weaver",
        "health": 36.0,
        "attack": 5.5,
        "speed": 0.24,
        "scale": 1.08,
        "names": [
            ("garn", "Garn-Weber", "Thread Weaver"),
            ("kette", "Ketten-Weber", "Chain Weaver"),
            ("spindel", "Spindel-Weber", "Spindle Weaver"),
            ("masche", "Maschen-Weber", "Mesh Weaver"),
            ("schleier", "Schleier-Weber", "Veil Weaver"),
            ("wabe", "Waben-Weber", "Comb Weaver"),
            ("faden", "Faden-Weber", "Strand Weaver"),
            ("netz", "Netz-Weber", "Net Weaver"),
            ("echo", "Echo-Weber", "Echo Weaver"),
            ("kaskade", "Kaskaden-Weber", "Cascade Weaver"),
            ("arabeske", "Arabesken-Weber", "Arabesque Weaver"),
            ("filigran", "Filigran-Weber", "Filigree Weaver"),
            ("spinnweb", "Spinnweb-Weber", "Cobweb Weaver"),
            ("verwebung", "Verwebungs-Weber", "Entwine Weaver"),
            ("fessel", "Fessel-Weber", "Bind Weaver"),
            ("nebel", "Nebel-Weber", "Mist Weaver"),
            ("serenade", "Seraden-Weber", "Serenade Weaver"),
            ("nocturne", "Nocturne-Weber", "Nocturne Weaver"),
            ("lamentoso", "Lamentoso-Weber", "Lamentoso Weaver"),
        ],
    },
    "schuetze": {
        "de": "Schütze",
        "en": "Marksman",
        "health": 24.0,
        "attack": 6.5,
        "speed": 0.28,
        "scale": 0.9,
        "names": [
            ("kadenz", "Kadenz-Schütze", "Cadence Marksman"),
            ("takt", "Takt-Schütze", "Beat Marksman"),
            ("fernmelodie", "Fernmelodie-Schütze", "Distant Melody Marksman"),
            ("salve", "Salven-Schütze", "Volley Marksman"),
            ("echo", "Echo-Schütze", "Echo Marksman"),
            ("fernakkord", "Fernakkord-Schütze", "Distant Chord Marksman"),
            ("cantus", "Cantus-Schütze", "Cantus Marksman"),
            ("staccato", "Staccato-Schütze", "Staccato Marksman"),
            ("legato", "Legato-Schütze", "Legato Marksman"),
            ("vibrato", "Vibrato-Schütze", "Vibrato Marksman"),
            ("glissando", "Glissando-Schütze", "Glissando Marksman"),
            ("arpeggio", "Arpeggio-Schütze", "Arpeggio Marksman"),
            ("fanfare", "Fanfare-Schütze", "Fanfare Marksman"),
            ("signal", "Signal-Schütze", "Signal Marksman"),
            ("fernchor", "Fernchor-Schütze", "Distant Choir Marksman"),
            ("scharfsinn", "Scharfsinn-Schütze", "Keen Marksman"),
            ("praezise", "Präzise-Schütze", "Precise Marksman"),
            ("fernfeuer", "Fernfeuer-Schütze", "Ranged Fire Marksman"),
            ("notenregen", "Notenregen-Schütze", "Note Rain Marksman"),
        ],
    },
}

PALETTES = [
    ("#5FF5E0", "#F5C95F"),
    ("#E03A8C", "#5FF5E0"),
    ("#4A6FA5", "#F5C95F"),
    ("#72A7FF", "#E03A8C"),
    ("#F5C95F", "#BFA7FF"),
    ("#61D095", "#4A6FA5"),
    ("#FF7A90", "#72A7FF"),
    ("#BFA7FF", "#5FF5E0"),
]

LOOT_TIERS = [
    ("aetherklang:klangstaub", 1, 3, "gewoehnlich"),
    ("aetherklang:resonanzbarren", 1, 2, "ungewoehnlich"),
    ("aetherklang:notenschluessel", 0, 1, "selten"),
    ("aetherklang:kaskadenkern", 0, 1, "episch"),
]

RELICS = [
    ("relikt_accelerando", "Accelerando", "Accelerando", "bewegung", 360, "uncommon", "minecraft:sugar"),
    ("relikt_adagio", "Adagio", "Adagio", "heilung", 520, "rare", "minecraft:ghast_tear"),
    ("relikt_arpeggio", "Arpeggio", "Arpeggio", "welle", 440, "uncommon", "minecraft:prismarine_crystals"),
    ("relikt_coda", "Coda", "Coda", "kadenz", 680, "epic", "minecraft:ender_eye"),
    ("relikt_dolce", "Dolce", "Dolce", "schutz", 500, "rare", "minecraft:honey_bottle"),
    ("relikt_fugato", "Fugato", "Fugato", "echo", 420, "rare", "minecraft:echo_shard"),
    ("relikt_glissando", "Glissando", "Glissando", "strahl", 400, "uncommon", "minecraft:feather"),
    ("relikt_marcato", "Marcato", "Marcato", "anschlag", 380, "rare", "minecraft:iron_axe"),
    ("relikt_nocturne", "Nocturne", "Nocturne", "feld", 560, "epic", "minecraft:phantom_membrane"),
    ("relikt_pizzicato", "Pizzicato", "Pizzicato", "impuls", 340, "uncommon", "minecraft:tripwire_hook"),
    ("relikt_rubato", "Rubato", "Rubato", "fermate", 600, "epic", "minecraft:clock"),
    ("relikt_vibrato", "Vibrato", "Vibrato", "halten", 460, "rare", "minecraft:goat_horn"),
]

ISLANDS = [
    ("bassgewoelbe", "Bassgewölbe", "Bass Vault"),
    ("arpeggien_garten", "Arpeggiengarten", "Arpeggio Garden"),
    ("kakophonie_riff", "Kakophonie-Riff", "Cacophony Reef"),
    ("kristallkranz", "Kristallkranz", "Crystal Crown"),
    ("resonanzhain", "Resonanzhain", "Resonance Grove"),
    ("generalpause_scholle", "Generalpause-Scholle", "Grand Pause Floe"),
    ("echo_terrassen", "Echo-Terrassen", "Echo Terraces"),
    ("takt_rondell", "Takt-Rondell", "Beat Roundel"),
    ("crescendo_spitze", "Crescendo-Spitze", "Crescendo Spire"),
    ("ostinato_steppe", "Ostinato-Steppe", "Ostinato Steppe"),
    ("legato_hain", "Legato-Hain", "Legato Grove"),
    ("staccato_klippen", "Staccato-Klippen", "Staccato Crags"),
    ("fermate_sanktuarium", "Fermaten-Sanktuarium", "Fermata Sanctum"),
    ("polyrhythmus_riff", "Polyrhythmus-Riff", "Polyrhythm Reef"),
    ("nocturne_atoll", "Nocturne-Atoll", "Nocturne Atoll"),
    ("kadenz_bastion", "Kadenz-Bastion", "Cadence Bastion"),
]

LEITMOTIV_TRANSLATIONS = [
    ("klingenrhythmus", "Klingenrhythmus", "Blade Rhythm",
     "Resonanzangriffe verursachen weitere 5 % mehr Schaden.",
     "Resonance attacks deal another 5% damage."),
    ("kritischer_nachhall", "Kritischer Nachhall", "Critical Echo",
     "Das PERFEKT-Fenster wird um 0,01 Taktphase erweitert.",
     "The PERFECT window grows by 0.01 beat phase."),
    ("schlagrefrain", "Schlagrefrain", "Striking Refrain",
     "Jeder positive RP-Gewinn gewährt einen weiteren RP.",
     "Every positive RP gain grants one more RP."),
    ("apotheose", "Apotheose", "Apotheosis",
     "Resonanzangriffe verursachen weitere 12,5 % mehr Schaden.",
     "Resonance attacks deal another 12.5% damage."),
    ("sanfte_resonanz", "Sanfte Resonanz", "Gentle Resonance",
     "Deine Resonanzheilung ist weitere 10 % stärker.",
     "Your resonance healing is another 10% stronger."),
    ("reine_kadenz", "Reine Kadenz", "Pure Cadence",
     "Dissonanz klingt weitere 25 % schneller ab.",
     "Dissonance fades another 25% faster."),
    ("tragender_akkord", "Tragender Akkord", "Sustaining Chord",
     "Dein maximales RP-Limit steigt um weitere 15.",
     "Your maximum RP rises by another 15."),
    ("ewiger_chor", "Ewiger Chor", "Eternal Choir",
     "Deine Resonanzheilung ist weitere 30 % stärker.",
     "Your resonance healing is another 30% stronger."),
    ("luftiger_pfad", "Luftiger Pfad", "Airy Path",
     "Resonanzschritte kosten einen weiteren RP weniger.",
     "Resonance dashes cost one less RP again."),
    ("ferne_harmonie", "Ferne Harmonie", "Distant Harmony",
     "Das GUT-Fenster wird um 0,015 Taktphase erweitert.",
     "The GOOD window grows by 0.015 beat phase."),
    ("wanderlied", "Wanderlied", "Wanderer's Song",
     "Jeder positive RP-Gewinn gewährt einen weiteren RP.",
     "Every positive RP gain grants one more RP."),
    ("grenzenlos", "Grenzenlos", "Boundless",
     "Dein maximales RP-Limit steigt um weitere 20.",
     "Your maximum RP rises by another 20."),
]


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def clear_prefixed(directory: Path, prefix: str) -> None:
    if not directory.exists():
        return
    for path in directory.glob(f"{prefix}*.json"):
        path.unlink()


def generate_variants(languages: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    all_variants: list[dict[str, Any]] = []
    motiv_directory = KLANGWERK / "motiv"
    clear_prefixed(motiv_directory, "mega_")

    for archetype, metadata in ARCHETYPE_DATA.items():
        path = CONTENT / "mobs" / f"motiv_{archetype}.json"
        document = load_json(path)
        base_variants = [
            variant for variant in document["variants"]
            if not variant["id"].startswith("mega_")
        ]
        generated_count = 25 - len(base_variants)
        generated: list[dict[str, Any]] = []
        for index, (slug, de_name, en_name) in enumerate(metadata["names"][:generated_count]):
            variant_id = f"mega_{archetype}_{slug}"
            name_key = f"entity.aetherklang.motiv_variant.{variant_id}"
            primary, secondary = PALETTES[(index + len(archetype)) % len(PALETTES)]
            loot, loot_min, loot_max, tier = LOOT_TIERS[index % len(LOOT_TIERS)]
            variant = {
                "id": variant_id,
                "name": name_key,
                "health": round(metadata["health"] + (index % 6) * 3.5 + index // 6 * 2.0, 1),
                "attack": round(metadata["attack"] + (index % 5) * 0.75, 2),
                "movement_speed": round(metadata["speed"] + ((index % 7) - 3) * 0.008, 3),
                "scale": round(metadata["scale"] + ((index % 5) - 2) * 0.045, 3),
                "primary_color": primary,
                "secondary_color": secondary,
                "loot": loot,
                "loot_min": loot_min,
                "loot_max": loot_max,
            }
            generated.append(variant)
            languages["de"][name_key] = de_name
            languages["en"][name_key] = en_name
            write_json(motiv_directory / f"{variant_id}.json", {
                "id": variant_id,
                "type": "motiv",
                "parameters": {
                    "archetype": archetype,
                    "operation": ["bewegung", "impuls", "welle"][index % 3],
                    "tempo": str(92 + index * 4 + len(archetype)),
                    "tier": tier,
                    "health": str(variant["health"]),
                    "attack": str(variant["attack"]),
                    "primary_color": primary,
                    "secondary_color": secondary,
                    "loot": loot,
                },
            })
        document["variants"] = base_variants + generated
        write_json(path, document)
        all_variants.extend(document["variants"])
    return all_variants


def generate_relics(languages: dict[str, dict[str, str]]) -> None:
    for relic_id, de_name, en_name, operation, cooldown, rarity, catalyst in RELICS:
        write_json(CONTENT / "relics" / f"{relic_id}.json", {
            "id": relic_id,
            "operation": operation,
            "cooldown_ticks": cooldown,
            "rarity": rarity,
        })
        write_json(KLANGWERK / "relikt" / f"{relic_id}.json", {
            "id": relic_id,
            "type": "relikt",
            "parameters": {
                "effect": operation,
                "cooldown_ticks": str(max(40, cooldown // 5)),
                "tier": rarity,
            },
        })
        write_json(ASSETS / "items" / f"{relic_id}.json", {
            "model": {
                "type": "minecraft:model",
                "model": f"aetherklang:item/{relic_id}",
            },
        })
        write_json(ASSETS / "models/item" / f"{relic_id}.json", {
            "parent": "minecraft:item/generated",
            "textures": {"layer0": catalyst.replace(":", ":item/")},
        })
        write_json(DATA / "recipe" / f"{relic_id}.json", {
            "type": "minecraft:crafting_shaped",
            "category": "misc",
            "pattern": [" A ", "GXG", " A "],
            "key": {
                "A": "minecraft:amethyst_shard",
                "G": "minecraft:gold_nugget",
                "X": catalyst,
            },
            "result": {"id": f"aetherklang:{relic_id}", "count": 1},
        })
        languages["de"][f"item.aetherklang.{relic_id}"] = f"Relikt: {de_name}"
        languages["en"][f"item.aetherklang.{relic_id}"] = f"Relic: {en_name}"


def generate_islands() -> None:
    clear_prefixed(KLANGWERK / "insel", "mega_")
    clear_prefixed(CONTENT / "islands", "mega_")
    for index, (island_id, _de_name, _en_name) in enumerate(ISLANDS):
        generated_id = f"mega_insel_{island_id}"
        angle = math.tau * index / len(ISLANDS)
        anchor_x = round(math.cos(angle) * 900)
        anchor_z = round(math.sin(angle) * 900)
        write_json(CONTENT / "islands" / f"{generated_id}.json", {
            "id": generated_id,
            "region": island_id,
            "anchor_x": anchor_x,
            "anchor_y": 124 + index % 9,
            "anchor_z": anchor_z,
        })
        write_json(KLANGWERK / "insel" / f"{generated_id}.json", {
            "id": generated_id,
            "type": "insel",
            "parameters": {
                "archetype": island_id,
                "radius": str(8 + index % 6),
                "height": str(5 + index % 5),
                "palette": str(index % len(PALETTES)),
            },
        })


def generate_contracts(languages: dict[str, dict[str, str]]) -> None:
    directory = KLANGWERK / "auftrag"
    clear_prefixed(directory, "mega_")
    objectives = [
        ("kill_motiv", "any", "Motivjagd", "Motif Hunt", "Besiege {amount} Motivwesen.", "Defeat {amount} Motif creatures."),
        ("kill_motiv", "motiv_laeufer", "Läuferpartitur", "Runner Score", "Besiege {amount} Motiv-Läufer.", "Defeat {amount} Motif Runners."),
        ("kill_motiv", "motiv_schwinge", "Schwingenpartitur", "Wing Score", "Besiege {amount} Motiv-Schwingen.", "Defeat {amount} Motif Wings."),
        ("kill_motiv", "motiv_pulser", "Pulspartitur", "Pulse Score", "Besiege {amount} Motiv-Pulser.", "Defeat {amount} Motif Pulsers."),
        ("kill_motiv", "motiv_koloss", "Kolosspartitur", "Colossus Score", "Besiege {amount} Motiv-Kolosse.", "Defeat {amount} Motif Colossi."),
        ("kill_motiv", "motiv_weber", "Weberpartitur", "Weaver Score", "Besiege {amount} Motiv-Weber.", "Defeat {amount} Motif Weavers."),
        ("kill_motiv", "motiv_schuetze", "Schützenpartitur", "Marksman Score", "Besiege {amount} Motiv-Schützen.", "Defeat {amount} Motif Marksmen."),
        ("play_akkord", "any", "Akkordstudie", "Chord Study", "Spiele {amount} beliebige Akkorde.", "Play {amount} chords."),
        ("visit_region", "kammerton", "Kammertonreise", "Concert Pitch Journey", "Betritt den Kammerton {amount}-mal.", "Enter Concert Pitch {amount} times."),
        ("visit_region", "resonanzgarten", "Gartenrunde", "Garden Circuit", "Besuche den Resonanzgarten {amount}-mal.", "Visit the Resonance Garden {amount} times."),
        ("visit_region", "fermatenring", "Fermatenring", "Fermata Ring", "Erkunde den Fermatenring {amount}-mal.", "Explore the Fermata Ring {amount} times."),
        ("seal_rift", "any", "Risswache", "Rift Watch", "Versiegle {amount} Dissonanzrisse.", "Seal {amount} dissonance rifts."),
        ("earn_resonance", "any", "Resonanzernte", "Resonance Harvest", "Sammle {amount} RP.", "Earn {amount} RP."),
    ]
    rewards = [
        "aetherklang:klangstaub",
        "aetherklang:resonanzbarren",
        "aetherklang:notenschluessel",
        "aetherklang:kaskadenkern",
    ]
    for index in range(69):
        contract_id = f"mega_auftrag_{index + 1:02d}"
        objective, target, de_title, en_title, de_template, en_template = objectives[index % len(objectives)]
        amount = 2 + index % 7
        if objective == "earn_resonance":
            amount = 40 + index * 5
        title_key = f"partitur.aetherklang.contract.{contract_id}.title"
        description_key = f"partitur.aetherklang.contract.{contract_id}.description"
        languages["de"][title_key] = f"{de_title} {index + 1}"
        languages["en"][title_key] = f"{en_title} {index + 1}"
        languages["de"][description_key] = de_template.format(amount=amount)
        languages["en"][description_key] = en_template.format(amount=amount)
        write_json(directory / f"{contract_id}.json", {
            "id": contract_id,
            "type": "auftrag",
            "parameters": {
                "title": title_key,
                "description": description_key,
                "objective": objective,
                "target": target,
                "amount": str(amount),
                "reward_rp": str(6 + index % 13),
                "reward_notenschluessel": str(1 + index % 3),
                "reward_material": rewards[index % len(rewards)],
                "reward_material_count": str(1 + index % 4),
            },
        })


def generate_recipes() -> None:
    directory = DATA / "recipe"
    clear_prefixed(directory, "mega_resonanz_rezept_")
    ingredients = [
        "minecraft:amethyst_shard",
        "minecraft:redstone",
        "minecraft:quartz",
        "minecraft:copper_ingot",
        "minecraft:iron_nugget",
        "minecraft:gold_nugget",
        "minecraft:lapis_lazuli",
        "minecraft:glowstone_dust",
        "minecraft:prismarine_shard",
        "minecraft:echo_shard",
        "minecraft:flint",
        "minecraft:clay_ball",
        "minecraft:string",
        "minecraft:feather",
        "minecraft:bone_meal",
    ]
    outputs = [
        "aetherklang:klangstaub",
        "aetherklang:resonanzbarren",
        "aetherklang:notenschluessel",
        "aetherklang:kaskadenkern",
        "aetherklang:tremolokern",
        "aetherklang:saitenherz",
        "aetherklang:schwarmauge",
        "aetherklang:stillesplitter",
    ]
    for index in range(60):
        first = ingredients[index % len(ingredients)]
        second = ingredients[(index * 7 + 3) % len(ingredients)]
        third = ingredients[(index * 11 + 5) % len(ingredients)]
        recipe_ingredients = [first, second]
        if index % 3 == 0:
            recipe_ingredients.append(third)
        write_json(directory / f"mega_resonanz_rezept_{index + 1:02d}.json", {
            "type": "minecraft:crafting_shapeless",
            "category": "misc",
            "ingredients": recipe_ingredients,
            "result": {
                "id": outputs[index % len(outputs)],
                "count": 1 + index % 3,
            },
        })


def generate_advancements(languages: dict[str, dict[str, str]]) -> None:
    directory = DATA / "advancement/sinfonie"
    clear_prefixed(directory, "mega_meilenstein_")
    icons = [f"aetherklang:{relic[0]}" for relic in RELICS] + [
        "aetherklang:klangstaub",
        "aetherklang:resonanzbarren",
        "aetherklang:notenschluessel",
        "aetherklang:kaskadenkern",
        "aetherklang:tremolokern",
        "aetherklang:saitenherz",
        "aetherklang:schwarmauge",
        "aetherklang:stillesplitter",
        "aetherklang:pauke",
        "aetherklang:sopranfloete",
        "aetherklang:kontrabass",
        "aetherklang:triangel",
    ]
    themes = [
        ("Resonanzsammlung", "Resonance Collection"),
        ("Klangwerkstudie", "Soundwork Study"),
        ("Inselpartitur", "Island Score"),
        ("Motivarchiv", "Motif Archive"),
        ("Kadenzprobe", "Cadence Trial"),
    ]
    for index in range(124):
        advancement_id = f"mega_meilenstein_{index + 1:02d}"
        icon = icons[index % len(icons)]
        de_theme, en_theme = themes[index % len(themes)]
        title_key = f"advancements.aetherklang.sinfonie.{advancement_id}.title"
        description_key = f"advancements.aetherklang.sinfonie.{advancement_id}.description"
        languages["de"][title_key] = f"{de_theme} {index + 1}"
        languages["en"][title_key] = f"{en_theme} {index + 1}"
        languages["de"][description_key] = f"Nimm {icon.split(':')[1].replace('_', ' ')} in dein Inventar auf."
        languages["en"][description_key] = f"Collect {icon.split(':')[1].replace('_', ' ')} in your inventory."
        write_json(directory / f"{advancement_id}.json", {
            "criteria": {
                "requirement": {
                    "trigger": "minecraft:inventory_changed",
                    "conditions": {"items": [{"items": icon}]},
                },
            },
            "display": {
                "icon": {"count": 1, "id": icon},
                "title": {"translate": title_key},
                "description": {"translate": description_key},
                "frame": ["task", "goal", "challenge"][index % 3],
                "show_toast": True,
                "announce_to_chat": index % 3 == 2,
                "hidden": False,
            },
            "requirements": [["requirement"]],
            "sends_telemetry_event": False,
            "parent": "aetherklang:sinfonie/root",
        })


def generate_folios(all_variants: list[dict[str, Any]], languages: dict[str, dict[str, str]]) -> None:
    path = ASSETS / "kodex/pages.json"
    document = load_json(path)
    base_pages = [page for page in document["pages"] if not page["id"].startswith("mega_")]
    topics: list[tuple[str, str, str, str, str, str]] = []

    for variant in all_variants:
        variant_id = variant["id"]
        archetype = next(name for name in ARCHETYPE_DATA if f"_{name}_" in f"_{variant_id}_")
        name_value = variant["name"]
        de_name = languages["de"].get(name_value, name_value)
        en_name = languages["en"].get(name_value, name_value)
        topics.append((
            f"mega_folio_{variant_id}",
            "motive",
            de_name,
            en_name,
            f"{de_name} trägt die Farben {variant['primary_color']} und {variant['secondary_color']} durch den Klangmeer-Takt.",
            f"{en_name} carries {variant['primary_color']} and {variant['secondary_color']} through the Klangmeer beat.",
        ))

    for relic_id, de_name, en_name, operation, cooldown, rarity, _catalyst in RELICS:
        topics.append((
            f"mega_folio_{relic_id}",
            "schmiede",
            f"Relikt: {de_name}",
            f"Relic: {en_name}",
            f"Dieses {rarity}-Relikt bündelt die Klangoperation {operation} und ruht {cooldown} Ticks zwischen Resonanzen.",
            f"This {rarity} relic channels the {operation} sound operation and rests {cooldown} ticks between resonances.",
        ))

    for island_id, de_name, en_name in ISLANDS[:15]:
        topics.append((
            f"mega_folio_insel_{island_id}",
            "regionen",
            de_name,
            en_name,
            f"{de_name} ist eine von sechzehn Inselstimmen im inneren Gürtel aus {INNER_ISLAND_COUNT} schwebenden Partiturfragmenten.",
            f"{en_name} is one of sixteen island voices in the inner belt of {INNER_ISLAND_COUNT} floating score fragments.",
        ))

    topics.append((
        "mega_folio_fermatenring",
        "regionen",
        "Fermatenring",
        "Fermata Ring",
        f"Der Fermatenring umschließt {FERMATENRING_ISLAND_COUNT} äußere Inseln zwischen 1300 und 2100 Blöcken vom Zentrum.",
        f"The Fermata Ring wraps {FERMATENRING_ISLAND_COUNT} outer islands between 1300 and 2100 blocks from center.",
    ))

    required = max(0, 250 - len(base_pages))
    generated_pages = []
    for page_id, category, de_title, en_title, de_body, en_body in topics[:required]:
        key = f"kodex.aetherklang.page.{page_id}"
        generated_pages.append({
            "id": page_id,
            "category": category,
            "title": f"{key}.title",
            "subtitle": f"{key}.subtitle",
            "body": [f"{key}.body.1", f"{key}.body.2"],
            "always_unlocked": True,
            "status": "playable",
        })
        languages["de"][f"{key}.title"] = de_title
        languages["en"][f"{key}.title"] = en_title
        languages["de"][f"{key}.subtitle"] = "Archivierte Sinfonie-Stimme"
        languages["en"][f"{key}.subtitle"] = "Archived symphonic voice"
        languages["de"][f"{key}.body.1"] = de_body
        languages["en"][f"{key}.body.1"] = en_body
        languages["de"][f"{key}.body.2"] = "Beobachte Palette, Rhythmus und Beute; jede Begegnung verlangt eine andere Antwort im Takt."
        languages["en"][f"{key}.body.2"] = "Study palette, rhythm, and loot; every encounter asks for a different on-beat answer."
    document["pages"] = base_pages + generated_pages
    write_json(path, document)


def add_leitmotiv_translations(languages: dict[str, dict[str, str]]) -> None:
    for node_id, de_title, en_title, de_description, en_description in LEITMOTIV_TRANSLATIONS:
        key = f"leitmotiv.aetherklang.node.{node_id}"
        languages["de"][key] = de_title
        languages["en"][key] = en_title
        languages["de"][f"{key}.description"] = de_description
        languages["en"][f"{key}.description"] = en_description


def clean_generated_language(languages: dict[str, dict[str, str]]) -> None:
    prefixes = (
        "entity.aetherklang.motiv_variant.mega_",
        "kodex.aetherklang.page.mega_",
        "partitur.aetherklang.contract.mega_",
        "advancements.aetherklang.sinfonie.mega_",
    )
    exact_prefixes = tuple(f"leitmotiv.aetherklang.node.{node[0]}" for node in LEITMOTIV_TRANSLATIONS)
    for language in languages.values():
        for key in list(language):
            if key.startswith(prefixes) or key.startswith(exact_prefixes):
                del language[key]


def count_files(directory: Path) -> int:
    return sum(1 for _path in directory.glob("*.json"))


def validate_generated(all_variants: list[dict[str, Any]], languages: dict[str, dict[str, str]]) -> None:
    variant_ids = [variant["id"] for variant in all_variants]
    if len(variant_ids) < 150 or len(variant_ids) != len(set(variant_ids)):
        raise ValueError("Motiv variants must provide at least 150 unique ids")
    if any(variant["name"] not in languages["de"] or variant["name"] not in languages["en"]
           for variant in all_variants if variant["id"].startswith("mega_")):
        raise ValueError("Every generated Motiv name must exist in de_de and en_us")

    targets = {
        "Kodex folios": (len(load_json(ASSETS / "kodex/pages.json")["pages"]), 250),
        "relics": (count_files(CONTENT / "relics"), 24),
        "contracts": (count_files(KLANGWERK / "auftrag"), 80),
        "Sinfonie advancements": (count_files(DATA / "advancement/sinfonie"), 150),
        "recipes": (count_files(DATA / "recipe"), 120),
    }
    for label, (actual, minimum) in targets.items():
        if actual < minimum:
            raise ValueError(f"Expected at least {minimum} {label}, got {actual}")

    generated_keys = {
        key for key in languages["de"]
        if ".mega_" in key or key.startswith("entity.aetherklang.motiv_variant.mega_")
    }
    missing_english = generated_keys.difference(languages["en"])
    if missing_english:
        raise ValueError(f"Missing en_us translations for {sorted(missing_english)[:5]}")


def main() -> None:
    languages = {code: load_json(path) for code, path in LANG_PATHS.items()}
    clean_generated_language(languages)
    all_variants = generate_variants(languages)
    generate_relics(languages)
    generate_islands()
    generate_contracts(languages)
    generate_recipes()
    generate_advancements(languages)
    generate_folios(all_variants, languages)
    add_leitmotiv_translations(languages)
    for code, path in LANG_PATHS.items():
        write_json(path, languages[code])
    validate_generated(all_variants, languages)

    pages = load_json(ASSETS / "kodex/pages.json")["pages"]
    print(
        "Generated Sinfonie content:",
        f"{len(all_variants)} Motiv variants,",
        f"{len(pages)} Kodex folios,",
        f"{count_files(CONTENT / 'relics')} relics,",
        f"{count_files(KLANGWERK / 'auftrag')} contracts,",
        f"{count_files(DATA / 'advancement/sinfonie')} Sinfonie advancements,",
        f"{count_files(DATA / 'recipe')} recipes.",
    )


if __name__ == "__main__":
    main()
