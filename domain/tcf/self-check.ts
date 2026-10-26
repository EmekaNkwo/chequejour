/**
 * Self-assessment criteria for speaking tasks (writing tasks carry their own
 * checklists in the content). Ticked criteria give the task's 0–1 score.
 */
import type { SpeakingTask } from '../content-types';

export const SPEAKING_CRITERIA: Readonly<Record<SpeakingTask['taskType'], readonly string[]>> = {
  entretien: [
    'I spoke for most of the time without long silences.',
    'I talked about my life, my work or studies, and my plans.',
    'I answered in full sentences, not single words.',
    'I used the past, the present and the future.',
    'I kept going when I hesitated or made a mistake.',
  ],
  interaction: [
    'I asked at least eight different questions.',
    'I used est-ce que, inversion and question words (où, quand, combien, pourquoi, quel).',
    'I reacted to the answers (D’accord, Ah bon ?, Très bien…).',
    'I covered every point in the situation.',
    'I stayed polite (je voudrais, pourriez-vous…).',
  ],
  opinion: [
    'I gave my opinion clearly at the start.',
    'I gave at least two arguments, each with an example.',
    'I mentioned the other point of view.',
    'I used connectors (d’abord, cependant, donc…).',
    'I ended with a clear conclusion.',
  ],
};
