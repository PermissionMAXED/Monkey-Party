#!/usr/bin/env python3
"""park_gen_sfx.py — Funkelpark-Foley (G6 Audio-Feel-Welle).

Die vier Fahrgeschäfte des Funkelparks (REST-4) waren komplett stumm.
Synthese im Stil der foley/-Familie (numpy, Bausteine aus ef2_gen_sfx.py),
alle Quelldateien Peak −6 dBFS (AUDIO-GRAMMATIK: ≤ −1 dBFS Pflicht):

  foley/park_coaster_loop.ogg    — Ketten-Rattern + Schienen-Rumpeln
                                   (zirkulär -> nahtlos loopbar), Achterbahn
  foley/park_coaster_whoosh.ogg  — Fahrtwind-Whoosh für Sturzflug/Looping
  foley/park_wheel_loop.ogg      — Riesenrad: tiefes Motor-Brummen + Knarzen
  foley/park_karussell_loop.ogg  — Spieluhr-Walzer (3/4, pentatonisch C-Dur,
                                   ganze Takte -> nahtlos loopbar)
  foley/park_scooter_bump.ogg    — Autoscooter: Gummiwulst-Boing

volume_db-Trims stehen in sfx_map.gd (Ziel: Loops als Betten ~−28 dBFS eff.,
One-Shots auf der Effekt-Ebene ~−22 dBFS eff.). Nach jedem Lauf:
  python3 tools/audio/ef2_manifest.py   (Fixture, sonst reißt
  tests/unit/test_ef2_audio_levels.gd).

Aufruf: python3 tools/audio/park_gen_sfx.py
"""

import importlib.util
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "ef2_gen_sfx", os.path.join(HERE, "ef2_gen_sfx.py"))
ef2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ef2)

SR = ef2.SR
SFX = ef2.SFX
PEAK_DB = -6.0


def gen_coaster_loop():
    # 2,4 s: dunkles Schienen-Rumpeln + Ketten-Klacks im 12-Hz-Raster.
    # Rumpeln zirkulär (ifft) und Klack-Raster mit ganzzahliger Anzahl
    # im Fenster -> loopt knackfrei.
    dur = 2.4
    n = int(dur * SR)
    rumble = ef2._shaped_noise(n, lambda f: 1.0 / (1.0 + (f / 140.0) ** 1.8), 60)
    t = np.arange(n) / SR
    wob = 1.0 + 0.22 * np.sin(2 * math.pi * (5.0 / dur) * t)
    sig = rumble * wob
    clack_src = ef2._shaped_noise(n, lambda f: np.exp(-((f - 2000.0) / 900.0) ** 2), 61)
    rate = 12.0  # Klacks/s — 12*2,4 s = ganzzahlig, Raster loopt sauber.
    gate = np.clip(np.sin(2 * math.pi * rate * t), 0.0, 1.0) ** 12
    sig += 0.16 * clack_src * gate
    return ef2._norm_peak(sig, PEAK_DB)


def gen_coaster_whoosh():
    # 0,7 s Fahrtwind: Band wandert hell -> dunkel, weiche Sinus-Hüllkurve.
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    u = t / (n / SR)
    low = ef2._shaped_noise(n, lambda f: np.exp(-((f - 420.0) / 300.0) ** 2), 62)
    high = ef2._shaped_noise(n, lambda f: np.exp(-((f - 1400.0) / 700.0) ** 2), 63)
    sig = high * (1.0 - u) ** 1.3 + low * (0.35 + 0.65 * u)
    sig *= np.sin(math.pi * u) ** 1.2
    return ef2._norm_peak(sig, PEAK_DB)


