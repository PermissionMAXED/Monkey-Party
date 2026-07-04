/**
 * Board 7: Underwater Reef (difficulty 3).
 *
 * A sunken reef with an air-bubble economy. Signature mechanic: the water
 * level toggles every 2 rounds, alternately blocking the shallow shelf or
 * the deep trench. One-way current tunnels shoot players across the reef.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- reef ring: 28 nodes ----------------------------------------------- */
const ringPos = circle(28, 17, { y: (i, t) => 1.2 + Math.sin(t * Math.PI * 4) * 0.8 });
const ring = g.run(
  seq('ur_m', 28),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue']),
);
g.link(ring[27], ring[0]);
g.setType('ur_m00', 'start');

/* --- loop A: sunlit shelf (m04 -> m11), shallow zone --------------------- */
const pa = ringPos(4);
const pb = ringPos(11);
const SHELF = g.run(
  seq('ur_a', 7),
  alongPath([
    [pa[0] * 0.72, 4.0, pa[2] * 0.72],
    [4.5, 4.8, -5.0],
    [pb[0] * 0.72, 4.0, pb[2] * 0.72],
  ], 7),
  cycle(['blue', 'blue', 'red', 'item', 'blue', 'blue', 'blue']),
);
g.setType('ur_m04', 'junction');
g.link('ur_m04', SHELF[0]);
g.link(SHELF[6], 'ur_m11');

/* --- loop B: dark trench (m15 -> m22), deep zone -------------------------- */
const pc = ringPos(15);
const pd = ringPos(22);
const TRENCH = g.run(
  seq('ur_b', 7),
  alongPath([
    [pc[0] * 0.75, -2.0, pc[2] * 0.75],
    [-4.0, -2.8, 5.5],
    [pd[0] * 0.75, -2.0, pd[2] * 0.75],
  ], 7),
  cycle(['red', 'blue', 'blue', 'item', 'blue', 'trap', 'blue']),
);
g.setType('ur_m15', 'junction');
g.link('ur_m15', TRENCH[0]);
g.link(TRENCH[6], 'ur_m22');

/* --- shortcut: one-way current tunnel (m24 -> m10) ------------------------ */
const pe = ringPos(24);
const pf = ringPos(10);
const TUNNEL = g.run(
  seq('ur_c', 5),
  alongPath([
    [pe[0] * 0.65, 0.6, pe[2] * 0.65],
    [0, 0.2, 0],
    [pf[0] * 0.65, 0.6, pf[2] * 0.65],
  ], 5),
  'special',
);
g.setType('ur_m24', 'junction');
g.link('ur_m24', TUNNEL[0]);
g.link(TUNNEL[4], 'ur_m10');

/* --- spur: bubble garden (m07 -> m09) -------------------------------------- */
const GARDEN = g.run(
  seq('ur_g', 3),
  alongPath([
    [ringPos(7)[0] * 0.78, 2.4, ringPos(7)[2] * 0.78],
    [ringPos(9)[0] * 0.78, 2.6, ringPos(9)[2] * 0.78],
  ], 3),
  cycle(['blue', 'blue', 'blue']),
);
g.setType('ur_m07', 'junction');
g.link('ur_m07', GARDEN[0]);
g.link(GARDEN[2], 'ur_m09');

/* --- landmarks -------------------------------------------------------------- */
g.setType('ur_a04', 'star');
g.setType('ur_b03', 'star');
g.setType('ur_m18', 'star');
g.setType('ur_m05', 'shop');
g.setType('ur_b01', 'shop');
g.setType('ur_m13', 'boss');

g.setEvent('ur_m02', 'air_bubble');
g.setEvent('ur_m20', 'pearl_dive');
g.setEvent('ur_m26', 'current_ride');
g.setEvent('ur_g01', 'air_bubble');
g.setEvent('ur_a02', 'turtle_ride');
g.setEvent('ur_a05', 'pearl_dive');
g.setEvent('ur_b04', 'anglerfish');
g.setEvent('ur_c01', 'current_ride');

