import { marked } from 'marked';

// Build-time generation of one static HTML file per route.
//
// The app is a single-page application: without this, every URL returns the same empty
// `<div id="app"></div>` with the same title and description, and the content only appears once
// the JavaScript has run. Each generated page is a copy of the built index.html with its own
// title, description, canonical URL and readable content placed inside #app. Vue replaces that
// content when it mounts, so visitors with JavaScript see the normal app.

export interface ToolRoute {
  path: string
  redirectFrom: string[]
}

export interface StaticPage {
  fileName: string
  path: string
  title: string
  description: string
  body: string
  noindex?: boolean
}

type Messages = Record<string, unknown>;

export function parseToolRoute(source: string): ToolRoute | undefined {
  const path = source.match(/^\s*path:\s*'([^']+)'/m)?.[1];

  if (!path) {
    return undefined;
  }

  const redirectList = source.match(/^\s*redirectFrom:\s*\[([^\]]*)\]/m)?.[1] ?? '';
  const redirectFrom = [...redirectList.matchAll(/'([^']+)'/g)].map(([, redirect]) => redirect);

  return { path, redirectFrom };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resolves the vue-i18n message syntax used in the locale files: {'@'} literals and {name} parameters
export function formatMessage(message: string, params: Record<string, string> = {}): string {
  return message.replace(/\{\s*(?:'([^']*)'|(\w+))\s*\}/g, (match, literal: string | undefined, name: string | undefined) => {
    if (literal !== undefined) {
      return literal;
    }

    return name !== undefined && name in params ? params[name] : match;
  });
}

function lookup(messages: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    messages,
  );
}

function text(messages: Messages, key: string, params?: Record<string, string>): string {
  const message = lookup(messages, key);

  if (typeof message !== 'string') {
    throw new TypeError(`Missing message "${key}" for the static pages`);
  }

  return formatMessage(message, params);
}

function list(messages: Messages, key: string): unknown[] {
  const value = lookup(messages, key);
  return Array.isArray(value) ? value : [];
}