def gen_wheel_loop():
    # 3,2 s Riesenrad: 55-Hz-Motorbrumm (+ Oktave) mit langsamem Wobble
    # (ganzzahlige Zyklen) + zirkuläres Lager-Rauschen + 2 weiche Knarzer.
    dur = 3.2
    n = int(dur * SR)
    t = np.arange(n) / SR
    hum = (np.sin(2 * math.pi * 55.0 * t) * 0.7
           + np.sin(2 * math.pi * 110.0 * t) * 0.3)
    hum *= 1.0 + 0.15 * np.sin(2 * math.pi * (2.0 / dur) * t)
    air = ef2._shaped_noise(n, lambda f: 1.0 / (1.0 + (f / 300.0) ** 2), 64)
    sig = hum * 0.55 + air * 0.45
    creak_src = ef2._shaped_noise(
        n, lambda f: np.exp(-((f - 900.0) / 350.0) ** 2), 65)
    for onset, laenge in ((0.6, 0.28), (2.1, 0.22)):
        i0 = int(onset * SR)
        m = int(laenge * SR)
        sig[i0: i0 + m] += 0.28 * creak_src[i0: i0 + m] * ef2._env(m, 0.05, 0.1)
    return ef2._norm_peak(sig, PEAK_DB)


def gen_karussell_loop():
    # 4,8 s Spieluhr-Walzer: 8 Takte à 3 Schlägen (Tempo 5 Schläge/s),
    # Bass auf 1, Melodie pentatonisch C-Dur — endet exakt am Fensterrand,
    # Ausklang-Tau kurz genug, dass die Naht unauffällig bleibt.
    dur = 4.8
    beat = 0.2
    c_dur = [523.25, 587.33, 659.26, 783.99, 880.0, 1046.5]  # C5-Pentatonik
    melodie = [2, 4, 3, 2, 0, 1, 2, 5, 4, 3, 1, 0, 2, 3, 4, 1, 2, 0, 3, 2, 1, 4, 2, 0]
    notes = []
    for i, idx in enumerate(melodie):
        onset = i * beat
        notes.append((c_dur[idx], 0.8, onset, 0.10))
        notes.append((c_dur[idx] * 2.0, 0.12, onset, 0.05))  # Glockenpartial
        if i % 3 == 0:  # Walzer-Bass auf der 1
            notes.append((c_dur[idx] / 4.0, 0.5, onset, 0.16))
    sig = ef2._pluck(notes, dur)
    n = sig.size
    # sanftes Vibrato-Schimmern (ganzzahlige Zyklen -> loop-sicher).
    t = np.arange(n) / SR
    sig *= 1.0 + 0.06 * np.sin(2 * math.pi * (6.0 / dur) * t)
    return ef2._norm_peak(sig, PEAK_DB)


def gen_scooter_bump():
    # 0,22 s Gummiwulst-Boing: runder Pitch-Fall + gedämpfter Federton.
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    body = ef2._sweep(230.0, 130.0, n) * np.exp(-t / 0.06)
    spring = np.sin(2 * math.pi * 340.0 * t) * np.exp(-t / 0.045)
    thud = ef2._fft_lowpass(np.random.default_rng(66).standard_normal(n), 700.0)
    thud *= np.exp(-t / 0.02)
    sig = body + 0.35 * spring + 0.20 * thud / max(np.abs(thud).max(), 1e-12)
    sig *= ef2._env(n, 0.004, 0.05)
    return ef2._norm_peak(sig, PEAK_DB)


def main():
    gens = {
        "foley/park_coaster_loop.ogg": gen_coaster_loop,
        "foley/park_coaster_whoosh.ogg": gen_coaster_whoosh,
        "foley/park_wheel_loop.ogg": gen_wheel_loop,
        "foley/park_karussell_loop.ogg": gen_karussell_loop,
        "foley/park_scooter_bump.ogg": gen_scooter_bump,
    }
    for rel, fn in gens.items():
        sig = fn()
        ef2.encode_ogg(os.path.join(SFX, rel), sig, SR)
        ef2.report_line("gen ", rel, sig)


if __name__ == "__main__":
    sys.exit(main())
