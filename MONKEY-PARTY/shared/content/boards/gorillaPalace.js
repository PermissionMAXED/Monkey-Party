/**
 * Board 12: Gorilla Palace (difficulty 5).
 *
 * The king's marble palace. Every 3 rounds King Gorilla duels the current
 * leader in a seeded highest-roll - the loser pays 10 coins. Toll gates
 * cost 5 coins, the throne star costs starPrice+10 (onStarPrice mechanic
 * hook), and a banana storm showers 5 random fields with +2 bonuses.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 */

import { graph, seq, circle, alongPath, cycle, loc, makeNav, allPlayers, leaderOf } from './index.js';

const g = graph();

/* --- grand courtyard ring: 28 nodes --------------------------------------------- */
const ringPos = circle(28, 18, { y: (i, t) => 0.6 + Math.sin(t * Math.PI * 2) * 0.4 });
const ring = g.run(
  seq('gp_m', 28),
  ringPos,
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'red']),
);
g.link(ring[27], ring[0]);
g.setType('gp_m00', 'start');

/* --- loop A: royal gardens (m04 -> m12) ------------------------------------------- */
const pa = ringPos(4);
const pb = ringPos(12);
const GARDENS = g.run(
  seq('gp_a', 7),
  alongPath([
    [pa[0] * 0.72, 1.0, pa[2] * 0.72],
    [7.0, 1.4, -4.0],
    [pb[0] * 0.72, 1.0, pb[2] * 0.72],
  ], 7),
  cycle(['blue', 'blue', 'red', 'item', 'blue', 'blue', 'blue']),
);
g.setType('gp_m04', 'junction');
g.link('gp_m04', GARDENS[0]);
g.link(GARDENS[6], 'gp_m12');

/* --- loop B: portrait gallery (m16 -> m23), raised marble hall --------------------- */
const pc = ringPos(16);
const pd = ringPos(23);
const GALLERY = g.run(
  seq('gp_b', 7),
  alongPath([
    [pc[0] * 0.74, 3.2, pc[2] * 0.74],
    [-5.5, 3.8, 5.0],
    [pd[0] * 0.74, 3.2, pd[2] * 0.74],
  ], 7),
  cycle(['blue', 'red', 'blue', 'blue', 'item', 'blue', 'blue']),
);
g.setType('gp_m16', 'junction');
g.link('gp_m16', GALLERY[0]);
g.link(GALLERY[6], 'gp_m23');

/* --- throne ascent: m26 -> throne -> m02 -------------------------------------------- */
const pe = ringPos(26);
const pf = ringPos(2);
const THRONE = g.run(
  seq('gp_t', 6),
  alongPath([
    [pe[0] * 0.7, 2.4, pe[2] * 0.7],
    [-1.0, 7.2, -3.0],
    [2.0, 7.4, -2.0],
    [pf[0] * 0.7, 2.4, pf[2] * 0.7],
  ], 6),
  cycle(['blue', 'blue', 'blue', 'blue', 'red', 'blue']),
);
g.setType('gp_m26', 'junction');
g.link('gp_m26', THRONE[0]);
g.link(THRONE[5], 'gp_m02');

/* --- shortcut: treasury vault passage (m09 -> m20), toll-gated ----------------------- */
const pg = ringPos(9);
const ph = ringPos(20);
const VAULT = g.run(
  seq('gp_x', 4),
  alongPath([
    [pg[0] * 0.62, 0.4, pg[2] * 0.62],
    [0.5, -0.4, 0.5],
    [ph[0] * 0.62, 0.4, ph[2] * 0.62],
  ], 4),
  'special',
);
g.setType('gp_m09', 'junction');
g.link('gp_m09', VAULT[0]);
g.link(VAULT[3], 'gp_m20');

/* --- landmarks ------------------------------------------------------------------------ */
g.setType('gp_t03', 'star');
g.setType('gp_t05', 'star');
g.setType('gp_b03', 'star');
g.setType('gp_m06', 'shop');
g.setType('gp_b01', 'shop');
g.setType('gp_m14', 'boss');

g.setEvent('gp_t00', 'toll_gate');
g.setEvent('gp_x00', 'toll_gate');
g.setEvent('gp_m11', 'royal_feast');
g.setEvent('gp_m18', 'treasury_raid');
g.setEvent('gp_m25', 'throne_trial');
g.setEvent('gp_a02', 'royal_feast');
g.setEvent('gp_a05', 'royal_gift');
g.setEvent('gp_b05', 'throne_trial');

const nodes = g.build();
const nav = makeNav(nodes);
/** Fields eligible for the banana storm (plain courtyard + garden fields). */
const STORM_CANDIDATES = nodes
  .filter((n) => n.type === 'blue' || n.type === 'red')
  .map((n) => n.id);

/**
 * Star bought at the throne costs starPrice + 10 (royal markup). The sim
 * resolves this via the board-mechanic hook chain (effects.collectHooks);
 * the markup only applies while the star sits on a throne-ascent node.
 */
function onStarPrice(price, ctx) {
  const starNode = ctx?.sim?.state?.board?.starNode;
  if (typeof starNode === 'string' && !starNode.startsWith('gp_t')) return price;
  return price + 10;
}

