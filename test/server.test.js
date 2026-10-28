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
  const app = createApp({ env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-not-real', ...env }, fetchImpl, now });
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

const geminiResponse = value => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'private thinking' }, { text: JSON.stringify(value) }] } }] }));
test('Gemini generates and grades using JSON schema, keeps key in header, never falls back to OpenAI', async t => {
  const requests = [];
  const api = await setup(t, { env: { AI_PROVIDER: '', GEMINI_API_KEY: 'gemini-test-key' }, fetchImpl: async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return geminiResponse(requests.length === 1 ? question : grade);
  } });
  const config = await (await api.get('/api/config')).json();
  assert.equal(config.provider, 'gemini'); assert.equal(config.aiEnabled, true);
  assert.ok(!JSON.stringify(config).includes('gemini-test-key'));
  const q = await (await api.post('/api/question', settings)).json(); assert.equal(q.sentence, question.sentence); assert.equal(q.translation, undefined);
  assert.match(requests[0].url, /models\/gemini-3.1-flash-lite:generateContent$/);
  assert.ok(!requests[0].url.includes('gemini-test-key'));
  assert.equal(requests[0].headers['x-goog-api-key'], 'gemini-test-key'); assert.equal(requests[0].headers.Authorization, undefined);
  assert.match(requests[0].body.systemInstruction.parts[0].text, /単語: 中学レベル。構文: 発展/);
  assert.equal(requests[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(requests[0].body.generationConfig.responseJsonSchema.additionalProperties, false);
  const graded = await api.post('/api/grade', { token: q.token, answer: '家への道で鳥を見ました。' });
  assert.equal(graded.status, 200); assert.equal((await graded.json()).score, 95);
  const input = JSON.parse(requests[1].body.contents[0].parts[0].text);
  assert.equal(input.sentence, question.sentence); assert.equal(input.referenceTranslation, question.translation);
});
test('default Gemini requires its own key even when an old OpenAI key exists', async t => {
  let calls = 0;
  const api = await setup(t, { env: { AI_PROVIDER: '' }, fetchImpl: async () => { calls++; return aiResponse(question); } });
  assert.equal((await (await api.get('/api/config')).json()).aiEnabled, false);
  assert.equal((await api.post('/api/question', settings)).status, 503); assert.equal(calls, 0);
});
test('Gemini errors, safety blocks, empty responses, malformed JSON and truncation are rejected safely', async t => {
  const responses = [() => new Response('private provider detail', { status: 429 }), () => new Response('private provider detail', { status: 403 }),
    () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })),
    () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] })),
    () => new Response(JSON.stringify({ candidates: [] })),
    () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'invalid-json' }] } }] }))];
  for (const response of responses) {
    const api = await setup(t, { env: { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key' }, fetchImpl: async () => response() });
    const r = await api.post('/api/question', settings); assert.equal(r.status, 502);
    const data = await r.text(); assert.ok(!data.includes('private provider detail')); assert.ok(!data.includes('gemini-test-key'));
  }
});
test('Gemini custom model is used and invalid provider fails configuration', async t => {
  const api = await setup(t, { env: { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key', GEMINI_MODEL: 'custom-model' }, fetchImpl: async url => {
    assert.match(url, /models\/custom-model:generateContent$/); return geminiResponse(question);
  } });
  assert.equal((await api.post('/api/question', settings)).status, 200);
  assert.throws(() => createApp({ env: { AI_PROVIDER: 'typo' } }), /AI_PROVIDER/);
});

const ollamaResponse = value => new Response(JSON.stringify({ done: true, done_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }));
test('Ollama generation and grading stay on localhost with no API keys', async t => {
  const requests = [];
  const api = await setup(t, { env: { AI_PROVIDER: 'ollama', GEMINI_API_KEY: 'not-for-local-use' }, fetchImpl: async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return ollamaResponse(requests.length === 1 ? question : grade);
  } });
  const config = await (await api.get('/api/config')).json();
  assert.equal(config.provider, 'ollama'); assert.equal(config.aiEnabled, true); assert.equal(config.requestTimeoutMs, 190000);
  const q = await (await api.post('/api/question', settings)).json(); assert.equal(q.sentence, question.sentence); assert.equal(q.translation, undefined);
  assert.equal(requests[0].url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(requests[0].redirect, 'error'); assert.deepEqual(requests[0].headers, { 'Content-Type': 'application/json' });
  const payload = requests[0].body;
  assert.equal(payload.model, 'qwen3:4b'); assert.equal(payload.stream, false); assert.equal(payload.think, false);
  assert.equal(payload.options.num_ctx, 4096); assert.equal(payload.format.type, 'object');
  assert.match(payload.messages[0].content, /単語: 中学レベル。構文: 発展/);
  const r = await api.post('/api/grade', { token: q.token, answer: '家に帰る途中で鳥を見ました。', sentence: 'tampered' });
  assert.equal(r.status, 200); assert.equal((await r.json()).score, 95);
  assert.equal(requests[1].body.options.temperature, 0);
  assert.equal(JSON.parse(requests[1].body.messages[1].content).sentence, question.sentence);
  assert.ok(!JSON.stringify(requests).includes('test-key-not-real')); assert.ok(!JSON.stringify(requests).includes('not-for-local-use'));
});
test('Ollama refuses external endpoints, credentials, paths and cloud-tagged models', () => {
  for (const address of ['https://127.0.0.1:11434', 'http://evil.example', 'http://127.0.0.1.evil.example', 'http://user:pass@localhost:11434', 'http://127.0.0.1:11434/path', 'http://localhost:11434?url=external', 'http://localhost:11434#external']) {
    assert.throws(() => createApp({ env: { AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: address } }), /OLLAMA_BASE_URL/);
  }
  assert.throws(() => createApp({ env: { AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3:cloud' } }), /OLLAMA_MODEL/);
});
test('Ollama missing-model and connection errors give actionable messages without cloud fallback', async t => {
  for (const [fetchImpl, expected] of [
    [async () => new Response('private detail', { status: 404 }), /ollama pull qwen3:4b/],
    [async () => { throw new TypeError('private network detail'); }, /Ollamaアプリを起動/],
    [async () => { throw new DOMException('private detail', 'TimeoutError'); }, /タイムアウト/],
    [async () => new Response('private detail', { status: 500 }), /メモリー不足/],
  ]) {
    let calls = 0;
    const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async (...args) => { calls++; return fetchImpl(...args); } });
    const r = await api.post('/api/question', settings); assert.equal(r.status, 502);
    const result = await r.text(); assert.match(result, expected); assert.ok(!result.includes('private')); assert.equal(calls, 1);
  }
});
test('Ollama rejects truncated, invalid and malformed output', async t => {
  for (const result of [{ done: false }, { done: true, done_reason: 'length', message: { content: '{}' } }, { done: true, done_reason: 'stop', message: { content: 'invalid JSON' } }]) {
    const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async () => new Response(JSON.stringify(result)) });
    assert.equal((await api.post('/api/question', settings)).status, 502);
  }
});
test('Ollama permits only one concurrent inference and releases slot afterward', async t => {
  let release; let started;
  const ready = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async () => { started(); await gate; return ollamaResponse(question); } });
  const first = api.post('/api/question', settings); await ready;
  assert.equal((await api.post('/api/question', settings)).status, 429);
  release(); assert.equal((await first).status, 200);
  assert.equal((await api.post('/api/question', settings)).status, 200);
});

