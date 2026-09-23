import { englishWordList } from '@it-tools/bip39';
import { type RandomInt, pickRandom, secureRandomInt, shuffleSecure } from '@/utils/secureRandom';

export const passwordModes = ['random', 'passphrase', 'pin'] as const;
export type PasswordMode = typeof passwordModes[number];

export const characterSets = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
} as const;

/** Characters that are easy to confuse when read aloud or written by hand. */
export const ambiguousCharacters = '0Oo1lI';

export const passphraseSeparators = { hyphen: '-', underscore: '_', space: ' ', dot: '.', none: '' } as const;
export type PassphraseSeparator = keyof typeof passphraseSeparators;

const wordList: readonly string[] = englishWordList.words;

export interface RandomPasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  requireEachType: boolean
}

export interface PassphraseOptions {
  words: number
  separator: PassphraseSeparator
  capitalize: boolean
  addNumber: boolean
}

export interface PinOptions {
  length: number
}

function stripAmbiguous(set: string, excludeAmbiguous: boolean): string {
  return excludeAmbiguous ? [...set].filter(char => !ambiguousCharacters.includes(char)).join('') : set;
}

/** The enabled character groups, each already filtered for ambiguous characters. */
export function getCharacterGroups(options: RandomPasswordOptions): string[] {
  return (Object.keys(characterSets) as (keyof typeof characterSets)[])
    .filter(key => options[key])
    .map(key => stripAmbiguous(characterSets[key], options.excludeAmbiguous))
    .filter(group => group.length > 0);
}

export function generateRandomPassword(options: RandomPasswordOptions, randomInt: RandomInt = secureRandomInt): string {
  const groups = getCharacterGroups(options);
  const length = Math.max(0, Math.trunc(options.length));

  if (groups.length === 0 || length === 0) {
    return '';
  }

  const alphabet = groups.join('');
  const chars: string[] = [];

  // Reserve one slot per group so the result provably contains every selected type.
  if (options.requireEachType && length >= groups.length) {
    groups.forEach(group => chars.push(pickRandom([...group], randomInt)));
  }

  while (chars.length < length) {
    chars.push(pickRandom([...alphabet], randomInt));
  }

  return shuffleSecure(chars, randomInt).join('');
}

export function generatePassphrase(options: PassphraseOptions, randomInt: RandomInt = secureRandomInt): string {
  const count = Math.max(0, Math.trunc(options.words));

  if (count === 0) {
    return '';
  }

  const words = Array.from({ length: count }, () => pickRandom(wordList, randomInt))
    .map(word => (options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word));

  if (options.addNumber) {
    words.push(String(randomInt(100)).padStart(2, '0'));
  }

  return words.join(passphraseSeparators[options.separator]);
}

export function generatePin(options: PinOptions, randomInt: RandomInt = secureRandomInt): string {
  const length = Math.max(0, Math.trunc(options.length));

  return Array.from({ length }, () => String(randomInt(10))).join('');
}

// --- Strength ---

/** Offline attack against a fast hash; a deliberately pessimistic assumption. */
export const GUESSES_PER_SECOND = 1e10;

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  entropyBits: number
  level: StrengthLevel
  secondsToCrack: number
}

export function getEntropyBits(mode: PasswordMode, options: RandomPasswordOptions | PassphraseOptions | PinOptions): number {
  switch (mode) {
    case 'random': {
      const random = options as RandomPasswordOptions;
      const alphabet = getCharacterGroups(random).join('');

      return alphabet.length === 0 ? 0 : Math.max(0, Math.trunc(random.length)) * Math.log2(alphabet.length);
    }
    case 'passphrase': {
      const passphrase = options as PassphraseOptions;
      // Capitalisation is deterministic and adds nothing; the appended number adds log2(100).
      return Math.max(0, Math.trunc(passphrase.words)) * Math.log2(wordList.length) + (passphrase.addNumber ? Math.log2(100) : 0);
    }
    case 'pin':
      return Math.max(0, Math.trunc((options as PinOptions).length)) * Math.log2(10);
  }
}

export function getStrengthLevel(entropyBits: number): StrengthLevel {
  if (entropyBits < 28) {
    return 0;
  }
  if (entropyBits < 40) {
    return 1;
  }
  if (entropyBits < 60) {
    return 2;
  }
  if (entropyBits < 80) {
    return 3;
  }

  return 4;
}

export function getStrength(mode: PasswordMode, options: RandomPasswordOptions | PassphraseOptions | PinOptions): Strength {
  const entropyBits = getEntropyBits(mode, options);
  // On average an attacker finds the password halfway through the key space.
  const secondsToCrack = entropyBits === 0 ? 0 : 2 ** (entropyBits - 1) / GUESSES_PER_SECOND;

  return { entropyBits, level: getStrengthLevel(entropyBits), secondsToCrack };
}

export type CrackTime =
  | { kind: 'instant' }
  | { kind: 'ages' }
  | { kind: 'duration'; value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'years' };

const SECONDS_PER_YEAR = 31_557_600;

export function describeCrackTime(seconds: number): CrackTime {
  if (seconds < 1) {
    return { kind: 'instant' };
  }

  const units = [
    { unit: 'years', size: SECONDS_PER_YEAR },
    { unit: 'days', size: 86_400 },
    { unit: 'hours', size: 3_600 },
    { unit: 'minutes', size: 60 },
    { unit: 'seconds', size: 1 },
  ] as const;

  if (seconds / SECONDS_PER_YEAR >= 1e12) {
    return { kind: 'ages' };
  }

  for (const { unit, size } of units) {
    if (seconds >= size) {
      const value = seconds / size;

      return { kind: 'duration', value: value >= 10 ? Math.round(value) : Math.round(value * 10) / 10, unit };
    }
  }

  return { kind: 'instant' };
}
