/**
 * How a "___" gap is drawn in a French sentence. The gap is full-width low lines, which
 * Android may wrap between (as in CJK text), and "mettez-___" may wrap after the
 * hyphen; word joiners (U+2060) keep the gap whole and attached to what precedes it.
 */
const GAP = /_{3,}/g;
const WORD_JOINER = '⁠';
const GAP_LINE = ['＿', '＿', '＿'].join(WORD_JOINER);

export function gapDisplayText(sentence: string): string {
  return sentence.replace(/-(?=_{3,})/g, `-${WORD_JOINER}`).replace(GAP, GAP_LINE);
}

export function gapSpokenText(sentence: string): string {
  return sentence.replace(GAP, 'blank');
}
