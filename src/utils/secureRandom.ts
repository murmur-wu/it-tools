/**
 * Cryptographically secure random helpers built on `crypto.getRandomValues`.
 * `Math.random` is fine for lorem ipsum, not for anything used as a secret.
 */

export type RandomInt = (maxExclusive: number) => number;

/** Uniform integer in [0, maxExclusive), using rejection sampling to avoid modulo bias. */
export const secureRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be a positive integer');
  }

  if (maxExclusive === 1) {
    return 0;
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);

  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % maxExclusive;
};

export function pickRandom<T>(items: readonly T[], randomInt: RandomInt = secureRandomInt): T {
  if (items.length === 0) {
    throw new RangeError('Cannot pick from an empty list');
  }

  return items[randomInt(items.length)];
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffleSecure<T>(items: readonly T[], randomInt: RandomInt = secureRandomInt): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