const nodes = g.build();
const nav = makeNav(nodes);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'underwater_reef',
  name: loc('Underwater Reef', 'Unterwasserriff'),
  description: loc(
    'Harvest air bubbles for coins, ride one-way currents, and watch the water level swap the open zones every 2 rounds.',
    'Ernte Luftblasen für Münzen, reite Einbahn-Strömungen, und achte auf den Wasserstand, der alle 2 Runden die offenen Zonen tauscht.',
  ),
  difficulty: 3,
  theme: {
    sky: '#0b3d5c',
    fog: { color: '#12507a', near: 22, far: 70 },
    ambient: '#1b6ca8',
    palette: { primary: '#3ecf8e', secondary: '#1b6ca8', accent: '#ff7f50' },
  },
  music: { tempo: 84, scale: 'pentatonic minor', pattern: [0, 3, 5, 7, 10, 7, 5, 3] },
  nodes,
  starSpawns: ['ur_a04', 'ur_b03', 'ur_m18'],
  shops: [
    { node: 'ur_m05', stock: ['double_dice', 'banana_peel', 'shield_shell', 'magnet_banana', 'shop_coupon'] },
    { node: 'ur_b01', stock: ['ghost_banana', 'swap_totem', 'chaos_box', 'dice_curse', 'lucky_mask'] },
  ],
  events: {
    air_bubble: {
      description: loc('You bottle rising air bubbles - the reef pays well for air.', 'Du fängst aufsteigende Luftblasen - das Riff zahlt gut für Luft.'),
      handler(sim, playerId) {
        const bubbles = sim.rng.int(3, 7);
        sim.coins(playerId, bubbles);
        sim.emit('field', { board: 'underwater_reef', event: 'air_bubble', playerId, bubbles });
      },
    },
    current_ride: {
      description: loc('A one-way current sweeps you through the tunnel!', 'Eine Einbahn-Strömung reißt dich durch den Tunnel!'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 3);
        sim.emit('field', { board: 'underwater_reef', event: 'current_ride', playerId, target });
      },
    },
    pearl_dive: {
      description: loc('Dive for pearls - some oysters bite back.', 'Tauche nach Perlen - manche Austern beißen zurück.'),
      handler(sim, playerId) {
        const found = sim.rng.next() < 0.65;
        sim.coins(playerId, found ? sim.rng.int(6, 12) : -3);
      },
    },
    anglerfish: {
      description: loc('An anglerfish lure! You swim off, lighter by some coins.', 'Ein Anglerfisch-Köder! Du entkommst, aber um einige Münzen leichter.'),
      handler(sim, playerId) {
        sim.coins(playerId, -sim.rng.int(3, 7));
      },
    },
    turtle_ride: {
      description: loc('A friendly sea turtle carries you 5 fields.', 'Eine freundliche Meeresschildkröte trägt dich 5 Felder weit.'),
      handler(sim, playerId) {
        const target = nav.forward(sim, playerId, 5);
        sim.emit('field', { board: 'underwater_reef', event: 'turtle_ride', playerId, target });
      },
    },
  },
  mechanics: [
    {
      id: 'ur_water_level',
      everyRounds: 2,
      initialState: { high: true, shelf: SHELF.slice(), trench: TRENCH.slice() },
      onRoundStart(sim, state) {
        state.high = !state.high;
        const blocked = state.high ? TRENCH.slice() : SHELF.slice();
        sim.blockNodes(blocked, 2);
        sim.emit('mechanic', {
          board: 'underwater_reef',
          mechanic: 'ur_water_level',
          high: state.high,
          blocked,
        });
      },
    },
  ],
  bossEvent: {
    id: 'ur_moray_king',
    everyRounds: 4,
    handler(sim) {
      const trenchSet = new Set(TRENCH);
      const bitten = [];
      for (const pid of allPlayers(sim)) {
        const inTrench = trenchSet.has(nav.playerNode(sim, pid));
        sim.coins(pid, inTrench ? -5 : -1);
        if (inTrench) bitten.push(pid);
      }
      sim.emit('boss', { board: 'underwater_reef', boss: 'ur_moray_king', bitten });
    },
  },
  view: { kind: 'board3d', builder: 'underwater_reef' },
};

export default def;
