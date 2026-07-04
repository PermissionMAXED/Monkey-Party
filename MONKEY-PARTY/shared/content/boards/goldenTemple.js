/**
 * Board 5: Golden Temple (difficulty 4).
 *
 * A three-tiered golden ziggurat. The star lives at the temple top and
 * only one of the three stairways is open each round (the other two are
 * blocked). The guardian demands a toll or knocks trespassers off the
 * temple. Cursed idols tempt the greedy.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers, takeItem } from './index.js';

const g = graph();

/* --- base ring: 26 nodes ---------------------------------------------- */
const ringPos = circle(26, 17, { y: 0.5 });
const ring = g.run(
  seq('gt_m', 26),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue']),
);
g.link(ring[25], ring[0]);
g.setType('gt_m00', 'start');

/* --- terrace loop: 10 nodes at mid height ------------------------------ */
const terrace = g.run(
  seq('gt_t', 10),
  circle(10, 9, { y: 4.2 }),
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue', 'blue', 'red', 'blue', 'blue']),
);
g.link(terrace[9], terrace[0]);

/* --- top loop: 6 nodes around the star shrine -------------------------- */
const top = g.run(
  seq('gt_p', 6),
  circle(6, 4.5, { y: 8.2 }),
  cycle(['blue', 'red', 'blue', 'blue', 'blue', 'red']),
);
g.link(top[5], top[0]);

/* --- three rotating stairways: ring -> terrace -------------------------- */
const SA = g.run(seq('gt_sa', 3), alongPath([[ringPos(4)[0] * 0.85, 1.4, ringPos(4)[2] * 0.85], [8.0, 3.2, -4.0]], 3), 'special');
const SB = g.run(seq('gt_sb', 3), alongPath([[ringPos(13)[0] * 0.85, 1.4, ringPos(13)[2] * 0.85], [-4.5, 3.2, 7.0]], 3), 'special');
const SC = g.run(seq('gt_sc', 3), alongPath([[ringPos(21)[0] * 0.85, 1.4, ringPos(21)[2] * 0.85], [-7.5, 3.2, -4.5]], 3), 'special');
g.setType('gt_m04', 'junction');
g.setType('gt_m13', 'junction');
g.setType('gt_m21', 'junction');
g.link('gt_m04', SA[0]);
g.link(SA[2], 'gt_t00');
g.link('gt_m13', SB[0]);
g.link(SB[2], 'gt_t03');
g.link('gt_m21', SC[0]);
g.link(SC[2], 'gt_t07');

/* --- summit stair: terrace -> top, plus slides back down ---------------- */
const UP = g.run(seq('gt_u', 3), alongPath([[7.2, 5.2, 2.0], [3.8, 7.4, 1.0]], 3), 'special');
g.setType('gt_t05', 'junction');
g.link('gt_t05', UP[0]);
g.link(UP[2], 'gt_p00');
/* Slides: terrace t08 -> ring m24, top p05 -> ring m17 (shortcut down). */
g.setType('gt_t08', 'junction');
g.link('gt_t08', 'gt_m24');
g.setType('gt_p05', 'junction');
g.link('gt_p05', 'gt_m17');

/* --- landmarks ----------------------------------------------------------- */
g.setType('gt_p02', 'star');
g.setType('gt_p04', 'star');
g.setType('gt_t06', 'star');
g.setType('gt_m09', 'shop');
g.setType('gt_t01', 'shop');
g.setType('gt_t04', 'boss');

g.setEvent('gt_m06', 'riddle');
g.setEvent('gt_m11', 'blessing');
g.setEvent('gt_m18', 'cursed_idol');
g.setEvent('gt_m24', 'incense');
g.setEvent('gt_t02', 'trap_door');
g.setEvent('gt_t09', 'cursed_idol');
g.setEvent('gt_p01', 'blessing');
g.setEvent('gt_p03', 'trap_door');

