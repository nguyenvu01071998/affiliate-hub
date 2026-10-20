import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base, auth, apiKey;
const call = (path, { method = 'GET', body, headers = {}, redirect } = {}) =>
  fetch(base + path, {
    method,
    redirect,
    headers: { 'content-type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  });

before(async () => {
  const app = createApp(createDb(':memory:'), { publicUrl: 'http://x' });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}`;
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'a@b.co', password: 'secret1', name: 'Tester' },
  });
  const data = await res.json();
  auth = { authorization: `Bearer ${data.token}` };
  apiKey = data.user.apiKey;
});
after(() => server.close());

test('rejects duplicate email and bad login', async () => {
  const dup = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'a@b.co', password: 'secret1', name: 'x' },
  });
  assert.equal(dup.status, 409);
  const bad = await call('/api/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'nope' } });
  assert.equal(bad.status, 401);
});

test('links require auth and validate input', async () => {
  assert.equal((await call('/api/links')).status, 401);
  const res = await call('/api/links', {
    method: 'POST',
    headers: auth,
    body: { name: 'x', targetUrl: 'javascript:alert(1)' },
  });
  assert.equal(res.status, 400);
});

test('click -> redirect -> postback -> stats', async () => {
  const created = await call('/api/links', {
    method: 'POST',
    headers: auth,
    body: { name: 'Shop', targetUrl: 'https://shop.example/p', commissionRate: 0.2 },
  });
  const { link } = await created.json();

  const redirect = await call(`/r/${link.slug}`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  const clickId = new URL(redirect.headers.get('location')).searchParams.get('click_id');
  assert.ok(clickId);

  const noKey = await call('/api/postback', { method: 'POST', body: { click_id: clickId, amount: 100 } });
  assert.equal(noKey.status, 401);

  const postback = { method: 'POST', headers: { 'x-api-key': apiKey }, body: { click_id: clickId, amount: 100 } };
  const ok = await call('/api/postback', postback);
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).commission, 20);
  assert.equal((await call('/api/postback', postback)).status, 409);

  const { totals, series } = await (await call('/api/stats', { headers: auth })).json();
  assert.equal(totals.clicks, 1);
  assert.equal(totals.conversions, 1);
  assert.equal(totals.commission, 20);
  assert.equal(totals.conversionRate, 1);
  assert.equal(series.length, 14);
});

test('cannot delete a link owned by another user', async () => {
  const other = await (
    await call('/api/auth/register', {
      method: 'POST',
      body: { email: 'c@d.co', password: 'secret1', name: 'Other' },
    })
  ).json();
  const { links } = await (await call('/api/links', { headers: auth })).json();
  const res = await call(`/api/links/${links[0].id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${other.token}` },
  });
  assert.equal(res.status, 404);
});
