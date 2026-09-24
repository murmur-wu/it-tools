import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { resolve } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import VueI18n from '@intlify/unplugin-vue-i18n/vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import Unocss from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Icons from 'unplugin-icons/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { type Plugin, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import markdown from 'vite-plugin-vue-markdown';
import svgLoader from 'vite-svg-loader';
import { configDefaults } from 'vitest/config';

const baseUrl = process.env.BASE_URL ?? '/';

function getGitValue(command: string, fallback: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  }
  catch {
    return fallback;
  }
}

// Commit being deployed: Cloudflare Workers Builds, Cloudflare Pages, Vercel, then the local git checkout
const appCommitSha = process.env.WORKERS_CI_COMMIT_SHA
  ?? process.env.CF_PAGES_COMMIT_SHA
  ?? process.env.VERCEL_GIT_COMMIT_SHA
  ?? getGitValue('git rev-parse HEAD', '');

// CalVer (YYYY.MM.DD) of the deployed commit, falling back to the build date
const appVersion = getGitValue('git log -1 --format=%cs', new Date().toISOString().slice(0, 10)).replace(/-/g, '.');

// Public URL of the deployed site (canonical links, sitemap, analytics gating)
const siteUrl = (process.env.VITE_SITE_URL ?? 'https://ittools.heitang.info').replace(/\/$/, '');

// Writes dist/sitemap.xml listing the home page and every tool route at build time
function sitemapPlugin(): Plugin {
  let outDir = 'dist';

  return {
    name: 'it-tools:sitemap',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const toolsDir = resolve(__dirname, 'src/tools');
      const toolPaths = readdirSync(toolsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => resolve(toolsDir, entry.name, 'index.ts'))
        .map((file) => {
          try {
            return readFileSync(file, 'utf-8').match(/^\s*path:\s*'([^']+)'/m)?.[1];
          }
          catch {
            return undefined;
          }
        })
        .filter((path): path is string => typeof path === 'string');

      const lastmod = appVersion.replace(/\./g, '-');
      const urls = ['/', '/about', '/privacy', ...toolPaths.sort()]
        .map(path => `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
        .join('\n');

      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueI18n({
      runtimeOnly: true,
      jitCompilation: true,
      compositionOnly: true,
      fullInstall: true,
      strictMessage: false,
      include: [
        resolve(__dirname, 'locales/**'),
      ],
    }),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        'vue-i18n',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
        },
      ],
      vueTemplate: true,
      eslintrc: {
        enabled: true,
      },
    }),
    Icons({ compiler: 'vue3' }),
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
    vueJsx(),
    markdown(),
    svgLoader(),
    sitemapPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        // Pages come from the network whenever the visitor is online, so a new deploy (new tools,
        // new routes) shows up on the first visit instead of after the service worker updates.
        // Offline, the precached index.html is served; it always matches the precached scripts.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
            options: {
              precacheFallback: { fallbackURL: 'index.html' },
            },
          },
          {
            // The PDF compressor's Ghostscript engine (~15 MB) is too large to precache; its file name
            // is content-hashed, so once downloaded it can be served from the cache for good.
            urlPattern: ({ url }) => /\/assets\/gs-[\w-]+\.wasm$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ghostscript-wasm',
              expiration: { maxEntries: 1 },
            },
          },
        ],
      },
      manifest: {
        name: 'IT Tools',
        short_name: 'IT Tools',
        description: '開發者的實用工具箱 - Handy online tools for developers and IT people.',
        display: 'standalone',
        lang: 'zh-TW',
        start_url: `${baseUrl}?utm_source=pwa&utm_medium=pwa`,
        orientation: 'any',
        theme_color: '#18a058',
        background_color: '#f1f5f9',
        icons: [
          {
            src: '/favicon-16x16.png',
            type: 'image/png',
            sizes: '16x16',
          },
          {
            src: '/favicon-32x32.png',
            type: 'image/png',
            sizes: '32x32',
          },
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    Components({
      dirs: ['src/'],
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [NaiveUiResolver(), IconsResolver({ prefix: 'icon' })],
    }),
    Unocss(),
  ],
  base: baseUrl,
  worker: {
    // The Ghostscript loader is an ES module (it uses import.meta.url), which classic workers cannot run
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@okathira/ghostpdl-wasm'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.APP_COMMIT_SHA': JSON.stringify(appCommitSha),
    'import.meta.env.APP_SITE_URL': JSON.stringify(siteUrl),
  },
  test: {
    exclude: [...configDefaults.exclude, '**/*.e2e.spec.ts'],
  },
  build: {
    target: 'esnext',
  },
});
