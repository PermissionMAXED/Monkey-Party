/**
 * Minigame selection for the end-of-round minigame phase.
 *
 * Pure ESM. No DOM, no three.js, no Math.random, no Date.now.
 *
 * selectMinigame({ rules, players, history, rng }) filters the minigame
 * registry down to the games that fit the current table (player count,
 * rules.minigameCategories, competitiveSafe under competitive rules, and
 * the category pool implied by the players' lastFieldColor team split),
 * applies anti-repeat against the recent history, and weighted-picks one.
 *
 * Also compatible with the match sim's caller shape
 * ({ state, rng, minigames, rules } - see shared/sim/match.js), and the
 * returned object carries both `minigameId` and `id` for the same reason.
 */

import { createRng } from '../rng.js';
import { minigames as defaultRegistry } from '../registries.js';
import { makeTeams } from './framework.js';

/** How many recent minigame ids are hard-excluded (unless pool exhausts). */
export const ANTI_REPEAT_WINDOW = 8;

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Normalize the roster into [{ id, lastFieldColor }].
 * Accepts pid strings, player-state objects, or a MatchState.
 */
function resolveRoster(opts) {
  const state = opts.state;
  if (Array.isArray(opts.players) && opts.players.length > 0) {
    return opts.players.map((p) => {
      if (typeof p === 'string') {
        return { id: p, lastFieldColor: state?.players?.[p]?.lastFieldColor ?? null };
      }
      return { id: p.id, lastFieldColor: p.lastFieldColor ?? null };
    });
  }
  if (state && Array.isArray(state.turnOrder)) {
    return state.turnOrder.map((pid) => ({
      id: pid,
      lastFieldColor: state.players?.[pid]?.lastFieldColor ?? null,
    }));
  }
  return [];
}

/**
 * Category pool implied by the blue/red lastFieldColor split:
 * 2/2 -> ['2v2'], 1/3 -> ['1v3'], anything else -> ffa/team (+duel for 2).
 *
 * @param {{id: string, lastFieldColor: string|null}[]} roster
 * @returns {{pool: string[], blue: string[], red: string[]}}
 */
export function categoryPoolFromColors(roster) {
  const blue = roster.filter((p) => p.lastFieldColor === 'blue').map((p) => p.id);
  const red = roster.filter((p) => p.lastFieldColor === 'red').map((p) => p.id);
  const n = roster.length;

  if (n === 4 && blue.length + red.length === 4) {
    if (blue.length === 2) return { pool: ['2v2'], blue, red };
    if (blue.length === 1 || blue.length === 3) return { pool: ['1v3'], blue, red };
  }
  const pool = ['ffa', 'team'];
  if (n === 2) pool.push('duel');
  return { pool, blue, red };
}

/**
 * Build teams for the picked def, honoring the color split when it drove
 * the category choice; otherwise a seeded shuffle keeps teams fair.
 */
function buildTeams(def, roster, split, rng) {
  const ids = roster.map((p) => p.id);
  const { blue, red } = split;

  if (def.category === '2v2' && blue.length === 2 && red.length === 2) {
    return [blue.slice(), red.slice()];
  }
  if (def.category === '1v3' && blue.length + red.length === ids.length) {
    if (blue.length === 1) return [blue.slice(), red.slice()];
    if (red.length === 1) return [red.slice(), blue.slice()];
  }
  return makeTeams(rng.shuffle(ids), def.category);
}

/**
 * Pick the next minigame.
 *
 * @param {{
 *   rules?: import('../types.js').Rules,
 *   players?: Array<string|{id: string, lastFieldColor?: string|null}>,
 *   history?: string[],
 *   rng?: ReturnType<typeof createRng>,
 *   state?: Object,
 *   minigames?: typeof defaultRegistry,
 * }} opts
 * @returns {{minigameId: string, id: string, teams: string[][]|null, params: Object}|null}
 */
export function selectMinigame(opts = {}) {
  const registry = opts.minigames ?? defaultRegistry;
  const rules = opts.rules ?? opts.state?.rules ?? {};
  const rng = opts.rng ?? createRng(0xb4a4a);
  const history = Array.isArray(opts.history) ? opts.history : [];

  const roster = resolveRoster(opts);
  const count = roster.length;
  if (count === 0) return null;

  const split = categoryPoolFromColors(roster);
  const allowedCategories = Array.isArray(rules.minigameCategories) && rules.minigameCategories.length > 0
    ? rules.minigameCategories
    : ['*'];

  function eligible(def, categoryPool) {
    if (rules.competitive && !def.competitiveSafe) return false;
    if (!(allowedCategories.includes('*') || allowedCategories.includes(def.category))) return false;
    const min = def.players?.min ?? 1;
    const max = def.players?.max ?? 8;
    if (!(min <= count && count <= max)) return false;
    if (categoryPool && !categoryPool.includes(def.category)) return false;
    return true;
  }

  // Preferred pool from the color split, relaxed to any category if empty.
  let pool = registry.all().filter((def) => eligible(def, split.pool));
  if (pool.length === 0) pool = registry.all().filter((def) => eligible(def, null));
  if (pool.length === 0) return null;

  // Anti-repeat: hard-exclude the last ANTI_REPEAT_WINDOW ids unless that
  // would exhaust the pool.
  const recent = new Set(history.slice(-ANTI_REPEAT_WINDOW));
  const fresh = pool.filter((def) => !recent.has(def.id));
  if (fresh.length > 0) pool = fresh;

  // Weighted pick: chaos rules boost chaos-tagged games; anything already
  // seen in the (full) history is softly de-weighted.
  const seen = new Set(history);
  const weights = pool.map((def) => {
    let w = 1;
    if (rules.chaosMode && Array.isArray(def.tags) && def.tags.includes('chaos')) w *= 2;
    if (seen.has(def.id)) w *= 0.5;
    return w;
  });
  const total = weights.reduce((acc, w) => acc + w, 0);
  let roll = rng.next() * total;
  let picked = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = pool[i];
      break;
    }
  }

  return {
    minigameId: picked.id,
    id: picked.id, // Compat: shared/sim/match.js reads `.id`.
    teams: buildTeams(picked, roster, split, rng),
    params: clone(picked.params ?? {}),
  };
}

export default selectMinigame;
