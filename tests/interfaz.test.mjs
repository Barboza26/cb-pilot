import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(new URL('../public/assets/js/pilot.js', import.meta.url), 'utf8');
function connection(body) {
  const a = src.indexOf('  const fail = (code, message)');
  const b = src.indexOf('  /** Pide una respuesta completa', a);
  const scope = { fetch: async () => new Response(body, { headers: { 'content-type': 'application/x-ndjson' } }), TextDecoder, T: es => es };
  vm.createContext(scope);
  vm.runInContext(src.slice(a, b) + '\nthis.post = post;', scope);
  return scope.post;
}
test('streaming acepta fin de respuesta sin salto de línea y conserva texto UTF-8', async () => {
  const events = [];
  const post = connection('{"t":"text","text":"¡Pura vida! 🦜"}\n{"t":"done"}');
  assert.equal((await post('/api/pilot/chat', {}, undefined, e => events.push(e))).t, 'done');
  assert.equal(events[0].text, '¡Pura vida! 🦜');
});
test('streaming incompleto informa interrupción en lugar de mostrar éxito', async () => {
  await assert.rejects(connection('{"t":"text","text":"hola"}\n')('/', {}, undefined, () => {}), e => e.code === 'cut');
});
test('streaming conserva el error del servidor en la última línea', async () => {
  await assert.rejects(connection('{"t":"error","code":"quota","message":"Sin combustible"}')('/', {}, undefined, () => {}), e => e.code === 'quota');
});
function syncScope(chats, pendingDel, post) {
  const a = src.indexOf('  async function pushChats()');
  const b = src.indexOf('  async function pullChats(', a);
  const saved = {};
  const scope = { syncOn: () => true, syncBusy: false, navigator: { onLine: true },
    read: () => saved, write: () => {}, SYNC_K: () => 'sync', chats, pendingDel,
    running: new Map(), structuredClone, post, syncSoon: () => {}, user: {} };
  vm.createContext(scope); vm.runInContext(src.slice(a, b) + '\nthis.pushChats = pushChats;', scope);
  return { scope, saved };
}
test('editar un chat durante el envío no lo marca como sincronizado con una versión que no se envió', async () => {
  const chats = [{ id: 'a', updated: 1, messages: [{ content: 'antes' }] }];
  const { scope, saved } = syncScope(chats, new Set(), async (_url, body) => {
    assert.equal(body.chats[0].updated, 1);
    chats[0].updated = 2; chats[0].messages[0].content = 'después';
    assert.equal(body.chats[0].messages[0].content, 'antes');
  });
  await scope.pushChats(); assert.equal(saved.a, 1);
});
test('borrar un chat durante la sincronización no pierde eliminaciones pendientes', async () => {
  const pending = new Set(Array.from({ length: 105 }, (_, i) => `id-${i}`));
  const batches = [];
  const { scope } = syncScope([], pending, async (_url, body) => {
    batches.push([...body.ids]); if (batches.length === 1) pending.add('nuevo');
  });
  await scope.pushChats();
  assert.equal(pending.size, 0); assert.equal(batches.flat().length, 106);
  assert.ok(batches.every(ids => ids.length <= 100));
});