const nodes = g.build();
const nav = makeNav(nodes);
const UPPER = new Set([...terrace, ...top, ...SA, ...SB, ...SC, ...UP]);
const STAIR_SETS = [SA.slice(), SB.slice(), SC.slice()];

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'golden_temple',
  name: loc('Golden Temple', 'Goldener Tempel'),
  description: loc(
    'The star waits at the temple top - but only one of three stairways is open each round, and the guardian charges a toll.',
    'Der Stern wartet auf der Tempelspitze - aber jede Runde ist nur eine von drei Treppen offen, und der Wächter verlangt Wegzoll.',
  ),
  difficulty: 4,
  theme: {
    sky: '#ffdd99',
    fog: { color: '#f2d59a', near: 30, far: 95 },
    ambient: '#f7e3b0',
    palette: { primary: '#ffd23f', secondary: '#a67c00', accent: '#e5484d' },
  },
  music: { tempo: 88, scale: 'harmonic minor', pattern: [0, 2, 3, 6, 7, 6, 3, 2] },
  nodes,
  starSpawns: ['gt_p02', 'gt_p04', 'gt_t06'],
  shops: [
    { node: 'gt_m09', stock: ['double_dice', 'turbo_banana', 'banana_peel', 'shop_coupon', 'shield_shell'] },
    { node: 'gt_t01', stock: ['lucky_mask', 'swap_totem', 'golden_ticket', 'mini_gorilla', 'dice_curse'] },
  ],
  events: {
    cursed_idol: {
      description: loc('A golden idol! Take it... and pay the curse.', 'Ein goldenes Götzenbild! Nimm es ... und zahle den Fluch.'),
      handler(sim, playerId) {
        const items = sim.state?.players?.[playerId]?.items ?? [];
        if (items.length > 0 && sim.rng.next() < 0.5) {
          const lost = takeItem(sim, playerId, sim.rng.int(0, items.length - 1));
          sim.emit('field', { board: 'golden_temple', event: 'cursed_idol', playerId, lost });
        } else {
          sim.coins(playerId, -8);
        }
        sim.coins(playerId, 12);
      },
    },
    blessing: {
      description: loc('The temple spirits bless your pouch.', 'Die Tempelgeister segnen deinen Beutel.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(5, 10));
      },
    },
    trap_door: {
      description: loc('A trap door drops you back to the base of the temple.', 'Eine Falltür lässt dich zurück zum Tempelfuß stürzen.'),
      handler(sim, playerId) {
        sim.teleport(playerId, 'gt_m10');
        sim.emit('field', { board: 'golden_temple', event: 'trap_door', playerId, target: 'gt_m10' });
      },
    },
    incense: {
      description: loc('Fragrant incense reveals a hidden item.', 'Duftender Weihrauch enthüllt einen versteckten Gegenstand.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'random');
      },
    },
    riddle: {
      description: loc('A sphinx-monkey poses a riddle. Answer wisely.', 'Ein Sphinx-Affe stellt ein Rätsel. Antworte weise.'),
      handler(sim, playerId) {
        const solved = sim.rng.next() < 0.5;
        sim.coins(playerId, solved ? 8 : -4);
        sim.emit('field', { board: 'golden_temple', event: 'riddle', playerId, solved });
      },
    },
  },
  mechanics: [
    {
      id: 'gt_rotating_stairs',
      everyRounds: 1,
      initialState: { open: 0, stairways: STAIR_SETS.map((s) => s.slice()) },
      onRoundStart(sim, state) {
        state.open = (state.open + 1) % STAIR_SETS.length;
        const blocked = [];
        for (let i = 0; i < STAIR_SETS.length; i += 1) {
          if (i !== state.open) blocked.push(...STAIR_SETS[i]);
        }
        sim.blockNodes(blocked, 1);
        sim.emit('mechanic', {
          board: 'golden_temple',
          mechanic: 'gt_rotating_stairs',
          open: state.open,
          blocked,
        });
      },
    },
  ],
  bossEvent: {
    id: 'gt_guardian',
    everyRounds: 4,
    handler(sim) {
      const judged = [];
      for (const pid of allPlayers(sim)) {
        if (!UPPER.has(nav.playerNode(sim, pid))) continue;
        const coins = sim.state?.players?.[pid]?.coins ?? 0;
        if (coins >= 5) {
          sim.coins(pid, -5);
          judged.push({ playerId: pid, paid: true });
        } else {
          sim.teleport(pid, 'gt_m00');
          judged.push({ playerId: pid, paid: false });
        }
      }
      sim.emit('boss', { board: 'golden_temple', boss: 'gt_guardian', judged });
    },
  },
  view: { kind: 'board3d', builder: 'golden_temple' },
};

export default def;
