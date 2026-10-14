export const REPORT_TYPES = ['attendance', 'production', 'inventory', 'dispatch', 'accounts'];

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function csvCell(value) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  // Prevent spreadsheet formula injection when users open exported CSV files.
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows) {
  if (!rows.length) return 'No records found for the selected period.\r\n';
  const headers = Object.keys(rows[0]);
  return [headers.map(csvCell).join(','), ...rows.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n';
}

export function normalizeReportRange(from, to, fallbackDate) {
  const start = from || fallbackDate;
  const end = to || fallbackDate;
  if (!validDate(start) || !validDate(end)) throw new Error('Dates must use YYYY-MM-DD format');
  if (start > end) throw new Error('Start date cannot be after end date');
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  if (days > 366) throw new Error('Date range cannot exceed 367 days');
  return { from: start, to: end };
}
