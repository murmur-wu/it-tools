import { copyFileSync, createReadStream, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

// Serves the FIGlet fonts bundled with the figlet package from the app itself instead of a CDN.
//
// The ASCII text drawer loads fonts at runtime with fetch(`${fontPath}/${name}.flf`). Pointing
// fontPath to a third-party CDN broke the tool wherever that host was unreachable and sent a
// request to a third party for every font change. The ~290 fonts (~3 MB) are too much to
// bundle, so they are copied next to the build output and served as plain static files:
// dist/<publicPath>/<name>.flf. In development, the same files are served from node_modules.

export const FIGLET_FONTS_PATH = 'figlet-fonts';

export function figletFontsDir(): string {
  const require = createRequire(import.meta.url);
  return resolve(dirname(require.resolve('figlet/package.json')), 'fonts');
}

export function listFigletFonts(fontsDir: string = figletFontsDir()): string[] {
  return readdirSync(fontsDir).filter(fileName => fileName.endsWith('.flf')).sort();
}

export function copyFigletFonts({ fontsDir = figletFontsDir(), outDir }: { fontsDir?: string; outDir: string }): string[] {
  const fonts = listFigletFonts(fontsDir);

  mkdirSync(outDir, { recursive: true });
  for (const fileName of fonts) {
    copyFileSync(resolve(fontsDir, fileName), resolve(outDir, fileName));
  }

  return fonts;
}

export function figletFontsPlugin(): Plugin {
  let outDir = 'dist';

  return {
    name: 'it-tools:figlet-fonts',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      const fontsDir = figletFontsDir();
      const prefix = `/${FIGLET_FONTS_PATH}/`;

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const index = pathname.indexOf(prefix);

        if (index === -1 || !pathname.endsWith('.flf')) {
          next();
          return;
        }

        const fileName = decodeURIComponent(pathname.slice(index + prefix.length));
        if (!listFigletFonts(fontsDir).includes(fileName)) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        createReadStream(resolve(fontsDir, fileName)).pipe(res);
      });
    },
    closeBundle() {
      copyFigletFonts({ outDir: resolve(outDir, FIGLET_FONTS_PATH) });
    },
  };
}
