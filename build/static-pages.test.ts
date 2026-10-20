import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildRedirects, buildStaticPages, formatMessage, parseToolRoute, renderStaticPage } from './static-pages';

const template = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');
const messages = parse(readFileSync(resolve(__dirname, '../locales/en.yml'), 'utf-8'));
const siteUrl = 'https://ittools.heitang.info';

describe('static-pages', () => {
  describe('parseToolRoute', () => {
    it('reads the path and the legacy paths of a tool definition', () => {
      const source = 'export const tool = defineTool({\n  path: \'/hash-text\',\n  redirectFrom: [\'/hash\', \'/digest\'],\n});';
      expect(parseToolRoute(source)).toEqual({ path: '/hash-text', redirectFrom: ['/hash', '/digest'] });
    });

    it('defaults to no legacy path', () => {
      expect(parseToolRoute('  path: \'/uuid-generator\',')).toEqual({ path: '/uuid-generator', redirectFrom: [] });
    });

    it('returns undefined without a path', () => {
      expect(parseToolRoute('export {}')).toBeUndefined();
    });
  });

  describe('formatMessage', () => {
    it('resolves vue-i18n literals and named parameters', () => {
      expect(formatMessage('{\'@\'}reboot for {tool}, {unknown}', { tool: 'cron' })).toBe('@reboot for cron, {unknown}');
    });
  });

  describe('buildStaticPages', () => {
    const tools = [{ path: '/hash-text', redirectFrom: ['/hash'] }, { path: '/uuid-generator', redirectFrom: [] }];
    const pages = buildStaticPages({ messages, tools });
    const byPath = Object.fromEntries(pages.map(page => [page.path, page]));

    it('creates the home, about, privacy, tool and 404 pages', () => {
      expect(pages.map(page => page.fileName)).toEqual(['index.html', 'about.html', 'privacy.html', 'hash-text.html', 'uuid-generator.html', '404.html']);
    });

    it('lists every tool with a link on the home page', () => {
      expect(byPath['/'].body).toContain('<a href="/hash-text">Hash text</a>');
      expect(byPath['/'].body).toContain('<a href="/uuid-generator">');
    });

    it('includes the tool guide when the tool has one', () => {
      expect(byPath['/hash-text'].body).toContain('<h2>About Hash text</h2>');
      expect(byPath['/hash-text'].body).toContain('<dt>');
    });

    it('renders the about page markdown', () => {
      expect(byPath['/about'].body).toContain('<h1');
      expect(byPath['/about'].body).toContain('murmur20260202@gmail.com');
      expect(byPath['/about'].description).not.toContain('](');
    });

    it('marks only the 404 page as noindex', () => {
      expect(pages.filter(page => page.noindex).map(page => page.fileName)).toEqual(['404.html']);
    });
  });

  describe('renderStaticPage', () => {
    const page = { fileName: 'x.html', path: '/x', title: 'X & Y - IT Tools', description: 'Costs $1 & <more>', body: '<h1>X</h1>' };

    it('sets the title, description, canonical URL and content of the page', () => {
      const html = renderStaticPage({ template, page, siteUrl });

      expect(html).toContain('<title>X &amp; Y - IT Tools</title>');
      expect(html).toMatch(/name="description"\s+content="Costs \$1 &amp; &lt;more&gt;"/);
      expect(html).toContain('<link rel="canonical" href="https://ittools.heitang.info/x" />');
      expect(html).toContain('<meta property="og:url" content="https://ittools.heitang.info/x" />');
      expect(html).toContain('<main class="static-page">\n<h1>X</h1>\n</main></div>');
      expect(html).not.toContain('Collection of handy online tools');
    });

    it('replaces the canonical link by noindex on noindex pages', () => {
      const html = renderStaticPage({ template, page: { ...page, noindex: true }, siteUrl });

      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(html).not.toContain('rel="canonical"');
    });

    it('fails when the template no longer has an expected tag', () => {
      expect(() => renderStaticPage({ template: '<html></html>', page, siteUrl })).toThrow(/could not find/);
    });
  });

  describe('buildRedirects', () => {
    it('writes one permanent redirect per legacy path', () => {
      expect(buildRedirects([{ path: '/hash-text', redirectFrom: ['/hash'] }, { path: '/b', redirectFrom: [] }])).toBe('/hash /hash-text 301\n');
    });
  });
});
