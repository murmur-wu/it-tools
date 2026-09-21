import { asn1, md, pki, util } from 'node-forge';

export interface NameAttribute {
  shortName: string
  name: string
  value: string
}

export interface ParsedCertificate {
  pem: string
  version: number
  serialNumber: string
  subject: NameAttribute[]
  issuer: NameAttribute[]
  subjectString: string
  issuerString: string
  isSelfSigned: boolean
  notBefore: Date
  notAfter: Date
  status: 'valid' | 'expired' | 'not-yet-valid'
  daysRemaining: number
  signatureAlgorithm: string
  publicKey: { algorithm: string; size?: number; curve?: string }
  subjectAltNames: string[]
  isCa: boolean | undefined
  pathLength: number | undefined
  keyUsage: string[]
  extendedKeyUsage: string[]
  subjectKeyIdentifier: string | undefined
  authorityKeyIdentifier: string | undefined
  fingerprints: { sha1: string; sha256: string }
}

const shortNames: Record<string, string> = {
  commonName: 'CN',
  countryName: 'C',
  localityName: 'L',
  stateOrProvinceName: 'ST',
  organizationName: 'O',
  organizationalUnitName: 'OU',
  emailAddress: 'E',
  serialName: 'SN',
  domainComponent: 'DC',
};

const publicKeyAlgorithms: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.10': 'RSA-PSS',
  '1.2.840.10045.2.1': 'EC',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.2.840.10040.4.1': 'DSA',
};

const curves: Record<string, { name: string; size: number }> = {
  '1.2.840.10045.3.1.7': { name: 'P-256 (prime256v1)', size: 256 },
  '1.3.132.0.34': { name: 'P-384 (secp384r1)', size: 384 },
  '1.3.132.0.35': { name: 'P-521 (secp521r1)', size: 521 },
  '1.3.132.0.10': { name: 'secp256k1', size: 256 },
};

const signatureAlgorithms: Record<string, string> = {
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.1': 'ECDSA with SHA-1',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
  '1.2.840.10045.4.3.4': 'ECDSA with SHA-512',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
};

const keyUsageNames = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly'];
const extendedKeyUsageNames = ['serverAuth', 'clientAuth', 'codeSigning', 'emailProtection', 'timeStamping', 'ocspSigning'];

const pemBlockPattern = /-----BEGIN ([A-Z0-9 ]*CERTIFICATE)-----([\s\S]*?)-----END \1-----/g;

// node-forge does not type this helper, but it handles SAN, key usage, basic constraints, SKI/AKI, ...
type ForgeExtension = Record<string, unknown> & { name?: string; altNames?: { type: number; value: string; ip?: string }[] };
const certificateExtensionFromAsn1 = (pki as unknown as { certificateExtensionFromAsn1: (ext: asn1.Asn1) => ForgeExtension }).certificateExtensionFromAsn1;

function oidOf(node: asn1.Asn1): string {
  return asn1.derToOid(util.createBuffer(node.value as string));
}

function decodeAsn1String(node: asn1.Asn1): string {
  const bytes = node.value as string;
  if (node.type === asn1.Type.UTF8) {
    return util.decodeUtf8(bytes);
  }
  if (node.type === asn1.Type.BMPSTRING) {
    let out = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
    }
    return out;
  }
  return bytes;
}

function parseName(sequence: asn1.Asn1): NameAttribute[] {
  const attributes: NameAttribute[] = [];
  for (const set of sequence.value as asn1.Asn1[]) {
    for (const attribute of set.value as asn1.Asn1[]) {
      const [typeNode, valueNode] = attribute.value as asn1.Asn1[];
      const oid = oidOf(typeNode);
      const name = pki.oids[oid] ?? oid;
      attributes.push({ name, shortName: shortNames[name] ?? name, value: decodeAsn1String(valueNode) });
    }
  }
  return attributes;
}

function nameToString(attributes: NameAttribute[]): string {
  return attributes.map(({ shortName, value }) => `${shortName}=${value}`).join(', ');
}

