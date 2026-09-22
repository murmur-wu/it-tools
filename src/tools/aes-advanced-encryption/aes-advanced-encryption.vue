<script setup lang="ts">
import {
  type AesMode,
  type BytesEncoding,
  aesModes,
  decodeBytes,
  decryptAes,
  encodeBytes,
  encryptAes,
  getAesKeySize,
  getAesModeInfo,
  randomBytes,
  validateIv,
} from './aes-advanced-encryption.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useToolInput } from '@/composable/toolInput';

const bytesEncodingOptions = [
  { label: 'Hexadecimal', value: 'hex' },
  { label: 'Base64', value: 'base64' },
  { label: 'UTF-8 text', value: 'utf8' },
];
const cipherEncodingOptions = bytesEncodingOptions.filter(({ value }) => value !== 'utf8');
const modeOptions = aesModes.map(({ value, label }) => ({ label, value }));

const mode = ref<AesMode>('CBC');
const modeInfo = computed(() => getAesModeInfo(mode.value));

const keyEncoding = ref<BytesEncoding>('hex');
const key = ref(encodeBytes(randomBytes(32), 'hex'));
const ivEncoding = ref<BytesEncoding>('hex');
const iv = ref(encodeBytes(randomBytes(16), 'hex'));
const additionalData = ref('');

