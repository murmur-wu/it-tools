import { describe, expect, it } from 'vitest';
import {
  type RandomPasswordOptions,
  ambiguousCharacters,
  characterSets,
  describeCrackTime,
  generatePassphrase,
  generatePin,
  generateRandomPassword,
  getCharacterGroups,
  getEntropyBits,
  getStrength,
  getStrengthLevel,
} from './password-generator.service';

const allTypes: RandomPasswordOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachType: true,
};

/** Deterministic generator: always returns the smallest index, so results are predictable. */
const alwaysFirst = () => 0;

describe('password generator service', () => {
  describe('generateRandomPassword', () => {
    it('produces the requested length from the selected sets only', () => {
      for (let i = 0; i < 50; i++) {
        const password = generateRandomPassword(allTypes);
        expect(password).toHaveLength(16);
        expect([...password].every(char => Object.values(characterSets).join('').includes(char))).toBe(true);
      }
    });

    it('contains at least one character of every selected type when required', () => {
      for (let i = 0; i < 100; i++) {
        const password = generateRandomPassword({ ...allTypes, length: 4 });
        expect(password).toMatch(/[A-Z]/);
        expect(password).toMatch(/[a-z]/);
        expect(password).toMatch(/\d/);
        expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?]/);
      }
    });

    it('falls back to plain random picks when the length is too short to hold every type', () => {
      const password = generateRandomPassword({ ...allTypes, length: 2 }, alwaysFirst);
      expect(password).toHaveLength(2);
    });

    it('honours a single character set', () => {
      const digitsOnly = { ...allTypes, uppercase: false, lowercase: false, symbols: false, length: 64 };
      expect(generateRandomPassword(digitsOnly)).toMatch(/^\d{64}$/);
    });

    it('drops ambiguous characters when asked', () => {
      const options = { ...allTypes, excludeAmbiguous: true, length: 400 };
      const password = generateRandomPassword(options);

      expect([...password].some(char => ambiguousCharacters.includes(char))).toBe(false);
      expect(getCharacterGroups(options).join('')).not.toMatch(/[0Oo1lI]/);
    });

    it('returns an empty string with no character set or zero length', () => {
      expect(generateRandomPassword({ ...allTypes, uppercase: false, lowercase: false, numbers: false, symbols: false })).toBe('');
      expect(generateRandomPassword({ ...allTypes, length: 0 })).toBe('');
    });

    it('is deterministic with an injected generator', () => {
      const a = generateRandomPassword({ ...allTypes, requireEachType: false, length: 6 }, alwaysFirst);
      const b = generateRandomPassword({ ...allTypes, requireEachType: false, length: 6 }, alwaysFirst);
      expect(a).toBe(b);
      expect(a).toBe('AAAAAA');
    });
  });

  describe('generatePassphrase', () => {
    it('joins the requested number of dictionary words with the separator', () => {
      const passphrase = generatePassphrase({ words: 4, separator: 'hyphen', capitalize: false, addNumber: false });
      const words = passphrase.split('-');

      expect(words).toHaveLength(4);
      expect(words.every(word => /^[a-z]+$/.test(word))).toBe(true);
    });

    it('capitalises words and appends a two-digit number when asked', () => {
      const passphrase = generatePassphrase({ words: 3, separator: 'space', capitalize: true, addNumber: true }, alwaysFirst);

      expect(passphrase).toBe('Abandon Abandon Abandon 00');
    });

    it('supports every separator', () => {
      expect(generatePassphrase({ words: 2, separator: 'underscore', capitalize: false, addNumber: false }, alwaysFirst)).toBe('abandon_abandon');
      expect(generatePassphrase({ words: 2, separator: 'dot', capitalize: false, addNumber: false }, alwaysFirst)).toBe('abandon.abandon');
      expect(generatePassphrase({ words: 2, separator: 'none', capitalize: false, addNumber: false }, alwaysFirst)).toBe('abandonabandon');
    });

    it('returns an empty string for zero words', () => {
      expect(generatePassphrase({ words: 0, separator: 'hyphen', capitalize: false, addNumber: true })).toBe('');
    });
  });

  describe('generatePin', () => {
    it('produces only digits of the requested length', () => {
      expect(generatePin({ length: 6 })).toMatch(/^\d{6}$/);
      expect(generatePin({ length: 0 })).toBe('');
    });
  });

  describe('strength', () => {
    it('computes entropy per mode', () => {
      // 26 + 26 + 10 + 23 symbols = 85 characters
      expect(getEntropyBits('random', allTypes)).toBeCloseTo(16 * Math.log2(85), 5);
      expect(getEntropyBits('random', { ...allTypes, uppercase: false, lowercase: false, numbers: false, symbols: false })).toBe(0);
      expect(getEntropyBits('passphrase', { words: 4, separator: 'hyphen', capitalize: true, addNumber: false })).toBeCloseTo(4 * 11, 5);
      expect(getEntropyBits('passphrase', { words: 4, separator: 'hyphen', capitalize: true, addNumber: true })).toBeCloseTo(44 + Math.log2(100), 5);
      expect(getEntropyBits('pin', { length: 4 })).toBeCloseTo(4 * Math.log2(10), 5);
    });

    it('maps entropy to five levels', () => {
      expect(getStrengthLevel(10)).toBe(0);
      expect(getStrengthLevel(30)).toBe(1);
      expect(getStrengthLevel(50)).toBe(2);
      expect(getStrengthLevel(70)).toBe(3);
      expect(getStrengthLevel(120)).toBe(4);
    });

    it('estimates the average time to crack', () => {
      const pin = getStrength('pin', { length: 4 });
      expect(pin.level).toBe(0);
      expect(pin.secondsToCrack).toBeLessThan(1);

      const strong = getStrength('random', allTypes);
      expect(strong.level).toBe(4);
      expect(strong.secondsToCrack).toBeGreaterThan(1e9);
    });
  });

  describe('describeCrackTime', () => {
    it('picks a readable unit', () => {
      expect(describeCrackTime(0.2)).toEqual({ kind: 'instant' });
      expect(describeCrackTime(45)).toEqual({ kind: 'duration', value: 45, unit: 'seconds' });
      expect(describeCrackTime(150)).toEqual({ kind: 'duration', value: 2.5, unit: 'minutes' });
      expect(describeCrackTime(3 * 86_400)).toEqual({ kind: 'duration', value: 3, unit: 'days' });
      expect(describeCrackTime(31_557_600 * 250)).toEqual({ kind: 'duration', value: 250, unit: 'years' });
      expect(describeCrackTime(31_557_600 * 1e13)).toEqual({ kind: 'ages' });
    });
  });
});
