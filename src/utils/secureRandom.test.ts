import { describe, expect, it } from 'vitest';
import { pickRandom, secureRandomInt, shuffleSecure } from './secureRandom';

describe('secureRandom', () => {
  describe('secureRandomInt', () => {
    it('stays inside [0, max) over many draws', () => {
      for (const max of [1, 2, 7, 10, 62, 2048]) {
        for (let i = 0; i < 500; i++) {
          const value = secureRandomInt(max);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(max);
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    });

    it('hits every value of a small range', () => {
      const seen = new Set<number>();
      for (let i = 0; i < 2000; i++) {
        seen.add(secureRandomInt(6));
      }
      expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('rejects invalid bounds', () => {
      expect(() => secureRandomInt(0)).toThrow(RangeError);
      expect(() => secureRandomInt(-3)).toThrow(RangeError);
      expect(() => secureRandomInt(2.5)).toThrow(RangeError);
    });
  });

  describe('pickRandom and shuffleSecure', () => {
    it('picks with the injected generator', () => {
      expect(pickRandom(['a', 'b', 'c'], () => 2)).toBe('c');
      expect(() => pickRandom([])).toThrow(RangeError);
    });

    it('shuffles into a permutation without mutating the input', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const output = shuffleSecure(input);

      expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect([...output].sort((a, b) => a - b)).toEqual(input);
    });
  });
});
