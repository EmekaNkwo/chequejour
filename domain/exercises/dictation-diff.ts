/**
 * Word-by-word comparison of a dictation answer with the original sentence, so the
 * result can highlight exactly which words were missed, misspelt or only lack accents.
 */
import { normalize, stripAccents } from '../answers';

export type WordStatus = 'ok' | 'accent' | 'wrong' | 'missing' | 'extra';

export interface DiffToken {
  /** The original word, or the learner's word for an extra one. */
  word: string;
  status: WordStatus;
  /** What the learner typed in place of this word, when it differs. */
  typed?: string;
}

const split = (text: string): string[] => text.split(/\s+/).filter(Boolean);
const display = (text: string): string[] => split(text.replace(/[«»"“”.,;:!?…()]/g, ' ').replace(/[’‘]/g, "'"));

/** Cost of putting typed word b where a was expected: 0 same, 0.5 accents only, 1 different. */
function cost(a: string, b: string): number {
  if (a === b) return 0;
  return stripAccents(a) === stripAccents(b) ? 0.5 : 1;
}

/** Edit-distance alignment over words; each step is a match, a substitution, a missing or an extra word. */
export function diffWords(expected: string, typed: string): DiffToken[] {
  const shown = display(expected);
  const want = shown.map(normalize);
  const typedShown = display(typed);
  const got = typedShown.map(normalize);
  const n = want.length;
  const m = got.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      d[i][j] = Math.min(d[i - 1][j - 1] + cost(want[i - 1], got[j - 1]), d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const out: DiffToken[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + cost(want[i - 1], got[j - 1])) {
      const c = cost(want[i - 1], got[j - 1]);
      out.push(c === 0 ? { word: shown[i - 1], status: 'ok' } : { word: shown[i - 1], status: c < 1 ? 'accent' : 'wrong', typed: typedShown[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      out.push({ word: shown[i - 1], status: 'missing' });
      i -= 1;
    } else {
      out.push({ word: typedShown[j - 1], status: 'extra' });
      j -= 1;
    }
  }
  return out.reverse();
}
