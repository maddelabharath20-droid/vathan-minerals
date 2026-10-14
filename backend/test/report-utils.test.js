import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv, normalizeReportRange, validDate } from '../src/reportUtils.js';

test('CSV quotes commas, quotes and line breaks safely', () => {
  assert.equal(csvCell('Barytes, "Grade 4.2"'), '"Barytes, ""Grade 4.2"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
});

test('CSV neutralizes spreadsheet formula injection', () => {
  assert.equal(csvCell('=HYPERLINK("https://bad.example")'), '"\'=HYPERLINK(""https://bad.example"")"');
  assert.equal(csvCell('-2'), '"\'-2"');
});

test('CSV exports headers and rows; empty report has useful message', () => {
  assert.equal(toCsv([{ name:'Ravi', tonnes:2.5 }]), '"name","tonnes"\r\n"Ravi","2.5"\r\n');
  assert.match(toCsv([]), /No records found/);
});

test('date range accepts valid inclusive dates', () => {
  assert.deepEqual(normalizeReportRange('2026-10-01','2026-10-14','2026-10-14'), {from:'2026-10-01',to:'2026-10-14'});
});

test('date range rejects reversed, malformed and excessively long ranges', () => {
  assert.throws(() => normalizeReportRange('2026-10-15','2026-10-14','2026-10-14'), /cannot be after/);
  assert.throws(() => normalizeReportRange('14-10-2026','2026-10-14','2026-10-14'), /YYYY-MM-DD/);
  assert.throws(() => normalizeReportRange('2024-01-01','2026-10-14','2026-10-14'), /cannot exceed/);
});

test('date validator rejects impossible calendar dates', () => {
  assert.equal(validDate('2026-10-14'), true);
  assert.equal(validDate('2026-99-99'), false);
});
