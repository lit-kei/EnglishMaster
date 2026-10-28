import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { validSettings } from '../public/shared.js';
const settings = { topic: 'participle', vocabulary: 'basic', syntax: 'advanced' };
const question = { sentence: 'Walking home, I saw a bird.', translation: '家に歩いて帰る途中、鳥を見ました。', explanation: 'Walking homeは分詞構文で主語はIです。', hint: 'Walkingの主語に注目。' };
const grade = { score: 95, feedback: '意味を正しく捉えています。', strengths: ['分詞構文を適切に訳せています。'], improvements: [] };
const aiResponse = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200 });
async function setup(t, { env = {}, fetchImpl = async () => aiResponse(question), now } = {}) {
  const app = createApp({ env: { OPENAI_API_KEY: 'test-key-not-real', ...env }, fetchImpl, now });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const base = `http://127.0.0.1:${app.address().port}`;
  return { base, get: path => fetch(base + path), post: (path, data, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) }) };
}
test('settings reject prototype keys and invalid levels', () => {
  assert.equal(validSettings(settings), true);
  assert.equal(validSettings({ ...settings, topic: 'constructor' }), false);
  assert.equal(validSettings({ ...settings, syntax: 'unknown' }), false);
});
test('static site served, private files inaccessible, CSP set', async t => {
  const api = await setup(t);
  const response = await api.get('/'); assert.equal(response.status, 200);
  assert.match(await response.text(), /English Master/); assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const path of ['/.env', '/server.js', '/test/server.test.js', '/not-found']) assert.equal((await api.get(path)).status, 404);
});
test('demo mode reports disabled AI and blocks paid endpoints', async t => {
  const api = await setup(t, { env: { OPENAI_API_KEY: '' } });
  assert.equal((await (await api.get('/api/config')).json()).aiEnabled, false);
  assert.equal((await api.post('/api/question', settings)).status, 503);
});
test('generate and grade: server controls sentence, model answer stays encrypted until grade', async t => {
  const requests = [];
  const api = await setup(t, { fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return aiResponse(requests.length === 1 ? question : grade); } });
  const response = await api.post('/api/question', settings); assert.equal(response.status, 200);
  const q = await response.json(); assert.equal(q.sentence, question.sentence); assert.equal(q.translation, undefined); assert.equal(q.explanation, undefined);
  assert.ok(!Buffer.from(q.token, 'base64url').toString('utf8').includes(question.translation));
  assert.match(requests[0].instructions, /単語: 中学レベル。構文: 発展/);
  assert.equal(requests[0].store, false); assert.equal(requests[0].text.format.strict, true);
  const graded = await api.post('/api/grade', { token: q.token, answer: '帰宅途中に鳥を見かけました。', sentence: 'tampered', translation: 'tampered' });
  assert.equal(graded.status, 200); assert.equal((await graded.json()).score, 95);
  const input = JSON.parse(requests[1].input); assert.equal(input.sentence, question.sentence); assert.equal(input.referenceTranslation, question.translation);
});
test('invalid settings and empty or oversized answers never call AI', async t => {
  let calls = 0; const api = await setup(t, { fetchImpl: async () => { calls++; return aiResponse(question); } });
  assert.equal((await api.post('/api/question', { ...settings, topic: 'x' })).status, 400);
  for (const answer of ['', '   ', 'あ'.repeat(2001)]) assert.equal((await api.post('/api/grade', { token: 'invalid', answer })).status, 400);
  assert.equal(calls, 0);
});
test('tampered and expired question tokens are rejected', async t => {
  let time = 1000; const api = await setup(t, { now: () => time });
  const q = await (await api.post('/api/question', settings)).json();
  assert.equal((await api.post('/api/grade', { token: `x${q.token.slice(1)}`, answer: '訳' })).status, 400);
  time += 2 * 3600_000 + 1;
  assert.equal((await api.post('/api/grade', { token: q.token, answer: '訳' })).status, 400);
});
test('password login, HttpOnly session, wrong password and expired session', async t => {
  let time = 1000; const api = await setup(t, { env: { APP_PASSWORD: 'a-long-test-password', PUBLIC_ORIGIN: 'https://example.com' }, now: () => time });
  assert.equal((await (await api.get('/api/config')).json()).authenticated, false);
  assert.equal((await api.post('/api/question', settings)).status, 401);
  assert.equal((await api.post('/api/session', { password: 'wrong' })).status, 401);
  const login = await api.post('/api/session', { password: 'a-long-test-password' }); assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Strict/); assert.match(cookie, /Secure/);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await api.post('/api/question', settings, headers)).status, 200);
  time += 12 * 3600_000 + 1;
  assert.equal((await api.post('/api/question', settings, headers)).status, 401);
});
test('cross-origin requests are rejected before AI calls', async t => {
  const api = await setup(t);
  assert.equal((await api.post('/api/question', settings, { Origin: 'https://evil.example' })).status, 403);
});
test('rate limit and its reset', async t => {
  let time = 1000; const api = await setup(t, { now: () => time });
  for (let i = 0; i < 100; i++) assert.equal((await api.post('/api/question', {})).status, 400);
  assert.equal((await api.post('/api/question', {})).status, 429);
  time += 3600_001;
  assert.equal((await api.post('/api/question', {})).status, 400);
});
test('upstream errors and invalid model output return safe errors', async t => {
  for (const fetchImpl of [async () => new Response('secret-upstream-details', { status: 401 }), async () => aiResponse({ ...grade, score: 999 }), async () => new Response(JSON.stringify({ status: 'incomplete' })), async () => { throw new DOMException('timeout', 'TimeoutError'); }]) {
    const api = await setup(t, { fetchImpl });
    const response = await api.post('/api/question', settings); assert.equal(response.status, 502);
    const body = await response.text(); assert.ok(!body.includes('secret-upstream-details')); assert.ok(!body.includes('test-key-not-real'));
  }
});
test('grade rejects out-of-range score without revealing invalid output', async t => {
  let calls = 0; const api = await setup(t, { fetchImpl: async () => aiResponse(++calls === 1 ? question : { ...grade, score: 101 }) });
  const q = await (await api.post('/api/question', settings)).json();
  assert.equal((await api.post('/api/grade', { token: q.token, answer: '訳' })).status, 502);
});
test('payload and content-type limits', async t => {
  const api = await setup(t);
  assert.equal((await api.post('/api/question', settings, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await api.post('/api/question', { text: 'a'.repeat(33000) })).status, 413);
});
