/**
 * MONKEY-PARTY shared type contracts.
 *
 * Pure ESM, JSDoc typedefs only - no runtime code. No DOM, no three.js,
 * no Math.random, no Date.now.
 *
 * These contracts are the source of truth for every package in the project
 * (boards, characters, items, minigames, sim, ai, net, ui, engine). Other
 * packages depend on these shapes EXACTLY; do not change them casually.
 */

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

/**
 * A single sampled input frame for a minigame seat.
 *
 * InputFrame: { move:{x:-1..1,y:-1..1}, a:bool, b:bool, aim?:{x,y} }
 *
 * @typedef {Object} InputFrame
 * @property {{x: number, y: number}} move Analog move vector, each axis in [-1, 1].
 * @property {boolean} a Primary action button.
 * @property {boolean} b Secondary action button.
 * @property {{x: number, y: number}} [aim] Optional aim vector/cursor (game-specific units).
 */

/* ------------------------------------------------------------------ */
/* Localized text                                                      */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} LocalizedText
 * @property {string} en English text.
 * @property {string} de German text.
 */

/* ------------------------------------------------------------------ */
/* BoardDef                                                            */
/* ------------------------------------------------------------------ */

/**
 * A node on a board graph.
 *
 * @typedef {Object} BoardNode
 * @property {string} id Unique node id within the board.
 * @property {[number, number, number]} pos World position [x, y, z].
 * @property {'start'|'blue'|'red'|'event'|'item'|'shop'|'star'|'boss'|'trap'|'junction'|'special'} type
 * @property {string[]} next Ids of the nodes reachable from this node.
 * @property {string} [event] Key into BoardDef.events for 'event' nodes.
 * @property {Object} [params] Free-form per-node parameters.
 */

/**
 * A shop placed on the board.
 *
 * @typedef {Object} BoardShop
 * @property {string} node Node id the shop lives on.
 * @property {string[]} stock Item ids available for purchase.
 */

/**
 * A scripted board event.
 *
 * @typedef {Object} BoardEvent
 * @property {LocalizedText} description
 * @property {(sim: Object, playerId: string, params?: Object) => void} handler
 */

/**
 * A recurring board mechanic (e.g. rising water, moving platforms).
 *
 * @typedef {Object} BoardMechanic
 * @property {string} id
 * @property {number} everyRounds Trigger cadence in rounds.
 * @property {(sim: Object, state: Object) => void} onRoundStart
 * @property {Object} initialState Initial mechanic state stored in MatchState.board.mechanics.
 */

/**
 * A recurring boss event for the board.
 *
 * @typedef {Object} BoardBossEvent
 * @property {string} id
 * @property {number} everyRounds
 * @property {(sim: Object) => void} handler
 */

/**
 * BoardDef: { id, name:{en,de}, description:{en,de}, difficulty:1-5,
 *   theme:{sky,fog,ambient,palette:{primary,secondary,accent}},
 *   music:{tempo,scale,pattern},
 *   nodes:[{id,pos:[x,y,z],type:'start'|'blue'|'red'|'event'|'item'|'shop'|'star'|'boss'|'trap'|'junction'|'special',next:[ids],event?,params?}],
 *   starSpawns:[ids], shops:[{node,stock:[itemIds]}],
 *   events:{key:{description:{en,de},handler(sim,playerId,params)}},
 *   mechanics:[{id,everyRounds,onRoundStart(sim,state),initialState}],
 *   bossEvent:{id,everyRounds,handler(sim)}, view }
 *
 * @typedef {Object} BoardDef
 * @property {string} id Unique board id.
 * @property {LocalizedText} name
 * @property {LocalizedText} description
 * @property {1|2|3|4|5} difficulty
 * @property {{sky: *, fog: *, ambient: *, palette: {primary: string, secondary: string, accent: string}}} theme
 * @property {{tempo: number, scale: *, pattern: *}} music Procedural music description.
 * @property {BoardNode[]} nodes
 * @property {string[]} starSpawns Node ids where the star may spawn.
 * @property {BoardShop[]} shops
 * @property {Object<string, BoardEvent>} events
 * @property {BoardMechanic[]} mechanics
 * @property {BoardBossEvent} bossEvent
 * @property {*} view Board view factory / description consumed by the 3D engine package.
 */

