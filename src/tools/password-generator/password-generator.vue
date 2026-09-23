<script setup lang="ts">
import {
  type PassphraseOptions,
  type PassphraseSeparator,
  type PasswordMode,
  type RandomPasswordOptions,
  describeCrackTime,
  generatePassphrase,
  generatePin,
  generateRandomPassword,
  getStrength,
  passphraseSeparators,
  passwordModes,
} from './password-generator.service';
import InputCopyable from '@/components/InputCopyable.vue';
import { computedRefreshable } from '@/composable/computedRefreshable';
import { useQueryParam } from '@/composable/queryParams';
import { useToolOutput, useToolRun } from '@/composable/toolInput';

const { t } = useI18n();

const mode = useQueryParam<PasswordMode>({ name: 'mode', defaultValue: 'random' });
const count = useQueryParam({ name: 'count', defaultValue: 1 });

// Random password
const length = useQueryParam({ name: 'length', defaultValue: 16 });
const uppercase = useQueryParam({ name: 'uppercase', defaultValue: true });
const lowercase = useQueryParam({ name: 'lowercase', defaultValue: true });
const numbers = useQueryParam({ name: 'numbers', defaultValue: true });
const symbols = useQueryParam({ name: 'symbols', defaultValue: true });
const excludeAmbiguous = useQueryParam({ name: 'ambiguous', defaultValue: false });
const requireEachType = useQueryParam({ name: 'each', defaultValue: true });

// Passphrase
const words = useQueryParam({ name: 'words', defaultValue: 4 });
const separator = useQueryParam<PassphraseSeparator>({ name: 'separator', defaultValue: 'hyphen' });
const capitalize = useQueryParam({ name: 'capitalize', defaultValue: true });
const addNumber = useQueryParam({ name: 'number', defaultValue: false });

// PIN
const pinLength = useQueryParam({ name: 'pin', defaultValue: 6 });

const randomOptions = computed<RandomPasswordOptions>(() => ({
  length: length.value,
  uppercase: uppercase.value,
  lowercase: lowercase.value,
  numbers: numbers.value,
  symbols: symbols.value,
  excludeAmbiguous: excludeAmbiguous.value,
  requireEachType: requireEachType.value,
}));

const passphraseOptions = computed<PassphraseOptions>(() => ({
  words: words.value,
  separator: separator.value,
  capitalize: capitalize.value,
  addNumber: addNumber.value,
}));

function generateOne(): string {
  switch (mode.value) {
    case 'passphrase':
      return generatePassphrase(passphraseOptions.value);
    case 'pin':
      return generatePin({ length: pinLength.value });
    default:
      return generateRandomPassword(randomOptions.value);
  }
}

const [passwords, regenerate] = computedRefreshable(() =>
  Array.from({ length: Math.min(20, Math.max(1, count.value)) }, () => generateOne()),
);

useToolOutput(() => passwords.value[0] ?? '');
useToolRun(regenerate);

const strength = computed(() => {
  switch (mode.value) {
    case 'passphrase':
      return getStrength('passphrase', passphraseOptions.value);
    case 'pin':
      return getStrength('pin', { length: pinLength.value });
    default:
      return getStrength('random', randomOptions.value);
  }
});

const strengthPercent = computed(() => Math.min(100, Math.round((strength.value.entropyBits / 100) * 100)));
const strengthColor = computed(() => ['#d03050', '#f0a020', '#f0a020', '#18a058', '#18a058'][strength.value.level]);

const crackTimeText = computed(() => {
  const time = describeCrackTime(strength.value.secondsToCrack);

  if (time.kind === 'duration') {
    return t(`tools.password-generator.crack.${time.unit}`, { n: time.value.toLocaleString() });
  }

  return t(`tools.password-generator.crack.${time.kind}`);
});

const hasNoCharacterSet = computed(() => mode.value === 'random' && !uppercase.value && !lowercase.value && !numbers.value && !symbols.value);
</script>

