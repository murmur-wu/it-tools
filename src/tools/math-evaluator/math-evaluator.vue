<script setup lang="ts">
import { evaluate } from 'mathjs';

import { withDefaultOnError } from '@/utils/defaults';
import { useToolInput } from '@/composable/toolInput';

const expression = ref('');
useToolInput(expression, { example: 'sqrt(16) + 2 * (3 + 4)' });

const result = computed(() => withDefaultOnError(() => evaluate(expression.value) ?? '', ''));
</script>

<template>
  <div>
    <c-input-text
      v-model:value="expression"
      rows="1"
      multiline
      placeholder="Your math expression (ex: 2*sqrt(6) )..."
      raw-text
      monospace
      autofocus
      autosize
    />

    <c-card v-if="result !== ''" title="Result " mt-5>
      {{ result }}
    </c-card>
  </div>
</template>