/* ------------------------------------------------------------------ */
/* CharacterDef                                                        */
/* ------------------------------------------------------------------ */

/**
 * CharacterDef: { id, name, species, blurb:{en,de},
 *   build:{scale,furColor,faceColor,bellyColor,earStyle,tail,snout,brow,armLen,potbelly},
 *   perk:{id,description:{en,de},hooks:{onShopPrice:(price,ctx)=>n,...}},
 *   voice:{pitch,style}, emotes:[...], unlock:{bananas} }
 *
 * @typedef {Object} CharacterDef
 * @property {string} id Unique character id.
 * @property {string} name Display name (proper noun, not localized).
 * @property {string} species Monkey species/flavor.
 * @property {LocalizedText} blurb
 * @property {{scale: number, furColor: string, faceColor: string, bellyColor: string,
 *   earStyle: string, tail: string, snout: string, brow: string,
 *   armLen: number, potbelly: number}} build Procedural body-build parameters.
 * @property {{id: string, description: LocalizedText,
 *   hooks: Object<string, Function>}} perk Passive perk; hooks are named callbacks,
 *   e.g. onShopPrice(price, ctx) => number.
 * @property {{pitch: number, style: string}} voice Procedural voice parameters.
 * @property {string[]} emotes Emote ids this character can use.
 * @property {{bananas: number}} unlock Golden-banana cost to unlock (0 = starter).
 */

/* ------------------------------------------------------------------ */
/* ItemDef                                                             */
/* ------------------------------------------------------------------ */

/**
 * ItemDef: { id, name:{en,de}, description:{en,de}, price,
 *   rarity:'common'|'rare'|'epic', phase:'preRoll'|'anytime'|'passive'|'trapPlace',
 *   target:'none'|'self'|'player'|'node', competitiveSafe,
 *   icon:{bg,glyph,fg}, effect(sim,userId,target) }
 *
 * @typedef {Object} ItemDef
 * @property {string} id Unique item id.
 * @property {LocalizedText} name
 * @property {LocalizedText} description
 * @property {number} price Shop price in coins.
 * @property {'common'|'rare'|'epic'} rarity
 * @property {'preRoll'|'anytime'|'passive'|'trapPlace'} phase When the item can be used.
 * @property {'none'|'self'|'player'|'node'} target What the item targets.
 * @property {boolean} competitiveSafe Whether the item is allowed in competitive rules.
 * @property {{bg: string, glyph: string, fg: string}} icon Procedural icon description.
 * @property {(sim: Object, userId: string, target?: *) => void} effect
 */

/* ------------------------------------------------------------------ */
/* MinigameDef + sim/view interfaces                                   */
/* ------------------------------------------------------------------ */

/**
 * Deterministic, fixed-step minigame simulation.
 *
 * IMinigameSim: { init(), step(inputsMap), getState(), applyState(snap),
 *   isFinished(), getResults()=>{ranking:[pid],coins:{pid:n},stats:{pid:{}}} }
 * step = exactly 1/30s.
 *
 * @typedef {Object} IMinigameSim
 * @property {() => void} init Prepare initial state.
 * @property {(inputsMap: Object<string, InputFrame>) => void} step Advance exactly 1/30s using per-player inputs.
 * @property {() => Object} getState Serializable public state snapshot.
 * @property {(snap: Object) => void} applyState Restore from a snapshot (netsync).
 * @property {() => boolean} isFinished
 * @property {() => {ranking: string[], coins: Object<string, number>, stats: Object<string, Object>}} getResults
 */

/**
 * Client-side view for a minigame (lives in src/, may use three.js there).
 *
 * IMinigameView: { mount(sceneRoot), update(dtRender,alpha), dispose() }
 *
 * @typedef {Object} IMinigameView
 * @property {(sceneRoot: *) => void} mount Attach to the given scene root.
 * @property {(dtRender: number, alpha: number) => void} update Render update with interpolation alpha.
 * @property {() => void} dispose Release all resources.
 */

