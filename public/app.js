import { TOPICS, VOCAB, SYNTAX } from './shared.js';
import { demoQuestion } from './demo.js';
const $ = id => document.getElementById(id);
const HISTORY_KEY = 'english-master.history.v1';
let config = { aiEnabled: false, authenticated: true };
let question = null;
let busy = false;
let connectionFailed = false;
let history = [];
try { const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); if (Array.isArray(saved)) history = saved.filter(item => item && typeof item.sentence === 'string' && typeof item.answer === 'string' && typeof item.translation === 'string' && typeof item.explanation === 'string' && typeof item.feedback === 'string' && typeof item.date === 'string' && Number.isInteger(item.score) && item.score >= 0 && item.score <= 100).slice(0, 20); } catch { /* Storage is optional. */ }
for (const [value, text] of Object.entries(TOPICS)) {
  const label = document.createElement('label'); label.className = 'topic-option';
  const input = document.createElement('input'); input.type = 'radio'; input.name = 'topic'; input.value = value; input.checked = value === 'random';
  const span = document.createElement('span'); span.textContent = text;
  label.append(input, span); $('topics').append(label);
}
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function settings() { return { topic: document.querySelector('input[name="topic"]:checked').value, vocabulary: $('vocabulary').value, syntax: $('syntax').value }; }
function showError(message) { $('error').textContent = message; $('error').hidden = false; }
function setBusy(value, message = '') {
  busy = value;
  for (const node of document.querySelectorAll('#settings-form input, #settings-form select, #settings-form button, #answer-form button, #result button')) node.disabled = value;
  $('answer').readOnly = value;
  $('status').hidden = !value; $('status').textContent = message;
  $('practice').setAttribute('aria-busy', String(value));
  $('error').hidden = true;
}
async function api(path, data) {
  const response = await fetch(`./api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(55_000) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { config.authenticated = false; renderMode(); $('login-dialog').showModal(); }
    throw new Error(result.error || '通信に失敗しました。もう一度お試しください。');
  }
  return result;
}
function renderMode() {
  $('mode-label').textContent = config.aiEnabled ? 'AI学習モード' : 'サンプルモード';
  $('mode-description').textContent = config.aiEnabled ? '条件に合わせた出題と、和訳へのフィードバック。' : '固定の例文で操作を体験。レベル設定はAI接続後に反映されます。';
  if (connectionFailed) $('mode-description').textContent = 'サーバーに接続できません。固定サンプルを表示します（AI生成・採点なし）。';
  $('login-button').hidden = !config.aiEnabled || config.authenticated;
  $('grade-button').textContent = question?.demo ? 'サンプルの訳例・解説を見る →' : 'AIに採点してもらう →';
}
async function generate() {
  if (busy) return;
  if (config.aiEnabled && !config.authenticated) { $('login-dialog').showModal(); return; }
  const selected = settings();
  setBusy(true, config.aiEnabled ? 'あなたに合った英文を考えています…' : 'サンプルを準備しています…');
  try {
    const next = config.aiEnabled ? await api('question', selected) : demoQuestion(selected.topic);
    question = { ...next, settings: selected };
    $('empty-state').hidden = true; $('question-area').hidden = false; $('result').hidden = true;
    $('sentence').textContent = question.sentence; $('hint').textContent = question.hint; $('hint').hidden = true;
    $('hint-button').setAttribute('aria-expanded', 'false'); $('hint-button').textContent = 'ヒントを見る ＋';
    $('answer').value = ''; $('character-count').textContent = '0 / 2000';
    $('answer').required = !question.demo;
    $('question-meta').replaceChildren(...(question.demo ? [TOPICS[question.topic], '固定サンプル / レベル設定は未適用'] : [TOPICS[selected.topic], VOCAB[selected.vocabulary], `構文：${SYNTAX[selected.syntax]}`]).map(text => element('span', text, 'tag')));
    renderMode();
    if (matchMedia('(max-width: 650px)').matches) $('practice').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('answer').focus({ preventScroll: true });
  } catch (error) { showError(error.name === 'TimeoutError' ? '応答に時間がかかっています。もう一度お試しください。' : error.message); }
  finally { const message = $('error').hidden ? '' : $('error').textContent; setBusy(false); if (message) showError(message); }
}
$('settings-form').addEventListener('submit', event => { event.preventDefault(); generate(); });
$('answer').addEventListener('input', () => { $('character-count').textContent = `${$('answer').value.length} / 2000`; $('result').hidden = true; });
$('hint-button').addEventListener('click', () => { const show = $('hint').hidden; $('hint').hidden = !show; $('hint-button').setAttribute('aria-expanded', String(show)); $('hint-button').textContent = show ? 'ヒントを閉じる −' : 'ヒントを見る ＋'; });
function resultBlock(title, text) { $('result').append(element('h4', title), element('p', text)); }
function renderResult(result) {
  const area = $('result'); area.replaceChildren(); area.hidden = false;
  const header = element('div', undefined, 'result-header');
  if (!question.demo) { const score = element('div', String(result.score), 'score'); score.append(element('small', ' / 100')); header.append(score); }
  const summary = element('div'); summary.append(element('h3', question.demo ? 'サンプルの訳例と解説' : result.score >= 80 ? 'よくできました！' : result.score >= 50 ? 'あと一歩。ポイントを確認しよう。' : '一緒に復習してみよう。'), element('p', question.demo ? 'これは固定の解説です。入力した回答の採点は行っていません。' : result.feedback, 'feedback')); header.append(summary); area.append(header);
  resultBlock('日本語訳の一例', result.translation); resultBlock('構文のポイント', result.explanation);
  if (!question.demo) for (const [key, title] of [['strengths', 'よかったところ'], ['improvements', '次につながるポイント']]) if (result[key].length) { const list = element('ul'); result[key].forEach(text => list.append(element('li', text))); area.append(element('h4', title), list); }
  const next = element('button', '次の一文に挑戦する →', 'primary next-button'); next.type = 'button'; next.addEventListener('click', generate); area.append(next);
  area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('answer-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !question) return;
  const answer = $('answer').value.trim();
  if (!question.demo && !answer) { showError('日本語訳を入力してください。'); $('answer').focus(); return; }
  setBusy(true, question.demo ? '訳例と解説を準備しています…' : '意味と構文の理解を確認しています…');
  try {
    const result = question.demo ? question : await api('grade', { token: question.token, answer });
    renderResult(result);
    if (!question.demo) {
      const record = { sentence: question.sentence, answer, translation: result.translation, explanation: result.explanation, feedback: result.feedback, score: result.score, date: new Date().toISOString() };
      // Re-grading an answer updates this question's record rather than increasing the count.
      if (question.historyId) history = history.filter(item => item.date !== question.historyId);
      question.historyId = record.date; history.unshift(record); history = history.slice(0, 20);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { showError('採点は完了しましたが、ブラウザーに履歴を保存できませんでした。'); }
      renderHistory();
    }
  } catch (error) { showError(error.name === 'TimeoutError' ? '採点がタイムアウトしました。回答を残したまま再試行できます。' : error.message); }
  finally { const message = $('error').hidden ? '' : $('error').textContent; setBusy(false); if (message) showError(message); }
});
function renderHistory() {
  $('history-count').textContent = `${history.length}文`; $('clear-history').hidden = !history.length;
  if (!history.length) { $('history').replaceChildren(element('p', '採点した英文がここに残ります。学習記録はこのブラウザーに保存されます。', 'muted small')); return; }
  $('history').replaceChildren(...history.map(item => {
    const details = element('details', undefined, 'history-item'); const summary = element('summary', item.sentence); const date = new Date(item.date); summary.append(element('span', `${item.score}点 · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ja-JP')}`, 'history-info'));
    details.append(summary, element('p', `あなたの訳：${item.answer}`, 'history-answer'), element('p', `訳例：${item.translation}`), element('p', item.feedback), element('p', item.explanation)); return details;
  }));
}
$('clear-history').addEventListener('click', () => { if (!confirm('このブラウザーの学習履歴をすべて削除しますか？')) return; try { localStorage.removeItem(HISTORY_KEY); history = []; renderHistory(); } catch { showError('履歴を削除できませんでした。ブラウザーの設定をご確認ください。'); } });
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('close-help').addEventListener('click', () => $('help-dialog').close());
$('login-button').addEventListener('click', () => $('login-dialog').showModal());
$('close-login').addEventListener('click', () => $('login-dialog').close());
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('login-error').hidden = true; $('login-submit').disabled = true;
  try { await api('session', { password: $('password').value }); config.authenticated = true; $('password').value = ''; $('login-dialog').close(); renderMode(); }
  catch (error) { $('login-error').textContent = error.message; $('login-error').hidden = false; }
  finally { $('login-submit').disabled = false; }
});
renderHistory();
try { const response = await fetch('./api/config', { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(); config = await response.json(); }
catch { connectionFailed = true; }
renderMode();
$('generate-button').disabled = false;
