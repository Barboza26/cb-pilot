import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setStoreFactory, memoryFactory, getJSON, putJSON } from '../netlify/lib/db.mjs';
import { handleWebhook } from '../netlify/lib/payments.mjs';

let factory, failure;
const req = new Request('https://cbpilot.test/api/pay/webhook', { headers: { 'x-webhook-secret': 'test-secret' } });
const hook = id => handleWebhook(req, { type: 'checkout-session.succeeded', data: { id } });
beforeEach(async () => {
  factory = memoryFactory(); failure = null;
  setStoreFactory(name => {
    const store = factory(name);
    return { ...store, async setJSON(key, value, opts) {
      if (failure?.(name, key, value)) { failure = null; throw new Error('simulated storage failure'); }
      return store.setJSON(key, value, opts);
    } };
  });
  process.env.ONVO_WEBHOOK_SECRET = 'test-secret';
  await putJSON('users', 'u/test', { id: 'test', plan: null });
  for (const id of ['one', 'two']) await putJSON('pagos', `p/${id}`, { id, userId: 'test', plan: 'pro', status: 'pending' });
});
const user = async () => (await getJSON('users', 'u/test')).data;
const budget = async () => (await getJSON('pilot', `extra/${new Date().toISOString().slice(0, 7)}`))?.data;
test('avisos simultáneos del mismo pago suman 30 días una sola vez', async () => {
  await Promise.all(Array.from({ length: 5 }, () => hook('one')));
  assert.equal(Object.keys((await user()).paymentReceipts).length, 1);
  assert.ok(Math.abs(Date.parse((await user()).planExpiresAt) - Date.now() - 30 * 864e5) < 5000);
  assert.equal((await budget()).pagos, 1);
});
test('dos compras simultáneas conservan ambos recibos y suman 60 días', async () => {
  await Promise.all([hook('one'), hook('two')]);
  assert.equal(Object.keys((await user()).paymentReceipts).length, 2);
  assert.ok(Math.abs(Date.parse((await user()).planExpiresAt) - Date.now() - 60 * 864e5) < 5000);
  assert.equal((await budget()).pagos, 2);
});
for (const stage of ['users', 'pilot', 'pagos']) test(`reintenta tras fallo en ${stage} sin perder ni duplicar el pago`, async () => {
  failure = name => name === stage;
  await assert.rejects(hook('one'), /simulated/);
  await hook('one');
  assert.equal((await getJSON('pagos', 'p/one')).data.status, 'paid');
  assert.equal((await budget()).pagos, 1);
  assert.ok(Math.abs(Date.parse((await user()).planExpiresAt) - Date.now() - 30 * 864e5) < 5000);
});
