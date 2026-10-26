import { z } from 'zod';
import { AiError } from '../ai/errors';
import { checkText, frenchShare, parseModelJson, quotedIn, stripReasoning } from '../ai/guards';

const rejected = (fn: () => unknown) => {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof AiError && e.failure === 'rejected';
  }
  return false;
};

describe('stripping reasoning the model may still emit', () => {
  it('removes think blocks, closed or left open', () => {
    expect(stripReasoning('<think>hmm</think>\nBonjour')).toBe('Bonjour');
    expect(stripReasoning('<think>\n\n</think>\n\n{"a":1}')).toBe('{"a":1}');
    expect(stripReasoning('<think>never closed')).toBe('');
  });
});

describe('reading JSON from the model', () => {
  const schema = z.object({ answer: z.string().min(1) });

  it('accepts plain JSON, fenced JSON and JSON after a think block', () => {
    expect(parseModelJson('{"answer":"oui"}', schema)).toEqual({ answer: 'oui' });
    expect(parseModelJson('```json\n{"answer":"oui"}\n```', schema)).toEqual({ answer: 'oui' });
    expect(parseModelJson('<think>x</think> Voilà : {"answer":"oui"} merci', schema)).toEqual({ answer: 'oui' });
  });

  it('rejects text that is not JSON or does not fit the shape', () => {
    expect(rejected(() => parseModelJson('Sure! The answer is yes.', schema))).toBe(true);
    expect(rejected(() => parseModelJson('{"answer": ""}', schema))).toBe(true);
    expect(rejected(() => parseModelJson('{"answer": "oui"', schema))).toBe(true);
  });
});

describe('how French a text is', () => {
  it('is high for French and low for English', () => {
    expect(frenchShare('Je pense que les transports en commun sont une bonne solution pour la ville.')).toBeGreaterThan(0.6);
    expect(frenchShare('I think public transport is a good solution for the city.')).toBeLessThan(0.2);
  });

  it('is zero for empty text', () => {
    expect(frenchShare('')).toBe(0);
  });
});

describe('checking a model text before it is shown', () => {
  it('passes a normal French text', () => {
    expect(checkText('Tu as raison, c’est une bonne idée.', { language: 'fr', maxChars: 200 })).toBe('Tu as raison, c’est une bonne idée.');
  });

  it('passes a normal English explanation', () => {
    expect(checkText('Use "à" before a city name: "Je vais à Paris".', { language: 'en', maxChars: 200 })).toBe('Use "à" before a city name: "Je vais à Paris".');
  });

  it('rejects text in the wrong language', () => {
    expect(rejected(() => checkText('I think it is a good idea and I like it a lot.', { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Je pense que c’est une très bonne idée pour la ville et pour nous.', { language: 'en', maxChars: 200 }))).toBe(true);
  });

  it('rejects empty, overlong, and link- or contact-bearing text', () => {
    expect(rejected(() => checkText('   ', { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Oui. '.repeat(100), { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Va sur https://exemple.fr pour la suite.', { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Écris-moi à ami@exemple.fr pour la suite.', { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Appelle le 06 12 34 56 78 demain matin.', { language: 'fr', maxChars: 200 }))).toBe(true);
  });

  it('rejects unsafe words in either language', () => {
    expect(rejected(() => checkText('Tu es vraiment un connard, tu sais.', { language: 'fr', maxChars: 200 }))).toBe(true);
    expect(rejected(() => checkText('Do not be such an idiot with your grammar.', { language: 'en', maxChars: 200 }))).toBe(true);
  });

  it('rejects leftover template tokens', () => {
    expect(rejected(() => checkText('Bonjour <|im_end|> ça va ?', { language: 'fr', maxChars: 200 }))).toBe(true);
  });

  it('can skip the language check for short mixed snippets', () => {
    expect(checkText('je vais à Paris', { language: 'any', maxChars: 50 })).toBe('je vais à Paris');
  });
});

describe('a quote the model says comes from the learner', () => {
  it('must really be in the learner text, ignoring case, spaces and apostrophe style', () => {
    const text = "Hier, je suis allé au  marché et j'ai acheté des pommes.";
    expect(quotedIn(text, 'je suis allé au marché')).toBe(true);
    expect(quotedIn(text, 'J’ai acheté')).toBe(true);
    expect(quotedIn(text, 'je suis allée')).toBe(false);
    expect(quotedIn(text, '')).toBe(false);
  });
});

describe('unsafe-word edges', () => {
  it('matches words ending in accented letters and leaves longer words alone', () => {
    expect(rejected(() => checkText('Quel pédé, vraiment.', { language: 'any', maxChars: 200 }))).toBe(true);
    expect(checkText('Il faut tuer le temps en attendant le bus.', { language: 'fr', maxChars: 200 })).toBe('Il faut tuer le temps en attendant le bus.');
    expect(checkText('Désolé, je suis en retard ce matin.', { language: 'fr', maxChars: 200 })).toBe('Désolé, je suis en retard ce matin.');
    expect(checkText('Les shitakés sont des champignons.', { language: 'fr', maxChars: 200 })).toBe('Les shitakés sont des champignons.');
  });
});

describe('review fixes: fewer false rejections', () => {
  it('lets hyphenated words through', () => {
    expect(checkText('On fait un pique-nique au parc dimanche.', { language: 'fr', maxChars: 200 })).toBe('On fait un pique-nique au parc dimanche.');
  });

  it('reads English with contractions as English', () => {
    expect(checkText("It isn't wrong to say it's the student's choice, but use \"à\" here.", { language: 'en', maxChars: 200 })).toBeTruthy();
  });

  it('allows dates and big numbers but not phone numbers', () => {
    expect(checkText('Le rendez-vous est le 2026-10-26 à 14 h.', { language: 'fr', maxChars: 200 })).toBeTruthy();
    expect(rejected(() => checkText('Appelez le 514 555 0199 pour réserver.', { language: 'fr', maxChars: 200 }))).toBe(true);
  });

  it('matches quotes as whole words only', () => {
    expect(quotedIn('Je vais avec elle.', 'a')).toBe(false);
    expect(quotedIn('Il a faim.', 'a')).toBe(true);
    expect(quotedIn('Il est là.', 'est')).toBe(true);
    expect(quotedIn('Le restaurant.', 'est')).toBe(false);
  });
});