/**
 * MinigameDef: { id, name:{en,de}, description:{en,de}, howTo:{en,de},
 *   category:'ffa'|'2v2'|'1v3'|'team'|'duel'|'boss', tags:[...],
 *   players:{min,max}, durationSec, competitiveSafe, params:{},
 *   createSim({seed,players,params,rules})=>IMinigameSim,
 *   createView({sim,engine,input,localSeats})=>IMinigameView,
 *   bot(publicState,playerId,difficulty,rng)=>InputFrame }
 *
 * @typedef {Object} MinigameDef
 * @property {string} id Unique minigame id.
 * @property {LocalizedText} name
 * @property {LocalizedText} description
 * @property {LocalizedText} howTo
 * @property {'ffa'|'2v2'|'1v3'|'team'|'duel'|'boss'} category
 * @property {string[]} tags
 * @property {{min: number, max: number}} players
 * @property {number} durationSec
 * @property {boolean} competitiveSafe
 * @property {Object} params Default tunables (may be overridden per-launch).
 * @property {(opts: {seed: number, players: string[], params: Object, rules: Rules}) => IMinigameSim} createSim
 * @property {(opts: {sim: IMinigameSim, engine: *, input: *, localSeats: Map<string, number>}) => IMinigameView} createView
 * @property {(publicState: Object, playerId: string, difficulty: string, rng: Object) => InputFrame} bot
 */

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/**
 * Rules: { rounds:10, maxSeats:8, botsFill:true,
 *   botDifficulty:'easy'|'normal'|'hard'|'wild', minigameEvery:1,
 *   minigameCategories:['*'], items:'normal'|'off'|'infinite'|'allSame',
 *   bananaMultiplier:1|2, traps:true, randomEvents:true, chaosMode:false,
 *   fastMode:false, hardcore:false, competitive:false, starPrice:20,
 *   startCoins:10, startItems:[] }
 *
 * @typedef {Object} Rules
 * @property {number} rounds Number of rounds (default 10).
 * @property {number} maxSeats Maximum seats (default 8).
 * @property {boolean} botsFill Fill empty seats with bots on start (default true).
 * @property {'easy'|'normal'|'hard'|'wild'} botDifficulty
 * @property {number} minigameEvery Play a minigame every N rounds (default 1).
 * @property {string[]} minigameCategories Allowed categories, ['*'] = all.
 * @property {'normal'|'off'|'infinite'|'allSame'} items Item mode.
 * @property {1|2} bananaMultiplier
 * @property {boolean} traps
 * @property {boolean} randomEvents
 * @property {boolean} chaosMode
 * @property {boolean} fastMode
 * @property {boolean} hardcore
 * @property {boolean} competitive Forces: no randomEvents, items 'allSame', competitiveSafe content filter.
 * @property {number} starPrice Coins per golden banana star (default 20).
 * @property {number} startCoins Starting coins (default 10).
 * @property {string[]} startItems Item ids each player starts with.
 */

/* ------------------------------------------------------------------ */
/* MatchState                                                          */
/* ------------------------------------------------------------------ */

/**
 * Per-player match state.
 *
 * @typedef {Object} MatchPlayerState
 * @property {string} id
 * @property {string} name
 * @property {string} characterId
 * @property {{hat: string|null, skin: string|null, accessory: string|null}} cosmetics
 * @property {boolean} isBot
 * @property {'easy'|'normal'|'hard'|'wild'|null} difficulty Bot difficulty (null for humans).
 * @property {string} node Current board node id.
 * @property {string|null} facingNext Next node id the player is facing.
 * @property {number} coins
 * @property {number} goldenBananas
 * @property {string[]} items Item ids held.
 * @property {{id: string, turnsLeft: number}[]} effects Active status effects.
 * @property {string|null} lastFieldColor
 * @property {boolean} connected
 * @property {{minigameCoins: number, fieldsMoved: number, itemsUsed: number,
 *   coinsLost: number, eventsHit: number, minigameWins: number}} stats
 */

