import { type MaybeRef, computed, unref } from 'vue';

export { obfuscateString, useObfuscateString };

function obfuscateString(
  str: string,
  { replacementChar = '*', keepFirst = 4, keepLast = 0, keepSpace = true }: { replacementChar?: string; keepFirst?: number; keepLast?: number; keepSpace?: boolean } = {}): string {
  return str
    .split('')
    .map((char, index, array) => {
      if (keepSpace && char === ' ') {
        return char;
      }

      return (index < keepFirst || index >= array.length - keepLast) ? char : replacementChar;
    })
    .join('');
}

function useObfuscateString(
  str: MaybeRef<string>,
  config: { replacementChar?: MaybeRef<string>; keepFirst?: MaybeRef<number>; keepLast?: MaybeRef<number>; keepSpace?: MaybeRef<boolean> } = {},

) {
  return computed(() => obfuscateString(
    unref(str),
    {
      replacementChar: unref(config.replacementChar),
      keepFirst: unref(config.keepFirst),
      keepLast: unref(config.keepLast),
      keepSpace: unref(config.keepSpace),
    },
  ));
}
