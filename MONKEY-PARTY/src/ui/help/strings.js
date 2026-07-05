/**
 * Help package strings (How to Play + Credits), all under the 'help.'
 * namespace. Merged into the shared UI dictionary via i18n.extendDict at
 * import time. The namespace import + optional call keeps this module
 * loadable against an i18n build that predates extendDict.
 *
 * Gameplay numbers are verified against shared/rules.js DEFAULT_RULES,
 * shared/sim/fields.js, shared/sim/dice.js, shared/minigames/framework.js
 * and src/engine/input.js - keep them in sync when the sim changes.
 */

import * as i18n from '../i18n.js';

export const HELP_DICT = {
  /* ---------- main-menu entries ---------- */
  'help.menu.howToPlay': { en: 'How to Play', de: 'Spielanleitung' },
  'help.menu.credits': { en: 'Credits', de: 'Credits' },

  /* ---------- how-to-play shell ---------- */
  'help.title': { en: 'How to Play', de: 'So wird gespielt' },
  'help.tab.party': { en: 'Party Flow', de: 'Spielablauf' },
  'help.tab.boards': { en: 'Boards', de: 'Spielbretter' },
  'help.tab.items': { en: 'Items', de: 'Items' },
  'help.tab.minigames': { en: 'Minigames', de: 'Minispiele' },
  'help.tab.online': { en: 'Online', de: 'Online' },

  /* ---------- party flow ---------- */
  'help.party.roundsTitle': { en: 'Rounds & Turns', de: 'Runden & Züge' },
  'help.party.rounds': {
    en: 'A party lasts a set number of rounds (10 by default, 1-50 via the rules). Each round every monkey takes one turn: use an item (or skip), roll the die, walk the board, and resolve the field you land on.',
    de: 'Eine Party dauert eine feste Rundenzahl (Standard 10, 1-50 über die Regeln). Jede Runde ist jeder Affe einmal dran: Item benutzen (oder überspringen), würfeln, übers Brett ziehen und das Zielfeld auslösen.',
  },
  'help.party.diceTitle': { en: 'Dice', de: 'Würfel' },
  'help.party.dice': {
    en: 'The standard roll is a single six-sided die. Items can bend the roll - extra dice, cursed low-side dice, or a lucky reroll. Under competitive rules you draft instead: three values are drawn and you pick one.',
    de: 'Standard ist ein einzelner sechsseitiger Würfel. Items verbiegen den Wurf - Extrawürfel, verfluchte Mini-Würfel oder ein Glücks-Neuwurf. Mit Kompetitiv-Regeln wird stattdessen gedraftet: Drei Werte werden gezogen, du wählst einen.',
  },
  'help.party.coinsTitle': { en: 'Coins', de: 'Münzen' },
  'help.party.coins': {
    en: 'Blue fields pay +3 coins (times the banana-multiplier rule), red fields cost 3 (5 under hardcore rules). Minigame placings pay 10/7/5/3 coins, doubled in chaos mode. Coins buy items in the shop - and Golden Bananas.',
    de: 'Blaue Felder zahlen +3 Münzen (mal Bananen-Multiplikator), rote kosten 3 (5 bei Hardcore-Regeln). Minispiel-Platzierungen zahlen 10/7/5/3 Münzen, im Chaos-Modus doppelt. Für Münzen gibt es Items im Laden - und Goldene Bananen.',
  },
  'help.party.bananasTitle': { en: 'Golden Bananas', de: 'Goldene Bananen' },
  'help.party.bananas': {
    en: 'One Golden Banana star waits somewhere on the board. Pass it or land on it with enough coins (20 by default) and you may buy a banana - the star then jumps to a new spot. Whoever holds the most Golden Bananas when the last round ends wins the party; ties break by coins, then minigame wins, then turn order.',
    de: 'Irgendwo auf dem Brett wartet der Goldene-Bananen-Stern. Wer mit genug Münzen (Standard 20) vorbeizieht oder landet, darf eine Banane kaufen - danach springt der Stern an einen neuen Ort. Wer am Ende die meisten Goldenen Bananen hält, gewinnt die Party; Gleichstand entscheiden Münzen, dann Minispiel-Siege, dann die Zugreihenfolge.',
  },
  'help.party.bonusTitle': { en: 'Bonus Bananas', de: 'Bonus-Bananen' },
  'help.party.bonus': {
    en: 'When the party ends, bonus bananas go to the leaders of the categories announced at match start (Minigame King plus one more). Hardcore and competitive rules skip every bonus.',
    de: 'Am Partyende gibt es Bonus-Bananen für die Führenden der beim Start angekündigten Kategorien (Minispiel-König plus eine weitere). Hardcore- und Kompetitiv-Regeln überspringen alle Boni.',
  },

  /* ---------- boards / node legend ---------- */
  'help.boards.intro': {
    en: 'All {n} boards share one field color code. Blue and red also matter beyond coins: the colors everyone last landed on decide the minigame team split at the end of the round.',
    de: 'Alle {n} Spielbretter teilen sich einen Feld-Farbcode. Blau und Rot zählen über Münzen hinaus: Die zuletzt betretenen Farben bestimmen die Team-Aufteilung im Minispiel am Rundenende.',
  },
  'help.node.blue': { en: 'Blue', de: 'Blau' },
  'help.node.blue.desc': { en: '+3 coins (times the banana multiplier).', de: '+3 Münzen (mal Bananen-Multiplikator).' },
  'help.node.red': { en: 'Red', de: 'Rot' },
  'help.node.red.desc': { en: 'Lose 3 coins (5 under hardcore rules).', de: '3 Münzen weg (5 bei Hardcore-Regeln).' },
  'help.node.event': { en: 'Event', de: 'Ereignis' },
  'help.node.event.desc': { en: "Triggers the board's own event - geysers, vines, treasure... (off when random events are disabled).", de: 'Löst das Brett-eigene Ereignis aus - Geysire, Lianen, Schätze... (aus, wenn Zufallsereignisse deaktiviert sind).' },
  'help.node.item': { en: 'Item', de: 'Item' },
  'help.node.item.desc': { en: 'Grants a random item (a couple of coins when items are off).', de: 'Gibt ein zufälliges Item (ein paar Münzen, wenn Items aus sind).' },
  'help.node.shop': { en: 'Shop', de: 'Laden' },
  'help.node.shop.desc': { en: 'The monkey shop opens when you pass or land - spend coins on items.', de: 'Der Affen-Laden öffnet beim Vorbeiziehen oder Landen - Münzen gegen Items.' },
  'help.node.star': { en: 'Star', de: 'Stern' },
  'help.node.star.desc': { en: 'Buy a Golden Banana here (pass or land, if you can afford it).', de: 'Hier gibt es die Goldene Banane (Vorbeiziehen oder Landen, wenn du sie dir leisten kannst).' },
  'help.node.boss': { en: 'Boss', de: 'Boss' },
  'help.node.boss.desc': { en: 'The board boss takes a coin toll.', de: 'Der Brett-Boss kassiert Münzen.' },
  'help.node.trap': { en: 'Trap', de: 'Falle' },
  'help.node.trap.desc': { en: 'Built-in hazard: lose 3-8 coins (a shield can block it; off when traps are disabled).', de: 'Eingebaute Falle: 3-8 Münzen weg (ein Schild kann blocken; aus, wenn Fallen deaktiviert sind).' },
  'help.node.junction': { en: 'Junction', de: 'Kreuzung' },
  'help.node.junction.desc': { en: 'Choose which way to go.', de: 'Wähle, wohin es weitergeht.' },

  /* ---------- items ---------- */
  'help.items.intro': {
    en: '{n} items - buy them in the shop or grab them on item fields. Trap items are placed on a field and spring on the next monkey who steps on it.',
    de: '{n} Items - im Laden kaufen oder auf Item-Feldern finden. Fallen-Items werden auf ein Feld gelegt und schnappen beim nächsten Affen zu, der drauftritt.',
  },
  'help.items.empty': { en: 'No items registered yet.', de: 'Noch keine Items registriert.' },
  'help.rarity.common': { en: 'Common', de: 'Häufig' },
  'help.rarity.rare': { en: 'Rare', de: 'Selten' },
  'help.rarity.epic': { en: 'Epic', de: 'Episch' },
  'help.itemPhase.preRoll': { en: 'Before rolling', de: 'Vor dem Wurf' },
  'help.itemPhase.anytime': { en: 'Anytime', de: 'Jederzeit' },
  'help.itemPhase.passive': { en: 'Passive', de: 'Passiv' },
  'help.itemPhase.trapPlace': { en: 'Placed trap', de: 'Legbare Falle' },

  /* ---------- minigames ---------- */
  'help.mg.intro': {
    en: '{n} minigames in the pack. One plays at the end of a round (per the rules - default: every round). The field colors everyone last landed on decide the matchup:',
    de: '{n} Minispiele im Paket. Eines läuft am Rundenende (laut Regeln - Standard: jede Runde). Die zuletzt betretenen Feldfarben bestimmen den Modus:',
  },
  'help.mgcat.ffa': { en: 'Free-for-all - every monkey for themselves.', de: 'Jeder gegen jeden - alle Affen für sich.' },
  'help.mgcat.2v2': { en: 'Two teams of two - when the colors split exactly 2 blue vs 2 red.', de: 'Zwei Zweier-Teams - wenn die Farben genau 2 Blau gegen 2 Rot stehen.' },
  'help.mgcat.1v3': { en: 'One against three - a lone field color takes on the rest.', de: 'Einer gegen drei - eine einzelne Feldfarbe gegen den Rest.' },
  'help.mgcat.team': { en: 'Team battle with a fair, seeded team split.', de: 'Team-Kampf mit fairer, ausgeloster Aufteilung.' },
  'help.mgcat.duel': { en: 'Duel - head to head, only with two players.', de: 'Duell - eins gegen eins, nur bei zwei Spielern.' },
  'help.mgcat.boss': { en: 'Boss - everyone together against the board boss.', de: 'Boss - alle gemeinsam gegen den Brett-Boss.' },
  'help.controls.title': { en: 'Controls', de: 'Steuerung' },
  'help.controls.device': { en: 'Device', de: 'Gerät' },
  'help.controls.move': { en: 'Move', de: 'Bewegen' },
  'help.controls.kb1': { en: 'Keyboard 1', de: 'Tastatur 1' },
  'help.controls.kb2': { en: 'Keyboard 2', de: 'Tastatur 2' },
  'help.controls.kb3': { en: 'Keyboard 3', de: 'Tastatur 3' },
  'help.controls.gamepad': { en: 'Gamepad', de: 'Gamepad' },
  'help.controls.touch': { en: 'Touch', de: 'Touch' },
  'help.controls.arrows': { en: 'Arrow keys', de: 'Pfeiltasten' },
  'help.controls.stick': { en: 'Left stick / D-pad', de: 'Linker Stick / Steuerkreuz' },
  'help.controls.vstick': { en: 'Virtual stick (left half)', de: 'Virtueller Stick (linke Hälfte)' },
  'help.controls.abtn': { en: 'A button', de: 'A-Taste' },
  'help.controls.bbtn': { en: 'B button', de: 'B-Taste' },
  'help.controls.note': {
    en: 'Board decisions (rolling, junctions, buying) are big on-screen buttons - and every prompt auto-picks a safe default after about 20 seconds, so the party never stalls. Seats 1-4 can rebind their device in the settings.',
    de: 'Brett-Entscheidungen (Würfeln, Kreuzungen, Kaufen) sind große Buttons - und jede Abfrage wählt nach rund 20 Sekunden automatisch eine sichere Option, damit die Party nie hängt. Plätze 1-4 können ihr Gerät in den Einstellungen umbelegen.',
  },

  /* ---------- online ---------- */
  'help.online.quickTitle': { en: 'Quick Match', de: 'Schnelles Spiel' },
  'help.online.quick': {
    en: 'Connects to the server and seats you in the fullest open public lobby - or opens a fresh one. Quick-match lobbies start automatically 30 seconds after two humans are seated; bots fill the remaining seats.',
    de: 'Verbindet zum Server und setzt dich in die vollste offene öffentliche Lobby - oder eröffnet eine neue. Quick-Match-Lobbys starten automatisch 30 Sekunden, nachdem zwei Menschen sitzen; Bots füllen die restlichen Plätze.',
  },
  'help.online.codesTitle': { en: 'Lobby Codes', de: 'Lobby-Codes' },
  'help.online.codes': {
    en: 'Create a private lobby and share its short 4-character code - friends enter it under "Join with Code". Public lobbies also show up in the Lobby Browser.',
    de: 'Erstelle eine private Lobby und teile ihren kurzen 4-Zeichen-Code - Freunde geben ihn unter "Code beitreten" ein. Öffentliche Lobbys erscheinen außerdem im Lobby-Browser.',
  },
  'help.online.reconnectTitle': { en: 'Reconnection', de: 'Wiederverbindung' },
  'help.online.reconnect': {
    en: 'If your connection drops, the client reconnects automatically (up to 10 tries with growing delays) and resumes your seat via a resume token - even a full page reload can rejoin a running match.',
    de: 'Bricht die Verbindung ab, verbindet sich der Client automatisch neu (bis zu 10 Versuche mit wachsenden Pausen) und übernimmt deinen Platz per Resume-Token - sogar nach einem Seiten-Reload geht es zurück in die laufende Partie.',
  },
  'help.online.serverNote': {
    en: 'Online play needs the game server to be running (npm run server).',
    de: 'Online-Spiel braucht den laufenden Spielserver (npm run server).',
  },

  /* ---------- credits ---------- */
  'help.credits.title': { en: 'Credits', de: 'Credits' },
  'help.credits.builtWith': { en: 'Built with three.js, Vite and ws.', de: 'Gebaut mit three.js, Vite und ws.' },
  'help.credits.thanks': {
    en: 'Thank YOU for partying with the troop - may your bananas always be golden! 🍌',
    de: 'DANKE, dass du mit der Affenbande feierst - mögen deine Bananen immer golden sein! 🍌',
  },
  'help.credits.starring': { en: 'Starring - the troop', de: 'Mit dabei - die Affenbande' },
  'help.credits.locations': { en: 'On location - the boards', de: 'Schauplätze - die Spielbretter' },
  'help.credits.minigames': { en: '... and {n} minigames', de: '... und {n} Minispiele' },
  'help.credits.minigamesSub': { en: 'crafted with love, chaos and bananas', de: 'gebaut mit Liebe, Chaos und Bananen' },
  'help.credits.theEnd': { en: 'See you on the board!', de: 'Bis gleich auf dem Brett!' },
};

i18n.extendDict?.(HELP_DICT);

export default HELP_DICT;
