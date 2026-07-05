# Deploying MONKEY-PARTY

MONKEY-PARTY ships as two independent artifacts:

1. **The client** — a fully static Vite build (`dist/`). Host it on any
   static file host / CDN.
2. **The game server** — `server/index.js`, a plain Node process speaking
   WebSocket (`ws`). Only needed for online multiplayer; couch play works
   with the static client alone.

## 1. Build and host the client

```bash
npm ci
npm run build        # -> dist/
npm run preview      # optional local smoke test on http://localhost:5174
```

Upload `dist/` to your static host (nginx, S3+CloudFront, GitHub Pages,
Netlify, ...). Everything is hashed and immutable except `index.html`:

- `dist/index.html` — serve with `Cache-Control: no-cache` (it changes
  every release).
- `dist/assets/*` — content-hashed; safe to cache forever
  (`Cache-Control: public, max-age=31536000, immutable`).

The app is served from the site root (`base: '/'`, Vite's default). If you
host it under a sub-path, set Vite's `base` accordingly before building.

### Build notes (guarded dynamic imports)

The codebase loads optional sibling packages through guarded dynamic
imports (`import(/* @vite-ignore */ path)` in try/catch). A build-only
plugin in `vite.config.js` rewrites those call sites to an
`import.meta.glob` lookup over `/src` and `/shared`, so all content packs
(boards, characters, items, minigames), the engine, and the UI load from
hashed chunks in production exactly as they do from source files in dev.
Paths that don't resolve inside the project fall back to a native dynamic
import and keep the dev-mode "missing package" tolerance. If you add a NEW
directory outside `src/` or `shared/` that is loaded via guarded imports,
extend the glob list in `vite.config.js`.

Check the browser console on first load: you should see
`[content] registrars loaded: [boards, characters, items, minigames]`
followed by `[boot] ui package mounted` and `[boot] ready`.

## 2. Run the game server

```bash
PORT=8081 node server/index.js
```

- `PORT` env selects the listen port (default 8081).
- The process is self-contained (registers all shared content at boot,
  logs registry counts) and never crashes on hostile input: malformed
  frames are counted and ignored, connections are heart-beaten (ping 5s /
  drop 15s) and rate-limited (warn 30 msg/s, kick 60).
- Run it under a supervisor (systemd, pm2, docker restart policy) for
  automatic restarts.

### In-memory state disclaimer

All server state — lobbies, running matches, resume tokens — lives **in
memory**. There is no database:

- A server restart drops every lobby and running match; clients fall back
  to the main menu and their session resume tokens become useless.
- Horizontal scaling is not supported out of the box: two server instances
  do not share lobbies. Run ONE instance per shard/region and point each
  client deployment at exactly one server.

## 3. How the client finds the server

`src/net/client.js` resolves the WebSocket URL in this priority order:

1. **`?server=` query override (runtime)** — a full `ws://` or `wss://`
   URL, e.g. `https://game.example.com/?server=wss://eu.game.example.com/ws`.
   Lets testers point any deployed client at any server without a rebuild.
2. **`VITE_MP_SERVER` (build time)** — set the env var when building:
   `VITE_MP_SERVER=wss://game.example.com/ws npm run build`. Vite inlines
   it via `import.meta.env`.
3. **Same-origin default** — on `https:` pages the client tries
   `wss://<host>/ws` (a path, so a reverse proxy on the same domain can
   route it); otherwise the dev default `ws://<hostname>:8081`.

Convention: prefer (2) for production deployments and reserve (1) for
testing/staging overrides.

## 4. Reverse proxy + TLS

Browsers require `wss://` on `https://` pages, so terminate TLS in front
of the game server. Example nginx block co-hosting the static client and
proxying `/ws` to the server (matches the same-origin default above):

```nginx
server {
  listen 443 ssl http2;
  server_name game.example.com;

  ssl_certificate     /etc/letsencrypt/live/game.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;

  root /var/www/monkey-party/dist;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /ws {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;    # WebSocket upgrade
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;                   # > server 5s ping interval
  }

  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache";
  }
}
```

Notes:

- Keep `proxy_read_timeout` comfortably above the server's 5s heartbeat so
  idle-but-alive connections are not cut.
- The server checks `PROTOCOL_VERSION` on every frame; deploy client and
  server from the same release so versions match (mismatches are rejected
  with a clear error and the UI asks the player to reload).

## 5. Dev-only behavior that differs in production

- In dev, missing sibling packages are tolerated silently (guarded imports
  simply fail and the boot log lists them under `missing`). The production
  bundle includes everything under `src/` and `shared/`, so a `missing`
  entry in a production boot log indicates a build problem — investigate
  before shipping.
- `npm run preview` binds port 5174 and serves `dist/` exactly as a static
  host would; use it for release smoke tests (menu boots, local match
  starts).