function toolKey({ path }: { path: string }) {
  return path.replace(/^\//, '');
}

function fileNameOf(path: string) {
  return path === '/' ? 'index.html' : `${path.replace(/^\//, '')}.html`;
}

// First paragraph of a markdown text that reads as a sentence, without its link syntax
function summaryOf(markdown: string, fallback: string): string {
  return markdown
    .split('\n')
    .map(line => line.trim().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
    .find(line => line.length > 40 && !line.startsWith('#') && !line.startsWith('-')) ?? fallback;
}

function renderList(tag: 'ul' | 'ol', items: string[]) {
  return `<${tag}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
}

function renderGuide(messages: Messages, key: string): string {
  const guideKey = `tools.${key}.guide`;

  if (typeof lookup(messages, `${guideKey}.intro`) !== 'string') {
    return '';
  }

  const sections: string[] = [
    `<h2>${escapeHtml(text(messages, 'toolGuide.title', { tool: text(messages, `tools.${key}.title`) }))}</h2>`,
    `<p>${escapeHtml(text(messages, `${guideKey}.intro`))}</p>`,
  ];

  for (const [section, tag] of [['useCases', 'ul'], ['steps', 'ol'], ['notes', 'ul']] as const) {
    const items = list(messages, `${guideKey}.${section}`).map(item => formatMessage(String(item)));

    if (items.length > 0) {
      sections.push(`<h3>${escapeHtml(text(messages, `toolGuide.${section}`))}</h3>`, renderList(tag, items));
    }
  }

  const faq = list(messages, `${guideKey}.faq`) as { q: string; a: string }[];

  if (faq.length > 0) {
    sections.push(
      `<h3>${escapeHtml(text(messages, 'toolGuide.faq'))}</h3>`,
      `<dl>${faq.map(({ q, a }) => `<dt>${escapeHtml(formatMessage(q))}</dt><dd>${escapeHtml(formatMessage(a))}</dd>`).join('')}</dl>`,
    );
  }

  return sections.join('\n');
}

const homeLink = (messages: Messages) => `<p><a href="/">${escapeHtml(text(messages, 'home.categories.allTools'))}</a></p>`;

export function buildStaticPages({ messages, tools }: { messages: Messages; tools: ToolRoute[] }): StaticPage[] {
  const sortedTools = [...tools].sort((a, b) => a.path.localeCompare(b.path));
  const subtitle = text(messages, 'home.subtitle');

  const home: StaticPage = {
    fileName: 'index.html',
    path: '/',
    title: `IT Tools - ${subtitle}`,
    description: summaryOf(text(messages, 'about.content'), subtitle),
    body: [
      `<h1>IT Tools - ${escapeHtml(subtitle)}</h1>`,
      `<h2>${escapeHtml(text(messages, 'home.categories.allTools'))}</h2>`,
      `<ul>${sortedTools.map((tool) => {
        const key = toolKey(tool);
        return `<li><a href="${tool.path}">${escapeHtml(text(messages, `tools.${key}.title`))}</a> - ${escapeHtml(text(messages, `tools.${key}.description`))}</li>`;
      }).join('')}</ul>`,
      `<p><a href="/about">${escapeHtml(text(messages, 'home.nav.about'))}</a> · <a href="/privacy">${escapeHtml(text(messages, 'privacy.title'))}</a></p>`,
    ].join('\n'),
  };

  const markdownPage = ({ path, title, contentKey }: { path: string; title: string; contentKey: string }): StaticPage => {
    const markdown = text(messages, contentKey);
    return {
      fileName: fileNameOf(path),
      path,
      title: `${title} - IT Tools`,
      description: summaryOf(markdown, title),
      body: `${marked.parse(markdown, { async: false }) as string}\n${homeLink(messages)}`,
    };
  };

  const toolPages = sortedTools.map((tool): StaticPage => {
    const key = toolKey(tool);
    const title = text(messages, `tools.${key}.title`);
    const description = text(messages, `tools.${key}.description`);

    return {
      fileName: fileNameOf(tool.path),
      path: tool.path,
      title: `${title} - IT Tools`,
      description,
      body: [`<h1>${escapeHtml(title)}</h1>`, `<p>${escapeHtml(description)}</p>`, renderGuide(messages, key), homeLink(messages)]
        .filter(Boolean)
        .join('\n'),
    };
  });

  const notFound: StaticPage = {
    fileName: '404.html',
    path: '/404',
    title: `${text(messages, '404.notFound')} - IT Tools`,
    description: text(messages, '404.sorry'),
    noindex: true,
    body: [
      `<h1>${escapeHtml(text(messages, '404.notFound'))}</h1>`,
      `<p>${escapeHtml(text(messages, '404.sorry'))}</p>`,
      `<p><a href="/">${escapeHtml(text(messages, '404.backHome'))}</a></p>`,
    ].join('\n'),
  };

  return [
    home,
    markdownPage({ path: '/about', title: text(messages, 'home.nav.aboutLabel'), contentKey: 'about.content' }),
    markdownPage({ path: '/privacy', title: text(messages, 'privacy.title'), contentKey: 'privacy.content' }),
    ...toolPages,
    notFound,
  ];
}

// Minimal styling for the static content, only visible until the app mounts (or without JavaScript)
const staticStyle = '<style>.static-page{max-width:720px;margin:40px auto;padding:0 16px;font-family:system-ui,sans-serif;line-height:1.7;color:#333}.static-page a{color:#18a058}@media (prefers-color-scheme:dark){body{background:#1c1c1c}.static-page{color:#ddd}}</style>';

// The replacement is a function so `$` in page content is never read as a replacement pattern
function replaceOnce(html: string, pattern: RegExp, replace: (...groups: string[]) => string, label: string): string {
  if (!pattern.test(html)) {
    throw new Error(`Static pages: could not find ${label} in index.html`);
  }

  return html.replace(pattern, (_match, ...groups: string[]) => replace(...groups));
}

export function renderStaticPage({ template, page, siteUrl }: { template: string; page: StaticPage; siteUrl: string }): string {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const url = `${siteUrl}${page.path}`;

  const metaContent = (attribute: string, name: string, value: string) => (html: string) =>
    replaceOnce(html, new RegExp(`(<meta\\s+${attribute}="${name}"\\s+content=")[^"]*(")`), (start, end) => `${start}${value}${end}`, `${attribute}="${name}"`);

  const replacements: ((html: string) => string)[] = [
    html => replaceOnce(html, /<title>[^<]*<\/title>/, () => `<title>${title}</title>`, '<title>'),
    metaContent('itemprop', 'name', title),
    metaContent('name', 'description', description),
    metaContent('itemprop', 'description', description),
    metaContent('property', 'og:url', url),
    metaContent('property', 'og:title', title),
    metaContent('property', 'og:description', description),
    metaContent('name', 'twitter:title', title),
    metaContent('name', 'twitter:description', description),
    metaContent('name', 'twitter:image:alt', title),
    page.noindex
      ? html => replaceOnce(html, /\s*<link rel="canonical" href="[^"]*" \/>/, () => '\n    <meta name="robots" content="noindex" />', 'canonical link')
      : html => replaceOnce(html, /(<link rel="canonical" href=")[^"]*(")/, (start, end) => `${start}${url}${end}`, 'canonical link'),
    html => replaceOnce(html, /<div id="app"><\/div>/, () => `<div id="app">${staticStyle}<main class="static-page">\n${page.body}\n</main></div>`, '<div id="app">'),
  ];

  return replacements.reduce((html, replace) => replace(html), template);
}

// Cloudflare (and Netlify) _redirects rules for the legacy tool URLs listed in `redirectFrom`
export function buildRedirects(tools: ToolRoute[]): string {
  return tools
    .flatMap(({ path, redirectFrom }) => redirectFrom.map(source => `${source} ${path} 301`))
    .sort()
    .map(line => `${line}\n`)
    .join('');
}
