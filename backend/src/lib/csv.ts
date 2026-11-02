export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
