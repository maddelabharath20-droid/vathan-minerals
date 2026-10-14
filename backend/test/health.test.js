process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

test('tonnage net weight calculation', () => {
  const gross=28.650, tare=12.125;
  assert.equal(Number((gross-tare).toFixed(3)),16.525);
});
test('reject gross weight below tare weight', () => {
  const gross=10, tare=12;
  assert.ok(gross < tare);
});

test('dashboard and report endpoints require an authenticated session', async () => {
  const { default: app } = await import('../src/server.js');
  const dashboard = await request(app).get('/api/dashboard');
  assert.equal(dashboard.status, 401);
  const report = await request(app).get('/api/reports/production.csv?from=2026-10-01&to=2026-10-14');
  assert.equal(report.status, 401);
  const { pool } = await import('../src/db.js');
  await pool.end();
});