<template>
  <div>
    <c-card>
      <n-radio-group v-model:value="mode" mb-4 data-test-id="password-mode">
        <n-radio-button v-for="value in passwordModes" :key="value" :value="value">
          {{ t(`tools.password-generator.modes.${value}`) }}
        </n-radio-button>
      </n-radio-group>

      <template v-if="mode === 'random'">
        <n-form-item :label="`${t('tools.password-generator.length')} (${length})`" label-placement="left" label-width="120" :show-feedback="false" mb-3>
          <n-slider v-model:value="length" :min="4" :max="128" :step="1" data-test-id="password-length" />
        </n-form-item>

        <n-space vertical mb-3>
          <n-checkbox v-model:checked="uppercase" :label="t('tools.password-generator.uppercase')" />
          <n-checkbox v-model:checked="lowercase" :label="t('tools.password-generator.lowercase')" />
          <n-checkbox v-model:checked="numbers" :label="t('tools.password-generator.numbers')" />
          <n-checkbox v-model:checked="symbols" :label="t('tools.password-generator.symbols')" />
          <n-checkbox v-model:checked="excludeAmbiguous" :label="t('tools.password-generator.excludeAmbiguous')" />
          <n-checkbox v-model:checked="requireEachType" :label="t('tools.password-generator.requireEach')" />
        </n-space>

        <n-alert v-if="hasNoCharacterSet" type="warning" mb-3>
          {{ t('tools.password-generator.noCharacterSet') }}
        </n-alert>
      </template>

      <template v-else-if="mode === 'passphrase'">
        <n-form-item :label="`${t('tools.password-generator.words')} (${words})`" label-placement="left" label-width="120" :show-feedback="false" mb-3>
          <n-slider v-model:value="words" :min="3" :max="12" :step="1" data-test-id="passphrase-words" />
        </n-form-item>

        <c-select
          v-model:value="separator"
          :label="t('tools.password-generator.separator')"
          label-position="left"
          label-width="120px"
          mb-3
          :options="Object.keys(passphraseSeparators).map((key) => ({ label: t(`tools.password-generator.separators.${key}`), value: key }))"
        />

        <n-space vertical mb-3>
          <n-checkbox v-model:checked="capitalize" :label="t('tools.password-generator.capitalize')" />
          <n-checkbox v-model:checked="addNumber" :label="t('tools.password-generator.addNumber')" />
        </n-space>
      </template>

      <template v-else>
        <n-form-item :label="`${t('tools.password-generator.length')} (${pinLength})`" label-placement="left" label-width="120" :show-feedback="false" mb-3>
          <n-slider v-model:value="pinLength" :min="4" :max="16" :step="1" data-test-id="pin-length" />
        </n-form-item>
      </template>

      <n-form-item :label="t('tools.password-generator.count')" label-placement="left" label-width="120" :show-feedback="false">
        <n-input-number v-model:value="count" :min="1" :max="20" w-full />
      </n-form-item>
    </c-card>

    <c-card mt-5>
      <div v-for="(password, index) in passwords" :key="index" mb-2>
        <InputCopyable :value="password" readonly font-mono data-test-id="generated-password" />
      </div>

      <div mt-4 flex justify-center>
        <c-button data-test-id="password-regenerate" @click="regenerate">
          {{ t('tools.password-generator.regenerate') }}
        </c-button>
      </div>
    </c-card>

    <c-card mt-5 data-test-id="password-strength">
      <div mb-2 flex items-center justify-between>
        <span font-bold>{{ t('tools.password-generator.strength') }}</span>
        <span :style="{ color: strengthColor }" font-bold data-test-id="password-strength-level">
          {{ t(`tools.password-generator.levels.${strength.level}`) }}
        </span>
      </div>
      <n-progress type="line" :percentage="strengthPercent" :color="strengthColor" :show-indicator="false" mb-3 />

      <div flex flex-col gap-1 text-sm op-80>
        <div>{{ t('tools.password-generator.entropy', { bits: Math.round(strength.entropyBits) }) }}</div>
        <div>{{ t('tools.password-generator.crackTime') }}<strong ml-1 data-test-id="password-crack-time">{{ crackTimeText }}</strong></div>
      </div>

      <div mt-3 text-xs op-60>
        {{ t('tools.password-generator.privacy') }}
      </div>
    </c-card>
  </div>
</template>
