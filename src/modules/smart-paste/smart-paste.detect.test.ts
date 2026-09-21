import { describe, expect, it } from 'vitest';
import { detectContent } from './smart-paste.detect';

const first = (text: string) => detectContent(text)[0]?.kind;

describe('smart paste detection', () => {
  it('returns nothing for empty input', () => {
    expect(detectContent('')).toEqual([]);
    expect(detectContent('   \n ')).toEqual([]);
  });

  it('always offers text statistics as the last option', () => {
    const detections = detectContent('just some words');
    expect(detections.at(-1)).toEqual({ kind: 'text', toolPath: '/text-statistics' });
  });

  it.each([
    ['jwt', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'],
    ['json', '{"hello": "world"}'],
    ['json', '[1, 2, 3]'],
    ['certificate', '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'],
    ['dockerRun', 'docker run -d -p 8080:80 nginx'],
    ['sql', 'SELECT id, name FROM users WHERE id = 1'],
    ['xml', '<?xml version="1.0"?><root><a>1</a></root>'],
    ['xml', '<div class="x"><p>hi</p></div>'],
    ['url', 'https://example.com/path?q=1#hash'],
    ['userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'],
    ['ipv4Cidr', '192.168.0.0/24'],
    ['ipv4', '10.0.0.1'],
    ['mac', '20:37:06:12:34:56'],
    ['mac', '2037.0612.3456'],
    ['color', '#ff8800'],
    ['color', 'rgb(255, 136, 0)'],
    ['timestamp', '1700000000'],
    ['timestamp', '1700000000123'],
    ['date', '2026-09-21'],
    ['date', '2026-09-21T10:30:00Z'],
    ['cron', '0 */6 * * *'],
    ['email', 'John.Doe+tag@Example.com'],
    ['email', 'a@example.com\nb@example.org'],
    ['iban', 'FR76 3000 6000 0112 3456 7890 189'],
    ['yaml', 'name: demo\nversion: 1\nitems:\n  - a\n  - b'],
    ['base64', 'SGVsbG8gd29ybGQh'],
    ['chinese', '這是一段繁體中文'],
    ['text', 'hello world'],
  ])('detects %s', (kind, text) => {
    expect(first(text)).toBe(kind);
  });

  it('prefers the more specific detector when several match', () => {
    // a JWT is also base64-like; JSON is also text
    expect(detectContent('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoxfQ.').map(d => d.kind)).toContain('jwt');
    expect(first('{"a":1}')).toBe('json');
    expect(first('192.168.0.1')).toBe('ipv4');
  });

  it('does not report duplicate tools', () => {
    const paths = detectContent('2026-09-21').map(d => d.toolPath);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
