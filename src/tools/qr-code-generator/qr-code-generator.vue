<script setup lang="ts">
import type { QRCodeErrorCorrectionLevel } from 'qrcode';
import { useQRCode } from './useQRCode';
import { decodeQrCodeFromFile } from './qr-code-decoder.service';
import { useDownloadFileFromBase64 } from '@/composable/downloadBase64';
import { useToolInput } from '@/composable/toolInput';

const { t } = useI18n();

const foreground = ref('#000000ff');
const background = ref('#ffffffff');
const errorCorrectionLevel = ref<QRCodeErrorCorrectionLevel>('medium');

const errorCorrectionLevels = ['low', 'medium', 'quartile', 'high'];

const text = ref('https://ittools.heitang.info');
useToolInput(text, { example: 'https://ittools.heitang.info' });
const { qrcode } = useQRCode({
  text,
  color: {
    background,
    foreground,
  },
  errorCorrectionLevel,
  options: { width: 1024 },
});

const { download } = useDownloadFileFromBase64({ source: qrcode, filename: 'qr-code.png' });

// --- Decode a QR code from an uploaded or pasted image ---

const decodedText = ref('');
const decodeStatus = ref<'idle' | 'decoding' | 'found' | 'notFound' | 'error'>('idle');
const uploadedImagePreview = ref('');

async function decodeImage(file: Blob) {
  decodeStatus.value = 'decoding';
  decodedText.value = '';

  if (uploadedImagePreview.value) {
    URL.revokeObjectURL(uploadedImagePreview.value);
  }
  uploadedImagePreview.value = URL.createObjectURL(file);

  try {
    const result = await decodeQrCodeFromFile(file);

    if (result === undefined) {
      decodeStatus.value = 'notFound';
      return;
    }

    decodedText.value = result;
    decodeStatus.value = 'found';
  }
  catch {
    decodeStatus.value = 'error';
  }
}

function onImageUpload(file: File) {
  if (file.type.startsWith('image/')) {
    decodeImage(file);
  }
}

useEventListener(document, 'paste', (event: ClipboardEvent) => {
  const image = Array.from(event.clipboardData?.files ?? []).find(file => file.type.startsWith('image/'));

  if (image) {
    decodeImage(image);
  }
});

function useDecodedAsInput() {
  text.value = decodedText.value;
}

onScopeDispose(() => {
  if (uploadedImagePreview.value) {
    URL.revokeObjectURL(uploadedImagePreview.value);
  }
});
</script>

<template>
  <c-card>
    <n-grid x-gap="12" y-gap="12" cols="1 600:3">
      <n-gi span="2">
        <c-input-text
          v-model:value="text"
          label-position="left"
          label-width="130px"
          label-align="right"
          label="Text:"
          multiline
          rows="1"
          autosize
          placeholder="Your link or text..."
          mb-6
        />
        <n-form label-width="130" label-placement="left">
          <n-form-item label="Foreground color:">
            <n-color-picker v-model:value="foreground" :modes="['hex']" />
          </n-form-item>
          <n-form-item label="Background color:">
            <n-color-picker v-model:value="background" :modes="['hex']" />
          </n-form-item>
          <c-select
            v-model:value="errorCorrectionLevel"
            label="Error resistance:"
            label-position="left"
            label-width="130px"
            label-align="right"
            :options="errorCorrectionLevels.map((value) => ({ label: value, value }))"
          />
        </n-form>
      </n-gi>
      <n-gi>
        <div flex flex-col items-center gap-3>
          <n-image :src="qrcode" width="200" />
          <c-button @click="download">
            Download qr-code
          </c-button>
        </div>
      </n-gi>
    </n-grid>
  </c-card>

  <c-card :title="t('tools.qrcode-generator.decode.title')" mt-5>
    <c-file-upload accept="image/*" :title="t('tools.qrcode-generator.decode.upload')" data-test-id="qr-decode-upload" @file-upload="onImageUpload" />

    <div mt-2 text-xs op-60>
      {{ t('tools.qrcode-generator.decode.pasteHint') }} {{ t('tools.qrcode-generator.decode.privacy') }}
    </div>

    <div v-if="decodeStatus !== 'idle'" mt-4 flex flex-col gap-3 md:flex-row>
      <div v-if="uploadedImagePreview" flex-shrink-0>
        <img :src="uploadedImagePreview" alt="" max-h-40 max-w-40 border border-gray-300 border-opacity-40 rounded>
      </div>

      <div min-w-0 flex-1>
        <n-alert v-if="decodeStatus === 'notFound'" type="warning" data-test-id="qr-decode-not-found">
          {{ t('tools.qrcode-generator.decode.notFound') }}
        </n-alert>
        <n-alert v-else-if="decodeStatus === 'error'" type="error">
          {{ t('tools.qrcode-generator.decode.error') }}
        </n-alert>
        <n-spin v-else-if="decodeStatus === 'decoding'" size="small" />
        <template v-else>
          <div mb-2 text-sm op-70>
            {{ t('tools.qrcode-generator.decode.result') }}
          </div>
          <TextareaCopyable :value="decodedText" data-test-id="qr-decode-result" />
          <div mt-3 flex justify-end>
            <c-button size="small" @click="useDecodedAsInput">
              {{ t('tools.qrcode-generator.decode.useAsInput') }}
            </c-button>
          </div>
        </template>
      </div>
    </div>
  </c-card>
</template>