test('selected Ollama generation temperature reaches model while grading stays at zero', async t => {
  const requests = [];
  const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async (url, options) => {
    requests.push(JSON.parse(options.body)); return ollamaResponse(requests.length === 1 ? question : grade);
  } });
  const r = await api.post('/api/question', { ...settings, temperature: 1.2 }); assert.equal(r.status, 200);
  const q = await r.json(); assert.equal(q.settings.temperature, 1.2); assert.equal(requests[0].options.temperature, 1.2);
  const graded = await api.post('/api/grade', { token: q.token, answer: '家に帰る途中で鳥を見ました。', temperature: 1.5 });
  assert.equal(graded.status, 200); assert.equal(requests[1].options.temperature, 0);
});
test('generation accepts zero and upper limit, defaults old requests to 0.7', async t => {
  const requests = [];
  const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async (url, options) => { requests.push(JSON.parse(options.body)); return ollamaResponse(question); } });
  for (const temperature of [0, 1.5, undefined]) {
    const r = await api.post('/api/question', { ...settings, temperature }); assert.equal(r.status, 200);
    assert.equal(requests.at(-1).options.temperature, temperature ?? 0.7);
  }
});
test('invalid temperatures are rejected before contacting the model', async t => {
  let calls = 0;
  const api = await setup(t, { env: { AI_PROVIDER: 'ollama' }, fetchImpl: async () => { calls++; return ollamaResponse(question); } });
  for (const temperature of [-0.1, 1.6, null, '1.2', {}, []]) assert.equal((await api.post('/api/question', { ...settings, temperature })).status, 400);
  assert.equal(calls, 0);
  assert.equal(validSettings({ ...settings, temperature: NaN }), false);
  assert.equal(validSettings({ ...settings, temperature: Infinity }), false);
});
