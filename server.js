import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validSettings } from './public/shared.js';
import { aiConfig, structuredAI, generationInstructions, gradingInstructions, questionSchema, gradeSchema, validQuestion, validGrade } from './ai.js';

const root = new URL('./public/', import.meta.url);
const staticFiles = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/shared.js': ['shared.js', 'text/javascript'], '/demo.js': ['demo.js', 'text/javascript'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createApp({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const ai = aiConfig(env);
  const key = env.TOKEN_SECRET ? createHash('sha256').update(env.TOKEN_SECRET).digest() : randomBytes(32);
  const limits = new Map();
  let active = 0;
  function seal(data) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify({ ...data, issued: now() })), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
  }
  function open(token, kind, maxAge) {
    try {
      if (typeof token !== 'string' || token.length > 24000) throw 0;
      const bytes = Buffer.from(token, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]));
      if (data.kind !== kind || now() - data.issued > maxAge || data.issued > now()) throw 0;
      return data;
    } catch { throw fail(kind === 'session' ? 401 : 400, kind === 'session' ? '利用パスワードを入力してください。' : '問題の有効期限が切れたか、問題情報が無効です。新しい問題を作成してください。'); }
  }
  const passwordDigest = value => createHash('sha256').update(value).digest();
  function authenticate(req) {
    if (!env.APP_PASSWORD) return;
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('em_session='))?.slice(11);
    const session = open(token, 'session', 12 * 3600_000);
    if (session.password !== passwordDigest(env.APP_PASSWORD).toString('hex')) throw fail(401, '利用パスワードを入力してください。');
  }
  function rateLimit(req) {
    const time = now();
    for (const [id, entry] of limits) if (time >= entry.until) limits.delete(id);
    const id = req.socket.remoteAddress;
    if (!limits.has(id)) {
      if (limits.size >= 5000) throw fail(429, '混み合っています。しばらくお待ちください。');
      limits.set(id, { count: 0, until: time + 3600_000 });
    }
    if (++limits.get(id).count > 100) throw fail(429, '利用回数の上限です。1時間ほどおいて再試行してください。');
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSONで送信してください。');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32000) throw fail(413, '入力が長すぎます。');
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try { const parsed = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw 0; return parsed; }
    catch { throw fail(400, '入力形式が正しくありません。'); }
  }
  return http.createServer(async (req, res) => {
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && staticFiles[path]) {
        const [file, type] = staticFiles[path];
        const data = await readFile(new URL(file, root));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        return res.end(data);
      }
      if (path === '/api/config' && req.method === 'GET') {
        let authenticated = true;
        try { authenticate(req); } catch { authenticated = false; }
        return send(200, { aiEnabled: Boolean(ai.apiKey), provider: ai.provider, passwordRequired: Boolean(env.APP_PASSWORD), authenticated });
      }
      if (!['/api/session', '/api/question', '/api/grade'].includes(path)) return send(404, { error: 'ページが見つかりません。' });
      if (req.method !== 'POST') return send(405, { error: 'POSTで送信してください。' }, { Allow: 'POST' });
      const expectedOrigin = env.PUBLIC_ORIGIN || `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== expectedOrigin) throw fail(403, '許可されていない送信元です。');
      rateLimit(req);
      const data = await body(req);
      if (path === '/api/session') {
        if (typeof data.password !== 'string' || data.password.length > 1000 || !env.APP_PASSWORD || !timingSafeEqual(passwordDigest(data.password), passwordDigest(env.APP_PASSWORD))) throw fail(401, 'パスワードが違います。');
        const token = seal({ kind: 'session', password: passwordDigest(env.APP_PASSWORD).toString('hex') });
        const secure = expectedOrigin.startsWith('https://') ? '; Secure' : '';
        return send(200, { ok: true }, { 'Set-Cookie': `em_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}` });
      }
      authenticate(req);
      if (!ai.apiKey) throw fail(503, 'AI接続は未設定です。サンプルモードをご利用ください。');
      if (active >= 3) throw fail(429, 'AIが処理中です。少し待って再試行してください。');
      let question;
      if (path === '/api/question' && !validSettings(data)) throw fail(400, '出題条件を選び直してください。');
      if (path === '/api/grade') {
        if (typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 2000) throw fail(400, '回答は1〜2000文字で入力してください。');
        question = open(data.token, 'question', 2 * 3600_000).question;
      }
      active++;
      try {
        if (path === '/api/question') {
          const settings = { topic: data.topic, vocabulary: data.vocabulary, syntax: data.syntax };
          const q = await structuredAI({ env, fetchImpl, instructions: generationInstructions(settings), input: { nonce: randomBytes(8).toString('hex') }, schema: questionSchema, name: 'english_question' });
          if (!validQuestion(q)) throw fail(502, '出題内容を読み取れませんでした。再試行してください。');
          return send(200, { sentence: q.sentence, hint: q.hint, settings, token: seal({ kind: 'question', question: q }) });
        }
        const g = await structuredAI({ env, fetchImpl, instructions: gradingInstructions, input: { sentence: question.sentence, referenceTranslation: question.translation, studentAnswer: data.answer.trim() }, schema: gradeSchema, name: 'english_grade' });
        if (!validGrade(g)) throw fail(502, '採点内容を読み取れませんでした。再試行してください。');
        return send(200, { ...g, translation: question.translation, explanation: question.explanation });
      } finally { active--; }
    } catch (error) {
      const status = error.status || 502;
      const message = error.name === 'TimeoutError' ? 'AIの応答がタイムアウトしました。もう一度お試しください。' : error.status ? error.message : 'AIの応答を処理できませんでした。もう一度お試しください。';
      if (!res.headersSent) send(status, { error: message });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  if (aiConfig(process.env).apiKey && !['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.APP_PASSWORD) {
    throw new Error('公開するAIサーバーには APP_PASSWORD を設定してください。');
  }
  const port = Number(process.env.PORT || 3000);
  const app = createApp();
  app.requestTimeout = 60_000;
  app.listen(port, host, () => console.log(`English Master: http://${host}:${port}`));
}
