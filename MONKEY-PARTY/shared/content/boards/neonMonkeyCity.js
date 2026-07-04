/**
 * Board 3: Neon Monkey City (difficulty 2).
 *
 * Nighttime neon metropolis. Signature mechanic: a subway platform whose
 * destination cycles between 3 stations every round - anyone standing on
 * the platform gets whisked away. Casino double-or-nothing, rooftop
 * shortcut with a toll.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers } from './index.js';

const g = graph();

/* --- street ring: 30 nodes ------------------------------------------ */
const ringPos = circle(30, 17, { y: (i, t) => 0.3 + Math.max(0, Math.sin(t * Math.PI * 2 + 1)) * 0.6 });
const ring = g.run(
  seq('nc_m', 30),
  ringPos,
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue']),
);
g.link(ring[29], ring[0]);
g.setType('nc_m00', 'start');

/* --- loop A: banana park (m02 -> m09) -------------------------------- */
const pa = ringPos(2);
const pb = ringPos(9);
const loopA = g.run(
  seq('nc_p', 7),
  alongPath([
    [pa[0] * 0.72, 0.4, pa[2] * 0.72],
    [8.5, 0.6, -3.0],
    [pb[0] * 0.72, 0.4, pb[2] * 0.72],
  ], 7),
  cycle(['blue', 'blue', 'red', 'blue', 'item', 'blue', 'blue']),
);
g.setType('nc_m02', 'junction');
g.link('nc_m02', loopA[0]);
g.link(loopA[6], 'nc_m09');

/* --- loop B: neon market (m18 -> m25) --------------------------------- */
const pc = ringPos(18);
const pd = ringPos(25);
const loopB = g.run(
  seq('nc_k', 7),
  alongPath([
    [pc[0] * 0.74, 0.5, pc[2] * 0.74],
    [-8.0, 0.8, 4.0],
    [pd[0] * 0.74, 0.5, pd[2] * 0.74],
  ], 7),
  cycle(['red', 'blue', 'blue', 'blue', 'item', 'blue', 'trap']),
);
g.setType('nc_m18', 'junction');
g.link('nc_m18', loopB[0]);
g.link(loopB[6], 'nc_m25');

/* --- shortcut: rooftop run, high above the streets (m11 -> m24) ------- */
const pe = ringPos(11);
const pf = ringPos(24);
const ROOF = g.run(
  seq('nc_r', 6),
  alongPath([
    [pe[0] * 0.8, 6.0, pe[2] * 0.8],
    [2.0, 7.2, 3.0],
    [pf[0] * 0.8, 6.0, pf[2] * 0.8],
  ], 6),
  'special',
);
g.setType('nc_m11', 'junction');
g.link('nc_m11', ROOF[0]);
g.link(ROOF[5], 'nc_m24');

/* --- subway: platform + 3 stations ------------------------------------ */
const STATIONS = ['nc_stA', 'nc_stB', 'nc_stC'];
g.add('nc_sub', [0, -1.5, 0], 'junction');
g.add('nc_stA', [10.5, -1.2, -10.5], 'special');
g.add('nc_stB', [-13.0, -1.2, 0.5], 'special');
g.add('nc_stC', [9.0, -1.2, 11.5], 'special');
g.setType('nc_m28', 'junction');
g.link('nc_m28', 'nc_sub');
g.link('nc_sub', 'nc_stA', 'nc_stB', 'nc_stC');
g.link('nc_stA', 'nc_m04');
g.link('nc_stB', 'nc_m14');
g.link('nc_stC', 'nc_m24');

/* --- landmarks -------------------------------------------------------- */
g.setType('nc_r03', 'star');
g.setType('nc_p04', 'star');
g.setType('nc_k03', 'star');
g.setType('nc_k05', 'shop');
g.setType('nc_m21', 'shop');
g.setType('nc_m16', 'boss');

g.setEvent('nc_m06', 'casino');
g.setEvent('nc_m13', 'billboard_bonus');
g.setEvent('nc_m27', 'subway_ride');
g.setEvent('nc_r00', 'rooftop_toll');
g.setEvent('nc_p02', 'pickpocket');
g.setEvent('nc_p05', 'casino');
g.setEvent('nc_k02', 'billboard_bonus');
g.setEvent('nc_k06', 'pickpocket');