/** @type {import('../../types.js').BoardDef} */
export const def = {
  id: 'gorilla_palace',
  name: loc('Gorilla Palace', 'Gorillapalast'),
  description: loc(
    'The king duels the leader every 3 rounds (loser pays 10), toll gates cost 5, and the throne star carries a +10 royal markup.',
    'Der König duelliert alle 3 Runden den Führenden (Verlierer zahlt 10), Zolltore kosten 5, und der Thronstern hat +10 königlichen Aufpreis.',
  ),
  difficulty: 5,
  theme: {
    sky: '#f3e4c0',
    fog: { color: '#e8d5ae', near: 30, far: 100 },
    ambient: '#f0e2c2',
    palette: { primary: '#8b0000', secondary: '#ffd23f', accent: '#ffffff' },
  },
  music: { tempo: 108, scale: 'harmonic minor', pattern: [0, 3, 5, 7, 8, 7, 5, 3] },
  nodes,
  starSpawns: ['gp_t03', 'gp_t05', 'gp_b03'],
  shops: [
    { node: 'gp_m06', stock: ['double_dice', 'turbo_banana', 'shield_shell', 'banana_peel', 'lucky_mask'] },
    { node: 'gp_b01', stock: ['golden_ticket', 'swap_totem', 'mini_gorilla', 'chaos_box', 'magnet_banana'] },
  ],
  events: {
    toll_gate: {
      description: loc('A royal toll gate: 5 coins, or the guards march you back.', 'Ein königliches Zolltor: 5 Münzen, oder die Wachen führen dich zurück.'),
      handler(sim, playerId) {
        const coins = sim.state?.players?.[playerId]?.coins ?? 0;
        if (coins >= 5) {
          sim.coins(playerId, -5);
        } else {
          const target = nav.back(sim, playerId, 3);
          sim.emit('field', { board: 'gorilla_palace', event: 'toll_gate', playerId, target });
        }
      },
    },
    royal_feast: {
      description: loc('You are invited to the royal banana feast. Leftovers included.', 'Du bist zum königlichen Bananenbankett geladen. Reste inklusive.'),
      handler(sim, playerId) {
        sim.coins(playerId, sim.rng.int(6, 10));
      },
    },
    treasury_raid: {
      description: loc('A secret passage into the treasury - snatch 5 coins from the leader.', 'Ein Geheimgang in die Schatzkammer - stibitze dem Führenden 5 Münzen.'),
      handler(sim, playerId) {
        const leader = leaderOf(sim);
        if (leader && leader !== playerId) sim.stealCoins(leader, playerId, 5);
        else sim.coins(playerId, 3);
      },
    },
    royal_gift: {
      description: loc('The king is pleased and grants you a golden ticket.', 'Der König ist erfreut und gewährt dir ein goldenes Ticket.'),
      handler(sim, playerId) {
        sim.giveItem(playerId, 'golden_ticket');
      },
    },
    throne_trial: {
      description: loc('A trial before the court: impress for +10 or embarrass for -5.', 'Eine Prüfung vor dem Hof: Beeindrucke für +10 oder blamiere dich für -5.'),
      handler(sim, playerId) {
        const impressed = sim.rng.next() < 0.5;
        sim.coins(playerId, impressed ? 10 : -5);
        sim.emit('field', { board: 'gorilla_palace', event: 'throne_trial', playerId, impressed });
      },
    },
  },
  mechanics: [
    {
      id: 'gp_banana_storm',
      everyRounds: 2,
      initialState: { stormNodes: [], bonus: 2 },
      onRoundStart(sim, state) {
        state.stormNodes = sim.rng.shuffle(STORM_CANDIDATES).slice(0, 5);
        const stormy = new Set(state.stormNodes);
        const showered = [];
        for (const pid of allPlayers(sim)) {
          if (stormy.has(nav.playerNode(sim, pid))) {
            sim.coins(pid, 2);
            showered.push(pid);
          }
        }
        sim.emit('mechanic', {
          board: 'gorilla_palace',
          mechanic: 'gp_banana_storm',
          stormNodes: state.stormNodes.slice(),
          bonus: 2,
          showered,
        });
      },
    },
    {
      id: 'gp_throne_star',
      everyRounds: 1,
      initialState: { markup: 10, throne: 'gp_t03' },
      /* Star price hook: the sim consults mechanic hooks when quoting the star. */
      onStarPrice,
      hooks: { onStarPrice },
      onRoundStart(sim, state) {
        sim.emit('mechanic', {
          board: 'gorilla_palace',
          mechanic: 'gp_throne_star',
          markup: state.markup,
        });
      },
    },
  ],
  bossEvent: {
    id: 'gp_king_gorilla',
    everyRounds: 3,
    handler(sim) {
      const leader = leaderOf(sim);
      if (!leader) return;
      let kingRoll = sim.rng.int(1, 6);
      let leaderRoll = sim.rng.int(1, 6);
      while (kingRoll === leaderRoll) {
        kingRoll = sim.rng.int(1, 6);
        leaderRoll = sim.rng.int(1, 6);
      }
      const leaderWon = leaderRoll > kingRoll;
      sim.coins(leader, leaderWon ? 10 : -10);
      sim.emit('boss', {
        board: 'gorilla_palace',
        boss: 'gp_king_gorilla',
        leader,
        kingRoll,
        leaderRoll,
        leaderWon,
      });
    },
  },
  view: { kind: 'board3d', builder: 'gorilla_palace' },
};

export default def;