function parseTime(node: asn1.Asn1): Date {
  const raw = node.value as string;
  const digits = node.type === asn1.Type.UTCTIME ? `${Number.parseInt(raw.slice(0, 2), 10) < 50 ? '20' : '19'}${raw}` : raw;
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/.exec(digits);
  if (!match) {
    throw new Error('Invalid certificate validity date');
  }
  const [, year, month, day, hour, minute, second = '00'] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
}

function parsePublicKey(spki: asn1.Asn1): ParsedCertificate['publicKey'] {
  const [algorithmSequence, keyBitString] = spki.value as asn1.Asn1[];
  const [algorithmNode, parametersNode] = algorithmSequence.value as asn1.Asn1[];
  const algorithmOid = oidOf(algorithmNode);
  const algorithm = publicKeyAlgorithms[algorithmOid] ?? pki.oids[algorithmOid] ?? algorithmOid;

  if (algorithm === 'EC' && parametersNode?.type === asn1.Type.OID) {
    const curveOid = oidOf(parametersNode);
    const curve = curves[curveOid];
    return { algorithm, curve: curve?.name ?? curveOid, size: curve?.size };
  }

  if (algorithm === 'RSA' || algorithm === 'RSA-PSS') {
    try {
      // BIT STRING holding DER { modulus INTEGER, exponent INTEGER }; forge may have decoded it already,
      // otherwise the first content byte is the number of unused bits
      const rsaPublicKey = Array.isArray(keyBitString.value)
        ? (keyBitString.value as asn1.Asn1[])[0]
        : asn1.fromDer((((keyBitString as asn1.Asn1 & { bitStringContents?: string }).bitStringContents) ?? (keyBitString.value as string)).slice(1));
      const [modulus] = rsaPublicKey.value as asn1.Asn1[];
      const modulusBytes = (modulus.value as string).replace(/^\0+/, '');
      const leadingZeroBits = Math.clz32(modulusBytes.charCodeAt(0)) - 24;
      return { algorithm, size: modulusBytes.length * 8 - leadingZeroBits };
    }
    catch {
      return { algorithm };
    }
  }

  if (algorithm === 'Ed25519') {
    return { algorithm, size: 256 };
  }
  if (algorithm === 'Ed448') {
    return { algorithm, size: 456 };
  }
  return { algorithm };
}

function formatFingerprint(hex: string): string {
  return hex.toUpperCase().match(/.{2}/g)?.join(':') ?? hex;
}

function altNameToString({ type, value, ip }: { type: number; value: string; ip?: string }): string {
  switch (type) {
    case 1: return `email:${value}`;
    case 2: return `DNS:${value}`;
    case 6: return `URI:${value}`;
    case 7: return `IP:${ip ?? value}`;
    default: return value;
  }
}

