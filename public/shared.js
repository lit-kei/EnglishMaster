export const TOPICS = {
  random: 'ランダム', infinitive: '不定詞', participle: '分詞構文',
  relative: '関係詞', gerund: '動名詞', conditional: '仮定法',
  comparison: '比較', passive: '受動態',
};
export const VOCAB = { basic: '中学レベル', standard: '高校基礎', advanced: '大学受験' };
export const SYNTAX = { basic: '基礎', standard: '標準', advanced: '発展' };
export function validSettings(value) {
  return value && Object.hasOwn(TOPICS, value.topic) && Object.hasOwn(VOCAB, value.vocabulary) && Object.hasOwn(SYNTAX, value.syntax);
}
