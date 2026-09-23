export const delimiters = [',', ';', '\t', '|'] as const;
export type Delimiter = typeof delimiters[number];

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/** Picks the delimiter that yields the most consistent column count across the first lines. */
export function detectDelimiter(csv: string): Delimiter {
  const sample = csv.split(/\r?\n/).filter(line => line.trim() !== '').slice(0, 10);

  if (sample.length === 0) {
    return ',';
  }

  let best: { delimiter: Delimiter; score: number } = { delimiter: ',', score: -1 };

  for (const delimiter of delimiters) {
    const counts = sample.map(line => parseCsvLine(line, delimiter).length);
    const columns = counts[0];
    const isConsistent = counts.every(count => count === columns);
    // More columns is a better signal, but only when every sampled row agrees.
    const score = columns > 1 && isConsistent ? columns : 0;

    if (score > best.score) {
      best = { delimiter, score };
    }
  }

  return best.delimiter;
}

function parseCsvLine(line: string, delimiter: Delimiter): string[] {
  return parseCsv(line, { delimiter, hasHeader: false }).rows[0] ?? [];
}

/** RFC 4180 parser: quoted fields may hold the delimiter, line breaks and doubled quotes. */
export function parseCsv(
  csv: string,
  { delimiter = ',', hasHeader = true, trimValues = false }: { delimiter?: Delimiter; hasHeader?: boolean; trimValues?: boolean } = {},
): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let hasContent = false;

  const pushField = () => {
    row.push(trimValues ? field.trim() : field);
    field = '';
  };

  const pushRow = () => {
    pushField();
    // Ignore the trailing empty line most files end with.
    if (hasContent || row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
    row = [];
    hasContent = false;
  };

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        }
        else {
          inQuotes = false;
        }
      }
      else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      hasContent = true;
      continue;
    }

    if (char === delimiter) {
      pushField();
      hasContent = true;
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      pushRow();
      continue;
    }

    field += char;
    hasContent = true;
  }

  if (field !== '' || row.length > 0 || hasContent) {
    pushRow();
  }

  if (!hasHeader) {
    return { headers: [], rows };
  }

  const [headers = [], ...body] = rows;

  return { headers, rows: body };
}

export function inferValue(raw: string): string | number | boolean | null {
  const value = raw.trim();

  if (value === '') {
    return '';
  }

  if (value === 'null' || value === 'NULL') {
    return null;
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  // Keep values that would lose information as numbers (leading zeros, huge integers).
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    const asNumber = Number(value);

    if (Number.isFinite(asNumber) && String(asNumber) === value) {
      return asNumber;
    }
  }

  return raw;
}

export function csvToJson(
  csv: string,
  {
    delimiter,
    hasHeader = true,
    inferTypes = true,
    trimValues = false,
  }: { delimiter?: Delimiter | 'auto'; hasHeader?: boolean; inferTypes?: boolean; trimValues?: boolean } = {},
): { headers: string[]; rows: string[][]; data: unknown[] } {
  if (csv.trim() === '') {
    return { headers: [], rows: [], data: [] };
  }

  const resolvedDelimiter = !delimiter || delimiter === 'auto' ? detectDelimiter(csv) : delimiter;
  const { headers, rows } = parseCsv(csv, { delimiter: resolvedDelimiter, hasHeader, trimValues });
  const cast = (value: string) => (inferTypes ? inferValue(value) : value);

  if (!hasHeader) {
    return { headers, rows, data: rows.map(row => row.map(cast)) };
  }

  const data = rows.map(row =>
    Object.fromEntries(headers.map((header, index) => [header, cast(row[index] ?? '')])),
  );

  return { headers, rows, data };
}
