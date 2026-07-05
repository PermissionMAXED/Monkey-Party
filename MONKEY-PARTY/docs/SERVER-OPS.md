# MONKEY-PARTY server ops guide

How to run, proxy, tune and reason about the authoritative game server
(`server/index.js`, a single Node process using `ws`).

## Running

```bash
npm install          # once
npm run server       # listens on ws://0.0.0.0:8081
PORT=9000 npm run server   # listen port via env (PORT wins over config.port)
```

- Node 20+ (the repo is tested on Node 22). No build step - the server runs
  the ESM sources directly (`#shared/*` resolves via package `imports`).
- Boot logs the registered content counts (`[mp:srv] content_registered ...`)
  and `listening port=8081 protocol=1`. If a content pack is listed under
  `missing`, matches that rely on it will fall back (never crash).
- Stopping: `SIGINT`/`SIGTERM` trigger a **graceful shutdown** - every
  connected socket receives `error{code:'shutdown'}`, sockets are closed
  (the notice gets `shutdownFlushMs` to flush), rooms and lobbies are
  disposed, then the process exits. A 5s watchdog force-exits if teardown
  hangs.

## Reverse proxy (wss) - nginx sample

Browsers on an `https://` page must use `wss://`. The client's default URL
resolution (see `src/net/client.js defaultUrl()`) expects the WebSocket
endpoint at **`wss://<host>/ws`** on https origins, so terminate TLS at the
proxy and forward `/ws` to the game server:

```nginx
server {
  listen 443 ssl;
  server_name party.example.com;
  # ssl_certificate / ssl_certificate_key ...

  # Static client build (vite build output), if served from the same host.
  root /srv/monkey-party/dist;

  location /ws {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;   # > heartbeat interval (server pings every 5s)
    proxy_send_timeout 120s;
  }
}
```

Client URL resolution priority (no rebuild needed to retarget):

1. `?server=ws://host:port` / `?server=wss://host/ws` query param (full URL),
2. `VITE_MP_SERVER` at build time (e.g. `VITE_MP_SERVER=wss://gs1.example.com/ws`),
3. same-origin default: `wss://<host>/ws` on https pages, else
   `ws://<hostname>:8081` (dev).

## In-memory model (what a restart means)

ALL state lives in process memory - there is no database and no persistence:

- **Restart = every lobby, room and match is gone.** Clients see the
  shutdown notice (graceful stop) or a dropped socket (crash/kill -9), then
  auto-reconnect with exponential backoff (1s doubling to 10s, 10 tries).
- **Resume tokens die with the process.** Tokens are HMAC-signed with a
  per-process random secret (`server/connections.js`), so tokens from a
  previous run are rejected with `error{code:'resume'}`; clients fall back
  to a fresh `hello` and start over from the menu.
- Mid-match seat coverage: a disconnected player's seat is bot-driven for
  up to `resumeGraceMs` (90s); resuming within the grace re-binds the seat
  and replays a full `state_sync` snapshot. After the grace expires the
  seat stays bot-driven and the survivors get a system chat line
  ("X left — bot takes over").

## Rate limits & knobs

Everything below lives in `server/config.js` `DEFAULT_CONFIG`; tests and
embedders overlay values via `createGameServer({config: {...}})`. The table
mirrors the source - when in doubt, the source wins.

| Knob | Default | Meaning |
| --- | --- | --- |
| `port` | `8081` | Listen port (`PORT` env wins at boot; `0` = ephemeral for tests). |
| `heartbeatIntervalMs` | `5000` | Server sends `ping` to each connection this often. |
| `heartbeatTimeoutMs` | `15000` | Drop a connection after this much inbound silence. |
| `rateWarnPerSec` | `30` | Messages/second that trigger `error{code:'rate'}` warning. |
| `rateKickPerSec` | `60` | Messages/second that get the connection kicked (close 1008). |
| `maxPayloadBytes` | `262144` | Max wire frame size accepted by `ws`. |
| `resumeGraceMs` | `90000` | Grace window to resume after a mid-match socket drop. |
| `maxNameLen` | `24` | Display-name length cap (`hello{name}` is sanitized + clamped). |
| `lobbyCodeAlphabet` | no I/L/O/0/1 | Unambiguous alphabet for lobby codes. |
| `lobbyCodeLength` | `4` | Lobby code length. |
| `quickMatchCountdownMs` | `30000` | Quick-match auto-start countdown once >= 2 humans are seated. |
| `lobbyIdleMs` | `600000` | Reap lobbies with zero connected humans and no running room after this long. |
| `maxLobbies` | `500` | Hard cap on concurrent lobbies; `create_lobby` beyond it fails with `error{code:'full'}`. |
| `shutdownFlushMs` | `250` | Graceful shutdown: time for the shutdown notice to flush. |
| `decisionTimeoutMs` | `25000` | A human gets this long to answer an awaited decision, then the bot host decides. |
| `botDelayMinMs` / `botDelayMaxMs` | `500` / `1200` | Humanized bot decision delay range. |
| `mgTickHz` | `30` | Minigame fixed-step rate (must match shared `TICK_RATE`). |
| `mgBroadcastHz` | `15` | `mg_state` broadcast rate. |
| `mgMaxCatchUpSteps` | `5` | Max fixed steps recovered per interval fire (drift catch-up cap). |
| `chatMaxLen` | `200` | Chat message length cap. |
| `chatIntervalMs` | `1000` | Minimum interval between chat messages per player. |
| `rematchKeepMs` | `60000` | Keep a finished room alive this long, then reopen the lobby for a rematch. |

Additional input-sanity caps (constants in `server/lobbies.js`): join codes
are clamped to 16 chars before lookup, board/character ids echoed in error
messages are clamped to 64 chars, and rules string-arrays
(`minigameCategories`, `startItems`) are clamped to 32 entries x 64 chars.
One lobby per connection: creating while already seated fails with
`error{code:'lobby'}`.

## Hostile input

The server never crashes on bad input: malformed/binary/oversized frames
are counted (`stats.malformed`) and ignored, well-formed frames with a wrong
protocol version get `error{code:'version'}`, and a last-resort try/catch
around the message handler guarantees one bad message cannot take the
process down. Clients only ever act for themselves; every action is
re-validated against the authoritative sim.

## Scaling

- **One process per region.** All state is in-memory, so a lobby/room only
  exists on the process that created it; there is no cross-process routing.
  Point each region's clients at that region's URL (query param or
  `VITE_MP_SERVER`).
- **Rooms are independent.** Each match room owns its own timers/sim and
  broadcasts only to its own lobby's seats, so a single process scales with
  CPU across many concurrent rooms; the 30Hz minigame steppers are the
  dominant per-room cost.
- Vertical scaling first. If one region outgrows a process, shard by
  fronting several processes under distinct hostnames/paths (e.g.
  `/ws1`, `/ws2`) - lobby codes are only meaningful within one process.
