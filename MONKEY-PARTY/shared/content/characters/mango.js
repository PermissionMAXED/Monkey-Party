/**
 * Mango - proboscis monkey, unlock 20 bananas. Perk "sniffer": that huge
 * nose smells danger - trap nodes are revealed to him.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 * This is a knowledge perk: no sim hooks. The UI/AI reads
 * perk.reveal.traps to show placed traps and built-in trap nodes to
 * Mango's seat (other players see nothing).
 */

/** @type {import('../../types.js').CharacterDef} */
export default {
  id: 'mango',
  name: 'Mango',
  species: 'proboscis',
  blurb: {
    en: 'His nose arrives a full second before he does. It smells traps.',
    de: 'Seine Nase kommt eine Sekunde vor ihm an. Sie riecht Fallen.',
  },
  build: {
    scale: 1.3,
    furColor: '#d98e4a',
    faceColor: '#e8b184',
    bellyColor: '#f0d0a8',
    earStyle: 'small',
    tail: 'long',
    snout: 'cone',
    brow: 'soft',
    armLen: 1.0,
    potbelly: 0.7,
  },
  perk: {
    id: 'sniffer',
    description: {
      en: 'Sniffer: Mango sees trap nodes on the board.',
      de: 'Schnueffler: Mango sieht Fallenfelder auf dem Brett.',
    },
    /** UI flag: reveal placed traps + built-in trap nodes to this player. */
    reveal: { traps: true },
    hooks: {},
  },
  voice: { pitch: 0.85, style: 'nasal' },
  emotes: ['laugh', 'facepalm', 'dance'],
  unlock: { bananas: 20 },
};
