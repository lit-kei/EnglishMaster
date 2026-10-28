// Fixed examples for the UI preview. These are NOT AI-generated or AI-graded.
export const examples = {
  infinitive: { sentence: 'She went to the library to find a book about the stars.', translation: '彼女は星についての本を探すために図書館へ行きました。', explanation: '主語はShe、述語はwent。to findは「〜するために」という目的を表す不定詞の副詞的用法です。about the starsはa bookを修飾しています。', hint: 'to findは「何のために図書館へ行ったのか」を説明しています。' },
  participle: { sentence: 'Walking along the river, I found a small cafe.', translation: '川沿いを歩いていると、私は小さなカフェを見つけました。', explanation: 'Walking along the riverは分詞構文で、ここでは「歩いているとき」という時を表します。Walkingの意味上の主語は、主節の主語と同じIです。主節の述語はfoundです。', hint: 'Walkingの動作をしているのは誰でしょう。主節の主語に注目しましょう。' },
  relative: { sentence: 'The book that you lent me opened the door to a new world.', translation: 'あなたが私に貸してくれた本は、新しい世界への扉を開きました。', explanation: '主語はThe book、述語はopened。that you lent meは関係代名詞thatが導く節でThe bookを修飾します。thatはlentの目的語に当たります。', hint: '主語The bookを説明する部分はどこまででしょう。文全体の述語を探しましょう。' },
  gerund: { sentence: 'Reading books in the morning helps me start the day with a clear mind.', translation: '朝に本を読むことは、すっきりした気持ちで一日を始める助けになります。', explanation: 'Reading books in the morningという動名詞句が文の主語です。helpsが述語で、help + 人 + 動詞の原形は「人が〜するのを助ける」を表します。', hint: '文の主語はReadingから始まるまとまりです。何を「すること」でしょう。' },
  conditional: { sentence: 'If I had more time, I would learn to play the piano.', translation: 'もしもっと時間があれば、ピアノの弾き方を学ぶのに。', explanation: 'If + 主語 + 過去形、主語 + would + 動詞の原形という仮定法過去です。現在の事実と異なる仮定や実現が難しい願望を表しています。hadはここでは過去の出来事を表していません。', hint: 'hadは過去の出来事でしょうか。wouldと組み合わさる意味を考えましょう。' },
  comparison: { sentence: 'This town is much quieter than the city where I grew up.', translation: 'この町は、私が育った都市よりもずっと静かです。', explanation: 'quieter thanで「〜より静か」という比較を表し、muchは比較級を強めます。where I grew upは関係副詞whereが導く節でthe cityを修飾します。', hint: 'muchが強めているのはどの語でしょう。比較されている2つの場所を探しましょう。' },
  passive: { sentence: 'The old bridge was built by people who lived in this village.', translation: 'その古い橋は、この村に住んでいた人々によって建てられました。', explanation: 'was builtはbe動詞 + 過去分詞の受動態で「建てられた」を表します。by peopleは動作主。who lived in this villageはpeopleを修飾する関係代名詞節です。', hint: '橋は建てる側でしょうか、建てられる側でしょうか。was builtに注目しましょう。' },
};
let previous;
export function demoQuestion(topic) {
  const keys = Object.keys(examples);
  if (topic === 'random') {
    const available = keys.filter(key => key !== previous);
    topic = available[Math.floor(Math.random() * available.length)];
  }
  previous = topic;
  return { ...examples[topic], demo: true, topic };
}