function tryDecode(value: string, encoding: BytesEncoding): { bytes: Uint8Array; error?: undefined } | { bytes?: undefined; error: string } {
  try {
    return { bytes: decodeBytes(value, encoding) };
  }
  catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const keyBytes = computed(() => tryDecode(key.value, keyEncoding.value));
const keyStatus = computed(() => {
  const { bytes, error } = keyBytes.value;
  if (error !== undefined) {
    return { error };
  }
  try {
    return { info: `AES-${getAesKeySize(bytes)} (${bytes.length} bytes)` };
  }
  catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

const ivBytes = computed(() => tryDecode(iv.value, ivEncoding.value));
const ivStatus = computed(() => {
  if (!modeInfo.value.needsIv) {
    return { info: 'Not used in ECB mode' };
  }
  const { bytes, error } = ivBytes.value;
  if (error !== undefined) {
    return { error };
  }
  const ivError = validateIv(bytes, mode.value);
  return ivError ? { error: ivError } : { info: `${bytes.length} bytes` };
});

function generateKey(bits: 128 | 192 | 256) {
  key.value = encodeBytes(randomBytes(bits / 8), keyEncoding.value === 'utf8' ? 'hex' : keyEncoding.value);
  if (keyEncoding.value === 'utf8') {
    keyEncoding.value = 'hex';
  }
}

function generateIv() {
  iv.value = encodeBytes(randomBytes(modeInfo.value.ivLength), ivEncoding.value === 'utf8' ? 'hex' : ivEncoding.value);
  if (ivEncoding.value === 'utf8') {
    ivEncoding.value = 'hex';
  }
}

// Keep the underlying bytes when the user switches the display encoding of the key or IV
function reencodeOnEncodingChange(value: Ref<string>, encoding: Ref<BytesEncoding>) {
  watch(encoding, (newEncoding, oldEncoding) => {
    try {
      value.value = encodeBytes(decodeBytes(value.value, oldEncoding), newEncoding);
    }
    catch {
      // The current value cannot be represented in the new encoding, leave it as is
    }
  });
}
reencodeOnEncodingChange(key, keyEncoding);
reencodeOnEncodingChange(iv, ivEncoding);

// When the mode changes and the current IV no longer fits, generate one of the right length
watch(mode, () => {
  if (modeInfo.value.needsIv && ivStatus.value.error !== undefined) {
    generateIv();
  }
});

const additionalDataBytes = computed(() => (mode.value === 'GCM' && additionalData.value.length > 0 ? decodeBytes(additionalData.value, 'utf8') : undefined));

function getSettingsError(): string | undefined {
  return keyStatus.value.error ?? ivStatus.value.error;
}

// Encrypt
const plaintext = ref('Lorem ipsum dolor sit amet');
useToolInput(plaintext, { example: 'Lorem ipsum dolor sit amet' });
const ciphertextEncoding = ref<BytesEncoding>('base64');
const emptyResult = { value: '', error: undefined as string | undefined };

const encryptResult = computedAsync(async () => {
  try {
    const settingsError = getSettingsError();
    if (settingsError) {
      return { value: '', error: settingsError };
    }
    const ciphertext = await encryptAes({
      plaintext: decodeBytes(plaintext.value, 'utf8'),
      key: keyBytes.value.bytes!,
      iv: modeInfo.value.needsIv ? ivBytes.value.bytes : undefined,
      mode: mode.value,
      additionalData: additionalDataBytes.value,
    });
    return { value: encodeBytes(ciphertext, ciphertextEncoding.value), error: undefined };
  }
  catch (err) {
    return { value: '', error: err instanceof Error ? err.message : String(err) };
  }
}, emptyResult);

// Decrypt
const ciphertextInput = ref('');
const ciphertextInputEncoding = ref<BytesEncoding>('base64');
const plaintextOutputEncoding = ref<BytesEncoding>('utf8');

const decryptResult = computedAsync(async () => {
  try {
    if (ciphertextInput.value.trim().length === 0) {
      return emptyResult;
    }
    const settingsError = getSettingsError();
    if (settingsError) {
      return { value: '', error: settingsError };
    }
    const decrypted = await decryptAes({
      ciphertext: decodeBytes(ciphertextInput.value, ciphertextInputEncoding.value),
      key: keyBytes.value.bytes!,
      iv: modeInfo.value.needsIv ? ivBytes.value.bytes : undefined,
      mode: mode.value,
      additionalData: additionalDataBytes.value,
    });
    try {
      return { value: encodeBytes(decrypted, plaintextOutputEncoding.value), error: undefined };
    }
    catch {
      return { value: '', error: 'Decrypted bytes are not valid UTF-8 text. Wrong key or IV? Try displaying the output as hexadecimal.' };
    }
  }
  catch (err) {
    return { value: '', error: err instanceof Error ? err.message : String(err) };
  }
}, emptyResult);

function useEncryptedOutputAsInput() {
  ciphertextInputEncoding.value = ciphertextEncoding.value;
  ciphertextInput.value = encryptResult.value.value;
}
</script>

<template>
  <div flex flex-col gap-4>
    <c-card title="Key, IV and mode">
      <c-select
        v-model:value="mode"
        label="Mode of operation:"
        :options="modeOptions"
      />
      <div mt-1 text-xs op-70>
        {{ modeInfo.description }}
      </div>

      <div mt-4 flex gap-2>
        <c-input-text
          v-model:value="key"
          label="Key:"
          placeholder="Secret key (16, 24 or 32 bytes)"
          raw-text monospace clearable flex-1
          test-id="aes-key"
        />
        <c-select
          v-model:value="keyEncoding"
          label="Key encoding:"
          :options="bytesEncodingOptions"
          w-150px
        />
      </div>
      <div mt-1 flex flex-wrap items-center gap-2>
        <span :class="keyStatus.error ? 'text-red-500' : 'op-70'" text-xs>
          {{ keyStatus.error ?? keyStatus.info }}
        </span>
        <span flex-1 />
        <c-button size="small" @click="generateKey(128)">
          Random 128-bit
        </c-button>
        <c-button size="small" @click="generateKey(192)">
          Random 192-bit
        </c-button>
        <c-button size="small" @click="generateKey(256)">
          Random 256-bit
        </c-button>
      </div>

      <template v-if="modeInfo.needsIv">
        <div mt-4 flex gap-2>
          <c-input-text
            v-model:value="iv"
            :label="`${modeInfo.ivLabel}:`"
            :placeholder="`${modeInfo.ivLength} bytes`"
            raw-text monospace clearable flex-1
            test-id="aes-iv"
          />
          <c-select
            v-model:value="ivEncoding"
            :label="`${modeInfo.ivLabel} encoding:`"
            :options="bytesEncodingOptions"
            w-150px
          />
        </div>
        <div mt-1 flex flex-wrap items-center gap-2>
          <span :class="ivStatus.error ? 'text-red-500' : 'op-70'" text-xs>
            {{ ivStatus.error ?? ivStatus.info }}
          </span>
          <span flex-1 />
          <c-button size="small" @click="generateIv()">
            Random {{ modeInfo.ivLength * 8 }}-bit
          </c-button>
        </div>
      </template>

      <c-input-text
        v-if="mode === 'GCM'"
        v-model:value="additionalData"
        label="Additional authenticated data (optional, UTF-8):"
        placeholder="Data that is authenticated but not encrypted"
        raw-text clearable mt-4
      />
    </c-card>

    <c-card title="Encrypt">
      <c-input-text
        v-model:value="plaintext"
        label="Plain text (UTF-8):"
        placeholder="The text to encrypt"
        rows="3"
        raw-text monospace autosize multiline
        test-id="aes-plaintext"
      />
      <c-select
        v-model:value="ciphertextEncoding"
        label="Ciphertext encoding:"
        :options="cipherEncodingOptions"
        mt-3 w-200px
      />

      <c-alert v-if="encryptResult.error" type="error" mt-4 title="Unable to encrypt">
        {{ encryptResult.error }}
      </c-alert>
      <div v-else mt-4>
        <div mb-1>
          Encrypted text{{ modeInfo.isAuthenticated ? ' (ciphertext + 16-byte tag)' : '' }}:
        </div>
        <TextareaCopyable :value="encryptResult.value" data-test-id="aes-ciphertext" />
        <div mt-3 flex justify-center>
          <c-button :disabled="!encryptResult.value" @click="useEncryptedOutputAsInput()">
            Use as decrypt input
          </c-button>
        </div>
      </div>
    </c-card>

    <c-card title="Decrypt">
      <c-input-text
        v-model:value="ciphertextInput"
        label="Encrypted text:"
        placeholder="The ciphertext to decrypt"
        rows="3"
        multiline raw-text monospace autosize
        test-id="aes-ciphertext-input"
      />
      <div mt-3 flex flex-wrap gap-2>
        <c-select
          v-model:value="ciphertextInputEncoding"
          label="Ciphertext encoding:"
          :options="cipherEncodingOptions"
          flex-1
        />
        <c-select
          v-model:value="plaintextOutputEncoding"
          label="Show decrypted output as:"
          :options="bytesEncodingOptions"
          flex-1
        />
      </div>

      <c-alert v-if="decryptResult.error" type="error" mt-4 title="Unable to decrypt">
        {{ decryptResult.error }}
      </c-alert>
      <div v-else mt-4>
        <div mb-1>
          Decrypted text:
        </div>
        <TextareaCopyable :value="decryptResult.value" data-test-id="aes-decrypted" />
      </div>
    </c-card>
  </div>
</template>
