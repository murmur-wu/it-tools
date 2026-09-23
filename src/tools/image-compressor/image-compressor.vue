<script setup lang="ts">
import { zipSync } from 'fflate';
import {
  type OutputFormat,
  buildOutputFilename,
  compressImage,
  getSavedRatio,
} from './image-compressor.service';
import { formatBytes } from '@/utils/convert';

const { t } = useI18n();

type FormatChoice = OutputFormat | 'original';

const format = ref<FormatChoice>('image/webp');
const quality = ref(80);
const maxWidth = ref<number | null>(1920);
const maxHeight = ref<number | null>(null);

interface CompressedImage {
  id: number
  name: string
  outputName: string
  originalSize: number
  compressedSize: number
  width: number
  height: number
  url: string
  blob: Blob
}

const images = ref<CompressedImage[]>([]);
const errors = ref<string[]>([]);
const isWorking = ref(false);
let nextId = 0;

const supportedFormats: OutputFormat[] = ['image/webp', 'image/jpeg', 'image/png'];

function resolveFormat(file: File): OutputFormat {
  if (format.value !== 'original') {
    return format.value;
  }

  return supportedFormats.includes(file.type as OutputFormat) ? (file.type as OutputFormat) : 'image/webp';
}

async function onFilesUpload(files: File[]) {
  errors.value = [];
  isWorking.value = true;

  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        errors.value.push(t('tools.image-compressor.notAnImage', { name: file.name }));
        continue;
      }

      const targetFormat = resolveFormat(file);

      try {
        const { blob, width, height } = await compressImage({
          file,
          format: targetFormat,
          quality: quality.value / 100,
          maxWidth: maxWidth.value ?? undefined,
          maxHeight: maxHeight.value ?? undefined,
        });

        images.value.unshift({
          id: nextId++,
          name: file.name,
          outputName: buildOutputFilename({ name: file.name, format: targetFormat }),
          originalSize: file.size,
          compressedSize: blob.size,
          width,
          height,
          url: URL.createObjectURL(blob),
          blob,
        });
      }
      catch {
        errors.value.push(t('tools.image-compressor.failed', { name: file.name }));
      }
    }
  }
  finally {
    isWorking.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function download(image: CompressedImage) {
  downloadBlob(image.blob, image.outputName);
}

async function downloadAll() {
  const entries: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

  for (const image of images.value) {
    let name = image.outputName;
    let index = 2;
    while (usedNames.has(name)) {
      name = image.outputName.replace(/(\.[^.]+)$/, `-${index++}$1`);
    }
    usedNames.add(name);
    entries[name] = new Uint8Array(await image.blob.arrayBuffer());
  }

  // Images are already compressed, storing them avoids a pointless second pass.
  downloadBlob(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), 'compressed-images.zip');
}

function clearAll() {
  images.value.forEach(image => URL.revokeObjectURL(image.url));
  images.value = [];
  errors.value = [];
}

const totals = computed(() => {
  const originalSize = images.value.reduce((sum, image) => sum + image.originalSize, 0);
  const compressedSize = images.value.reduce((sum, image) => sum + image.compressedSize, 0);

  return { originalSize, compressedSize, saved: getSavedRatio({ originalSize, compressedSize }) };
});

function formatRatio(ratio: number) {
  return `${ratio >= 0 ? '-' : '+'}${Math.abs(Math.round(ratio * 100))}%`;
}

onScopeDispose(() => images.value.forEach(image => URL.revokeObjectURL(image.url)));
</script>

<template>
  <div>
    <c-card>
      <c-select
        v-model:value="format"
        :label="t('tools.image-compressor.format')"
        label-position="left"
        label-width="120px"
        mb-3
        data-test-id="image-compressor-format"
        :options="[
          { label: 'WebP', value: 'image/webp' },
          { label: 'JPEG', value: 'image/jpeg' },
          { label: 'PNG', value: 'image/png' },
          { label: t('tools.image-compressor.keepFormat'), value: 'original' },
        ]"
      />

      <n-form label-width="120" label-placement="left" :show-feedback="false">
        <n-form-item :label="`${t('tools.image-compressor.quality')} (${quality}%)`" mb-3>
          <n-slider v-model:value="quality" :min="1" :max="100" :disabled="format === 'image/png'" />
        </n-form-item>
        <n-form-item :label="t('tools.image-compressor.maxWidth')" mb-3>
          <n-input-number v-model:value="maxWidth" :min="1" clearable w-full :placeholder="t('tools.image-compressor.noLimit')" />
        </n-form-item>
        <n-form-item :label="t('tools.image-compressor.maxHeight')" mb-3>
          <n-input-number v-model:value="maxHeight" :min="1" clearable w-full :placeholder="t('tools.image-compressor.noLimit')" />
        </n-form-item>
      </n-form>

      <div v-if="format === 'image/png'" mb-3 text-xs op-60>
        {{ t('tools.image-compressor.pngHint') }}
      </div>

      <c-file-upload
        multiple
        accept="image/*"
        :title="t('tools.image-compressor.upload')"
        data-test-id="image-compressor-upload"
        @files-upload="onFilesUpload"
      />

      <div mt-2 text-xs op-60>
        {{ t('tools.image-compressor.privacy') }}
      </div>

      <n-spin v-if="isWorking" mt-3 size="small" />

      <div v-for="error in errors" :key="error" mt-3>
        <n-alert type="error">
          {{ error }}
        </n-alert>
      </div>
    </c-card>

    <c-card v-if="images.length > 0" mt-5>
      <div mb-4 flex flex-wrap items-center gap-3>
        <span>
          {{ formatBytes(totals.originalSize) }} → <strong>{{ formatBytes(totals.compressedSize) }}</strong>
        </span>
        <n-tag :type="totals.saved >= 0 ? 'success' : 'warning'" size="small" data-test-id="image-compressor-total">
          {{ formatRatio(totals.saved) }}
        </n-tag>
        <div flex-1 />
        <c-button size="small" @click="downloadAll">
          {{ t('tools.image-compressor.downloadAll') }}
        </c-button>
        <c-button size="small" @click="clearAll">
          {{ t('tools.image-compressor.clear') }}
        </c-button>
      </div>

      <div
        v-for="image in images"
        :key="image.id"
        mb-3 flex flex-wrap items-center gap-3 border-b border-gray-300 border-op-20 pb-3
        data-test-id="compressed-image"
      >
        <img :src="image.url" alt="" h-16 w-16 flex-shrink-0 rounded object-cover>

        <div min-w-0 flex-1>
          <div break-all font-bold>
            {{ image.outputName }}
          </div>
          <div text-sm op-70>
            {{ formatBytes(image.originalSize) }} → {{ formatBytes(image.compressedSize) }}
            · {{ image.width }}×{{ image.height }}
          </div>
        </div>

        <n-tag :type="image.compressedSize <= image.originalSize ? 'success' : 'warning'" size="small">
          {{ formatRatio(getSavedRatio({ originalSize: image.originalSize, compressedSize: image.compressedSize })) }}
        </n-tag>

        <c-button size="small" @click="download(image)">
          {{ t('tools.image-compressor.download') }}
        </c-button>
      </div>
    </c-card>
  </div>
</template>
