<script setup lang="ts">
import type { lib } from 'crypto-js';
import { MD5, RIPEMD160, SHA1, SHA224, SHA256, SHA3, SHA384, SHA512, enc } from 'crypto-js';

import InputCopyable from '../../components/InputCopyable.vue';
import { convertHexToBin } from './hash-text.service';
import {
  type DigestEncoding,
  type FileHashAlgorithm,
  bytesToHex,
  fileHashAlgorithms,
  formatDigest,
  hashFile,
  normalizeHashForComparison,
} from './hash-file.service';
import { useQueryParam } from '@/composable/queryParams';
import { useToolInput } from '@/composable/toolInput';
import { formatBytes } from '@/utils/convert';

const algos = {
  MD5,
  SHA1,
  SHA256,
  SHA224,
  SHA512,
  SHA384,
  SHA3,
  RIPEMD160,
} as const;

type AlgoNames = keyof typeof algos;
type Encoding = keyof typeof enc | 'Bin';
const algoNames = Object.keys(algos) as AlgoNames[];
const encoding = useQueryParam<Encoding>({ defaultValue: 'Hex', name: 'encoding' });
const clearText = ref('');
useToolInput(clearText, { example: 'Hello world' });
const { t } = useI18n();

function formatWithEncoding(words: lib.WordArray, encoding: Encoding) {
  if (encoding === 'Bin') {
    return convertHexToBin(words.toString(enc.Hex));
  }

  return words.toString(enc[encoding]);
}

const hashText = (algo: AlgoNames, value: string) => formatWithEncoding(algos[algo](value), encoding.value);

// --- File hashing (streamed, never leaves the browser) ---

interface HashedFile {
  id: number
  name: string
  size: number
  progress: number
  error: boolean
  digests: Partial<Record<FileHashAlgorithm, Uint8Array>>
}

const selectedAlgorithms = ref<FileHashAlgorithm[]>(['MD5', 'SHA1', 'SHA256', 'SHA512']);
const hashedFiles = ref<HashedFile[]>([]);
const expectedHash = ref('');
let nextFileId = 0;

async function onFilesUpload(files: File[]) {
  const algorithms = [...selectedAlgorithms.value];

  for (const file of files) {
    const entry: HashedFile = reactive({ id: nextFileId++, name: file.name, size: file.size, progress: 0, error: false, digests: {} });
    hashedFiles.value.unshift(entry);

    try {
      entry.digests = await hashFile({
        file,
        algorithms,
        onProgress: ratio => entry.progress = Math.round(ratio * 100),
      });
    }
    catch {
      entry.error = true;
    }
  }
}

function clearFiles() {
  hashedFiles.value = [];
}

function digestFor(file: HashedFile, algorithm: FileHashAlgorithm) {
  const bytes = file.digests[algorithm];

  return bytes ? formatDigest(bytes, encoding.value as DigestEncoding) : '';
}

function matchedAlgorithm(file: HashedFile): FileHashAlgorithm | undefined {
  const expected = normalizeHashForComparison(expectedHash.value);
  if (!expected) {
    return undefined;
  }

  return (Object.keys(file.digests) as FileHashAlgorithm[]).find((algorithm) => {
    const bytes = file.digests[algorithm]!;

    return normalizeHashForComparison(bytesToHex(bytes)) === expected
      || normalizeHashForComparison(formatDigest(bytes, encoding.value as DigestEncoding)) === expected;
  });
}

const isHashing = computed(() => hashedFiles.value.some(file => file.progress < 100 && !file.error));
</script>

<template>
  <div>
    <c-card>
      <c-input-text v-model:value="clearText" placeholder="Your string to hash..." rows="3" autofocus raw-text autosize multiline label="Your text to hash:" />

      <n-divider />

      <c-select
        v-model:value="encoding"
        mb-4
        label="Digest encoding"
        :options="[
          {
            label: 'Binary (base 2)',
            value: 'Bin',
          },
          {
            label: 'Hexadecimal (base 16)',
            value: 'Hex',
          },
          {
            label: 'Base64 (base 64)',
            value: 'Base64',
          },
          {
            label: 'Base64url (base 64 with url safe chars)',
            value: 'Base64url',
          },
        ]"
      />

      <div v-for="algo in algoNames" :key="algo" style="margin: 5px 0">
        <n-input-group>
          <n-input-group-label style="flex: 0 0 120px">
            {{ algo }}
          </n-input-group-label>
          <InputCopyable :value="hashText(algo, clearText)" readonly />
        </n-input-group>
      </div>
    </c-card>

    <c-card :title="t('tools.hash-text.file.title')" mt-5>
      <div mb-2 text-sm op-70>
        {{ t('tools.hash-text.file.algorithms') }}
      </div>
      <n-checkbox-group v-model:value="selectedAlgorithms" mb-4 :disabled="isHashing">
        <n-space>
          <n-checkbox v-for="algorithm in fileHashAlgorithms" :key="algorithm" :value="algorithm" :label="algorithm" />
        </n-space>
      </n-checkbox-group>

      <c-file-upload multiple :title="t('tools.hash-text.file.upload')" data-test-id="hash-file-upload" @files-upload="onFilesUpload" />

      <div mt-2 text-xs op-60>
        {{ t('tools.hash-text.file.privacy') }}
      </div>

      <template v-if="hashedFiles.length > 0">
        <n-divider />

        <c-input-text
          v-model:value="expectedHash"
          :label="t('tools.hash-text.file.compare')"
          :placeholder="t('tools.hash-text.file.comparePlaceholder')"
          clearable
          raw-text
          mb-4
          data-test-id="hash-file-compare"
        />

        <div v-for="file in hashedFiles" :key="file.id" mb-4 data-test-id="hashed-file">
          <div mb-2 flex flex-wrap items-center gap-2>
            <span break-all font-bold>{{ file.name }}</span>
            <span text-sm op-60>{{ formatBytes(file.size) }}</span>
            <n-tag v-if="file.error" type="error" size="small">
              {{ t('tools.hash-text.file.error') }}
            </n-tag>
            <n-tag v-else-if="file.progress < 100" type="info" size="small">
              {{ t('tools.hash-text.file.hashing') }} {{ file.progress }}%
            </n-tag>
            <template v-else-if="expectedHash.trim()">
              <n-tag v-if="matchedAlgorithm(file)" type="success" size="small" data-test-id="hash-file-match">
                {{ t('tools.hash-text.file.match', { algorithm: matchedAlgorithm(file) }) }}
              </n-tag>
              <n-tag v-else type="error" size="small" data-test-id="hash-file-mismatch">
                {{ t('tools.hash-text.file.mismatch') }}
              </n-tag>
            </template>
          </div>

          <n-progress v-if="!file.error && file.progress < 100" type="line" :percentage="file.progress" :show-indicator="false" mb-2 />

          <div v-for="algorithm in selectedAlgorithms" v-else-if="!file.error" :key="algorithm" style="margin: 5px 0">
            <n-input-group>
              <n-input-group-label style="flex: 0 0 120px">
                {{ algorithm }}
              </n-input-group-label>
              <InputCopyable :value="digestFor(file, algorithm)" readonly />
            </n-input-group>
          </div>
        </div>

        <div flex justify-center>
          <c-button @click="clearFiles">
            {{ t('tools.hash-text.file.clear') }}
          </c-button>
        </div>
      </template>
    </c-card>
  </div>
</template>
