import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/\\/g, '/');

// Build-only plugin that makes the codebase's guarded dynamic imports work
// in the production bundle.
//
// The codebase loads optional sibling packages via "@vite-ignore" dynamic
// imports of path variables inside try/catch (see e.g. src/main.js
// tryImport, shared/content/index.js, shared/sim/match.js). Vite leaves
// such imports untouched, so in a built app they would resolve against
// /assets/<chunk>.js URLs and 404 - the game would boot to the
// empty-registry placeholder screen.
//
// This transform (build only - the dev server serves source files and needs
// no help) rewrites each guarded import site to a lookup in an
// import.meta.glob map over /src and /shared, keyed by the importing
// module's real source directory. The glob map's loaders are analyzable
// dynamic imports, so every reachable module is bundled into the SAME
// module graph (registry/store singletons stay singletons). Unknown paths
// fall back to a native dynamic import, preserving the guarded
// "missing sibling package" behavior.
function guardedDynamicImports() {
  const IMPORT_RE = /\bimport\s*\(\s*\/\*\s*@vite-ignore\s*\*\/\s*([A-Za-z_$][\w$]*)\s*\)/g;
  return {
    name: 'monkey-party:guarded-dynamic-imports',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const file = id.replace(/\\/g, '/').split('?')[0];
      if (!file.endsWith('.js') || file.includes('/node_modules/')) return null;
      if (!file.startsWith(ROOT) || !code.includes('@vite-ignore')) return null;
      IMPORT_RE.lastIndex = 0;
      if (!IMPORT_RE.test(code)) return null;

      // The importing module's directory as a root-absolute URL dir
      // (e.g. /shared/content/), matching import.meta.glob's key space.
      const rel = `/${file.slice(ROOT.length)}`;
      const dir = rel.slice(0, rel.lastIndexOf('/') + 1);

      IMPORT_RE.lastIndex = 0;
      const rewritten = code.replace(IMPORT_RE, (_m, expr) => `__mpGuardedImport(${expr})`);
      const preamble = `
const __MP_BUNDLED_MODULES__ = import.meta.glob(['/src/**/*.js', '/shared/**/*.js']);
function __mpGuardedImport(path) {
  try {
    const key = new URL(String(path), 'file://${dir}').pathname;
    const load = __MP_BUNDLED_MODULES__[key];
    if (load) return load();
  } catch { /* unresolvable path: fall through to the native import */ }
  return import(/* @vite-ignore */ path);
}
`;
      return { code: preamble + rewritten, map: null };
    },
  };
}

export default defineConfig({
  plugins: [guardedDynamicImports()],
  resolve: {
    alias: {
      // Mirrors the "#shared/*" subpath imports in package.json so both
      // Node (server/tests) and the browser bundle resolve shared/ the same way.
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    // shared/sim/match.js (and src/characters/*) use top-level await for
    // their guarded imports; target modern engines that support it natively.
    target: 'esnext',
    // three.js alone is ~0.5 MB minified - silence the default 500 kB nag.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    host: true,
  },
});
