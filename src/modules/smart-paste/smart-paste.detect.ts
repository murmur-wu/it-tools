export interface Detection {
  kind: string
  toolPath: string
}

function isJson(text: string): boolean {
  if (!/^[[{]/.test(text)) {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  }
  catch {
    return false;
  }
}

function decodeBase64Url(segment: string): string | undefined {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')).split('').map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
  }
  catch {
    return undefined;
  }
}

function isJwt(text: string): boolean {
  const parts = text.split('.');
  if (parts.length !== 3 || !parts.every((part, index) => /^[A-Za-z0-9_-]*$/.test(part) && (index === 2 || part.length > 0))) {
    return false;
  }
  const header = decodeBase64Url(parts[0]);
  if (!header) {
    return false;
  }
  try {
    return typeof JSON.parse(header).alg === 'string';
  }
  catch {
    return false;
  }
}

function isBase64(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  return compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact) && /[A-Za-z]/.test(compact) && /[0-9+/=]/.test(compact);
}

function isCron(text: string): boolean {
  const fields = text.split(/\s+/);
  return (fields.length === 5 || fields.length === 6) && fields.every(field => /^[\d*/,\-?LW#A-Za-z]+$/.test(field)) && fields.some(field => /[*/,\-]/.test(field));
}

function isYaml(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
  return lines.length >= 2 && lines.filter(line => /^\s*[\w.-]+:(\s|$)/.test(line) || /^\s*-\s/.test(line)).length >= Math.ceil(lines.length * 0.6);
}

const cjkPattern = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

const detectors: { kind: string; toolPath: string; test: (text: string) => boolean }[] = [
  { kind: 'certificate', toolPath: '/certificate-parser', test: text => /-----BEGIN (CERTIFICATE|TRUSTED CERTIFICATE|X509 CRL)-----/.test(text) },
  { kind: 'jwt', toolPath: '/jwt-parser', test: isJwt },
  { kind: 'json', toolPath: '/json-prettify', test: isJson },
  { kind: 'dockerRun', toolPath: '/docker-run-to-docker-compose-converter', test: text => /^docker\s+(container\s+)?run\b/i.test(text) },
  { kind: 'sql', toolPath: '/sql-prettify', test: text => /^\s*(select|insert|update|delete|create|alter|drop|with|merge)\b/i.test(text) },
  { kind: 'xml', toolPath: '/xml-formatter', test: text => /^<(\?xml|!doctype|[a-z])/i.test(text) && />\s*$/.test(text) },
  { kind: 'url', toolPath: '/url-parser', test: text => /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(text) },
  { kind: 'userAgent', toolPath: '/user-agent-parser', test: text => /^Mozilla\/\d/.test(text) },
  { kind: 'ipv4Cidr', toolPath: '/ipv4-subnet-calculator', test: text => /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(text) },
  { kind: 'ipv4', toolPath: '/ipv4-address-converter', test: text => /^(\d{1,3}\.){3}\d{1,3}$/.test(text) },
  { kind: 'mac', toolPath: '/mac-address-lookup', test: text => /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(text) || /^([0-9a-f]{4}\.){2}[0-9a-f]{4}$/i.test(text) },
  { kind: 'color', toolPath: '/color-converter', test: text => /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text) || /^(rgba?|hsla?|hwb|lch|cmyk)\(/i.test(text) },
  { kind: 'timestamp', toolPath: '/date-converter', test: text => /^\d{10}(\d{3})?$/.test(text) },
  { kind: 'date', toolPath: '/date-converter', test: text => /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(text) && !Number.isNaN(Date.parse(text)) },
  { kind: 'cron', toolPath: '/crontab-generator', test: isCron },
  { kind: 'email', toolPath: '/email-normalizer', test: text => text.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean).every(item => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(item)) },
  { kind: 'iban', toolPath: '/iban-validator-and-parser', test: text => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(text.replace(/\s+/g, '').toUpperCase()) },
  { kind: 'yaml', toolPath: '/yaml-prettify', test: isYaml },
  { kind: 'base64', toolPath: '/base64-string-converter', test: isBase64 },
  { kind: 'chinese', toolPath: '/chinese-converter', test: text => cjkPattern.test(text) },
];

export function detectContent(raw: string): Detection[] {
  const text = raw.trim();
  if (!text) {
    return [];
  }

  const matches = detectors.filter(({ test }) => test(text)).map(({ kind, toolPath }) => ({ kind, toolPath }));

  // Any non-empty text can at least be counted and measured
  matches.push({ kind: 'text', toolPath: '/text-statistics' });

  return matches.filter((match, index) => matches.findIndex(other => other.toolPath === match.toolPath) === index);
}