function parseCertificateDer(derBytes: string, pem: string, now: Date): ParsedCertificate {
  const certificate = asn1.fromDer(derBytes);
  const [tbs, signatureAlgorithmSequence] = certificate.value as asn1.Asn1[];
  const fields = tbs.value as asn1.Asn1[];

  let index = 0;
  let version = 1;
  if (fields[0].tagClass === asn1.Class.CONTEXT_SPECIFIC && fields[0].type === 0) {
    version = ((fields[0].value as asn1.Asn1[])[0].value as string).charCodeAt(0) + 1;
    index = 1;
  }

  const serialNumber = util.createBuffer(fields[index++].value as string).toHex().replace(/^00(?=..)/, '').toUpperCase();
  index++; // signature algorithm inside TBS, same as the outer one
  const issuer = parseName(fields[index++]);
  const [notBeforeNode, notAfterNode] = fields[index++].value as asn1.Asn1[];
  const subject = parseName(fields[index++]);
  const publicKey = parsePublicKey(fields[index++]);

  const extensionsWrapper = fields.slice(index).find(field => field.tagClass === asn1.Class.CONTEXT_SPECIFIC && field.type === 3);
  const extensions: ForgeExtension[] = extensionsWrapper
    ? ((extensionsWrapper.value as asn1.Asn1[])[0].value as asn1.Asn1[]).map((extension) => {
        try {
          return certificateExtensionFromAsn1(extension);
        }
        catch {
          return {};
        }
      })
    : [];
  const extension = (name: string) => extensions.find(item => item.name === name);

  const san = extension('subjectAltName');
  const basicConstraints = extension('basicConstraints');
  const keyUsage = extension('keyUsage');
  const extendedKeyUsage = extension('extKeyUsage');
  const ski = extension('subjectKeyIdentifier');
  const aki = extension('authorityKeyIdentifier');

  const notBefore = parseTime(notBeforeNode);
  const notAfter = parseTime(notAfterNode);
  const status = now < notBefore ? 'not-yet-valid' : now > notAfter ? 'expired' : 'valid';
  const signatureOid = oidOf((signatureAlgorithmSequence.value as asn1.Asn1[])[0]);
  const subjectString = nameToString(subject);
  const issuerString = nameToString(issuer);

  return {
    pem,
    version,
    serialNumber,
    subject,
    issuer,
    subjectString,
    issuerString,
    isSelfSigned: subjectString === issuerString,
    notBefore,
    notAfter,
    status,
    daysRemaining: Math.ceil((notAfter.getTime() - now.getTime()) / 86_400_000),
    signatureAlgorithm: signatureAlgorithms[signatureOid] ?? pki.oids[signatureOid] ?? signatureOid,
    publicKey,
    subjectAltNames: san?.altNames?.map(altNameToString) ?? [],
    isCa: basicConstraints ? Boolean(basicConstraints.cA) : undefined,
    pathLength: typeof basicConstraints?.pathLenConstraint === 'number' ? basicConstraints.pathLenConstraint : undefined,
    keyUsage: keyUsage ? keyUsageNames.filter(name => keyUsage[name] === true) : [],
    extendedKeyUsage: extendedKeyUsage ? extendedKeyUsageNames.filter(name => extendedKeyUsage[name] === true) : [],
    subjectKeyIdentifier: typeof ski?.subjectKeyIdentifier === 'string' ? formatFingerprint(ski.subjectKeyIdentifier) : undefined,
    authorityKeyIdentifier: typeof aki?.keyIdentifier === 'string' ? formatFingerprint(aki.keyIdentifier) : undefined,
    fingerprints: {
      sha1: formatFingerprint(md.sha1.create().update(derBytes).digest().toHex()),
      sha256: formatFingerprint(md.sha256.create().update(derBytes).digest().toHex()),
    },
  };
}

function extractDerBlocks(input: string): { der: string; pem: string }[] {
  const blocks: { der: string; pem: string }[] = [];
  for (const match of input.matchAll(pemBlockPattern)) {
    blocks.push({ der: util.decode64(match[2].replace(/\s+/g, '')), pem: match[0] });
  }
  if (blocks.length > 0) {
    return blocks;
  }

  // No PEM armour: accept a bare base64 DER certificate (a DER SEQUENCE always encodes to "MI...")
  const compact = input.replace(/\s+/g, '');
  if (compact.length % 4 === 0 && /^MI[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    const der = util.decode64(compact);
    return [{ der, pem: `-----BEGIN CERTIFICATE-----\n${compact.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----` }];
  }
  return [];
}

export function parseCertificates(input: string, { now = new Date() }: { now?: Date } = {}): ParsedCertificate[] {
  const blocks = extractDerBlocks(input);
  if (blocks.length === 0) {
    throw new Error('No certificate found. Paste a PEM block (-----BEGIN CERTIFICATE-----) or a base64 DER certificate.');
  }

  return blocks.map(({ der, pem }) => {
    try {
      return parseCertificateDer(der, pem, now);
    }
    catch (error) {
      throw new Error(`Unable to parse certificate: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