/**
 * MatchState: { matchId, seed, boardId, rules, protocolVersion, round,
 *   phase:'turn_start'|'item'|'roll'|'move'|'field'|'shop'|'minigame_select'|'minigame'|'round_end'|'bonus'|'game_over',
 *   turnOrder:[pid], currentTurn,
 *   players:{[pid]:{id,name,characterId,cosmetics:{hat,skin,accessory},isBot,difficulty,node,facingNext,coins,goldenBananas,items:[ids],effects:[{id,turnsLeft}],lastFieldColor,connected,stats:{minigameCoins,fieldsMoved,itemsUsed,coinsLost,eventsHit,minigameWins}}},
 *   board:{starNode,traps:{node:{itemId,ownerId}},mechanics:{},blockedNodes:[],shopStockOverrides:{}},
 *   minigame:{pendingId,teams,params,results}|null,
 *   awaiting:{playerId,decision:'roll'|'junction'|'buyStar'|'shop'|'itemTarget'|'dicePick',options}|null,
 *   rngState }
 *
 * @typedef {Object} MatchState
 * @property {string} matchId
 * @property {number} seed
 * @property {string} boardId
 * @property {Rules} rules
 * @property {number} protocolVersion
 * @property {number} round 1-based round counter.
 * @property {'turn_start'|'item'|'roll'|'move'|'field'|'shop'|'minigame_select'|'minigame'|'round_end'|'bonus'|'game_over'} phase
 * @property {string[]} turnOrder Player ids in turn order.
 * @property {number} currentTurn Index into turnOrder.
 * @property {Object<string, MatchPlayerState>} players
 * @property {{starNode: string, traps: Object<string, {itemId: string, ownerId: string}>,
 *   mechanics: Object, blockedNodes: string[], shopStockOverrides: Object}} board
 * @property {{pendingId: string, teams: *, params: Object, results: *}|null} minigame
 * @property {{playerId: string, decision: 'roll'|'junction'|'buyStar'|'shop'|'itemTarget'|'dicePick', options: *}|null} awaiting
 * @property {number} rngState Serialized RNG state (see shared/rng.js).
 */

/* ------------------------------------------------------------------ */
/* Action & SimEvent                                                   */
/* ------------------------------------------------------------------ */

/**
 * Action: { type:'roll'|'useItem'|'skipItem'|'junction'|'buyStar'|'declineStar'|'shopBuy'|'shopLeave'|'dicePick'|'itemTarget'|'emote'|'minigameResults',
 *   playerId, payload:{} }
 *
 * @typedef {Object} Action
 * @property {'roll'|'useItem'|'skipItem'|'junction'|'buyStar'|'declineStar'|'shopBuy'|'shopLeave'|'dicePick'|'itemTarget'|'emote'|'minigameResults'} type
 * @property {string} playerId
 * @property {Object} payload
 */

/**
 * SimEvent: { type, ...payload }
 * types: dice, move_step, coins, field, shop, star, trap, item, mechanic, boss,
 *        minigame_start, minigame_result, phase, bonus, game_over, emote
 *
 * @typedef {Object} SimEvent
 * @property {'dice'|'move_step'|'coins'|'field'|'shop'|'star'|'trap'|'item'|'mechanic'|'boss'|'minigame_start'|'minigame_result'|'phase'|'bonus'|'game_over'|'emote'} type
 */

/* ------------------------------------------------------------------ */
/* ISession                                                            */
/* ------------------------------------------------------------------ */

/**
 * Client-facing session interface, implemented by both the offline session
 * (owns a local match sim + bots) and the online session (forwards to a
 * server and maintains a sim replica).
 *
 * ISession: { mode:'offline'|'online', getLobby(), setRules(r), setBoard(id),
 *   addBot(d), removeBot(seat), selectCharacter(pid,charId,cosmetics),
 *   setReady(pid), start(), getSim(), submit(action), sendInput(frame),
 *   sendEmote(id), on(evt,cb), localSeats()=>Map<pid,seat>, leave() }
 *
 * @typedef {Object} ISession
 * @property {'offline'|'online'} mode
 * @property {() => Object} getLobby Current lobby snapshot.
 * @property {(r: Partial<Rules>) => void} setRules
 * @property {(id: string) => void} setBoard
 * @property {(d: string) => void} addBot Add a bot with the given difficulty.
 * @property {(seat: number) => void} removeBot
 * @property {(pid: string, charId: string, cosmetics?: Object) => void} selectCharacter
 * @property {(pid: string, ready?: boolean) => void} setReady
 * @property {() => Promise<void>|void} start
 * @property {() => Object|null} getSim Match sim (offline: authoritative, online: replica).
 * @property {(action: Action) => void} submit
 * @property {(frame: InputFrame, pid?: string) => void} sendInput
 * @property {(id: string) => void} sendEmote
 * @property {(evt: string, cb: Function) => () => void} on Subscribe; returns unsubscribe.
 * @property {() => Map<string, number>} localSeats Map of local player id -> seat index.
 * @property {() => void} leave
 */

export {};
