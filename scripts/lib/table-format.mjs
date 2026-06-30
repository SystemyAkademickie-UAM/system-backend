/**
 * Fixed-width ASCII tables for CLI scripts.
 */

/**
 * @param {string} value
 * @param {number} width
 */
export function padCell(value, width) {
  const text = String(value);
  if (text.length >= width) {
    return `${text.slice(0, width - 1)}…`;
  }
  return text.padEnd(width, ' ');
}

/**
 * @param {Array<{ key: string, header: string, width: number }>} columns
 * @param {Array<Record<string, unknown>>} rows
 * @param {(row: Record<string, unknown>, column: { key: string }) => unknown} [formatCell]
 */
export function printTable(columns, rows, formatCell) {
  const header = columns.map((column) => padCell(column.header, column.width)).join('  ');
  const separator = columns.map((column) => '-'.repeat(column.width)).join('  ');
  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const line = columns
      .map((column) => {
        const raw = formatCell ? formatCell(row, column) : row[column.key];
        return padCell(raw ?? '', column.width);
      })
      .join('  ');
    console.log(line);
  }
}

/**
 * @param {Array<{ label: string, value: unknown }>} rows
 */
export function printKeyValueTable(rows) {
  const labelWidth = rows.reduce((max, row) => Math.max(max, row.label.length), 5);
  const valueWidth = rows.reduce((max, row) => Math.max(max, String(row.value ?? '').length), 5);
  const columns = [
    { key: 'label', header: 'Field', width: Math.min(Math.max(labelWidth, 5), 24) },
    { key: 'value', header: 'Value', width: Math.min(Math.max(valueWidth, 5), 72) },
  ];
  printTable(columns, rows);
}