const nodes = g.build();
const nav = makeNav(nodes);
const STREETS = new Set(ring);

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'neon_monkey_city',
  name: loc('Neon Monkey City', 'Neon-Affenstadt'),
  description: loc(
    'Neon streets, a rooftop toll run, a rigged casino and a subway that changes destination every round.',
    'Neonstraßen, ein Dächerlauf mit Maut, ein manipuliertes Casino und eine U-Bahn, die jede Runde das Ziel wechselt.',
  ),
  difficulty: 2,
  theme: {
    sky: '#0a0a23',
    fog: { color: '#141433', near: 28, far: 95 },
    ambient: '#2a2a55',
    palette: { primary: '#e056fd', secondary: '#3a7bd5', accent: '#00ffd0' },
  },
  music: { tempo: 118, scale: 'minor', pattern: [0, 3, 7, 10, 7, 3, 5, 3] },
  nodes,
  starSpawns: ['nc_r03', 'nc_p04', 'nc_k03'],
  shops: [
    { node: 'nc_k05', stock: ['double_dice', 'swap_totem', 'shop_coupon', 'chaos_box', 'golden_ticket'] },
    { node: 'nc_m21', stock: ['turbo_banana', 'banana_peel', 'ghost_banana', 'dice_curse', 'shield_shell'] },
  ],
  events: {
    casino: {
      description: loc('Double or nothing! Stake up to 10 coins on one spin.', 'Doppelt oder nichts! Setze bis zu 10 Münzen auf eine Drehung.'),
      handler(sim, playerId) {
        const coins = sim.state?.players?.[playerId]?.coins ?? 0;
        const stake = Math.min(10, Math.max(0, coins));
        if (stake === 0) return;
        const won = sim.rng.next() < 0.5;
        sim.coins(playerId, won ? stake : -stake);
        sim.emit('field', { board: 'neon_monkey_city', event: 'casino', playerId, won, stake });
      },
    },
    rooftop_toll: {
      description: loc('Rooftop bouncer: pay 5 coins or climb back down.', 'Türsteher auf dem Dach: Zahle 5 Münzen oder klettere wieder runter.'),
      handler(sim, playerId) {
        const coins = sim.state?.players?.[playerId]?.coins ?? 0;
        if (coins >= 5) {
          sim.coins(playerId, -5);
        } else {
          sim.teleport(playerId, 'nc_m11');
        }
      },
    },
    billboard_bonus: {
      description: loc('Your face on the big billboard! Sponsors pay out.', 'Dein Gesicht auf der großen Reklametafel! Sponsoren zahlen.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(4, 8));
      },
    },
    pickpocket: {
      description: loc('You pickpocket the richest monkey in the crowd.', 'Du bestiehlst den reichsten Affen in der Menge.'),
      handler(sim, playerId) {
        let rich = null;
        for (const pid of allPlayers(sim)) {
          if (pid === playerId) continue;
          const c = sim.state?.players?.[pid]?.coins ?? 0;
          if (rich === null || c > (sim.state?.players?.[rich]?.coins ?? 0)) rich = pid;
        }
        if (rich) sim.stealCoins(rich, playerId, 3);
      },
    },
    subway_ride: {
      description: loc('You hop down to the subway platform.', 'Du springst hinunter zum U-Bahnsteig.'),
      handler(sim, playerId) {
        sim.teleport(playerId, 'nc_sub');
      },
    },
  },
  mechanics: [
    {
      id: 'nc_subway',
      everyRounds: 1,
      initialState: { station: 0, platform: 'nc_sub', stations: STATIONS.slice() },
      onRoundStart(sim, state) {
        state.station = (state.station + 1) % STATIONS.length;
        const target = STATIONS[state.station];
        const riders = [];
        for (const pid of allPlayers(sim)) {
          if (nav.playerNode(sim, pid) === 'nc_sub') {
            sim.teleport(pid, target);
            riders.push(pid);
          }
        }
        sim.emit('mechanic', {
          board: 'neon_monkey_city',
          mechanic: 'nc_subway',
          station: state.station,
          target,
          riders,
        });
      },
    },
  ],
  bossEvent: {
    id: 'nc_mecha_kong',
    everyRounds: 5,
    handler(sim) {
      const stomped = [];
      for (const pid of allPlayers(sim)) {
        if (STREETS.has(nav.playerNode(sim, pid))) {
          sim.coins(pid, -4);
          stomped.push(pid);
        }
      }
      sim.emit('boss', { board: 'neon_monkey_city', boss: 'nc_mecha_kong', stomped });
    },
  },
  view: { kind: 'board3d', builder: 'neon_monkey_city' },
};

export default def;
