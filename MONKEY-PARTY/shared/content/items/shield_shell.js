/**
 * Shield Shell - passive: while held, blocks the next trap or coin/item
 * steal against you, then breaks.
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * The blocking itself lives in the sim (sim.tryBlockWithShield consumes the
 * shell on placed traps, built-in board traps, and steals).
 */

/** @type {import('../../types.js').ItemDef} */
export default {
  id: 'shield_shell',
  name: { en: 'Shield Shell', de: 'Schutzpanzer' },
  description: {
    en: 'Passive: blocks the next trap or steal aimed at you, then shatters.',
    de: 'Passiv: Blockt die naechste Falle oder den naechsten Diebstahl gegen dich, dann zerbricht er.',
  },
  price: 10,
  rarity: 'rare',
  phase: 'passive',
  target: 'none',
  competitiveSafe: true,
  icon: { bg: '#0e7490', glyph: 'shell', fg: '#cffafe' },
  /** Passive items are never actively used; effect is a no-op safeguard. */
  effect() {},
};
