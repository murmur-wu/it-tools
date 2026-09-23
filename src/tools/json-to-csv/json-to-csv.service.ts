export { getHeaders, convertArrayToCsv };

function getHeaders({ array }: { array: Record<string, unknown>[] }): string[] {
  const headers = new Set<string>();

  array.forEach(item => Object.keys(item).forEach(key => headers.add(key)));

  return Array.from(headers);
}

function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return '';
  }

  const valueAsString = String(value).replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // RFC 4180: a field holding a delimiter or a quote is quoted, and inner quotes are doubled.
  if (valueAsString.includes(',') || valueAsString.includes('"')) {
    return `"${valueAsString.replace(/"/g, '""')}"`;
  }

  return valueAsString;
}

function convertArrayToCsv({ array }: { array: Record<string, unknown>[] }): string {
  const headers = getHeaders({ array });

  const rows = array.map(item => headers.map(header => serializeValue(item[header])));

  return [headers.join(','), ...rows].join('\n');
}
