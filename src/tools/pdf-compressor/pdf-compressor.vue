<script setup lang="ts">
import {
  type CompressionPreset,
  buildOutputFilename,
  compressionPresets,
  getSavedRatio,
  isPdf,
  presetResolution,
} from './pdf-compressor.service';
import type { CompressRequest, CompressResponse } from './pdf-compressor.types';
import { formatBytes } from '@/utils/convert';

const { t } = useI18n();

// Above this size the browser may run out of memory, especially on phones
const largeFileSize = 100 * 1024 * 1024;

const preset = ref<CompressionPreset>('ebook');

type Status = 'waiting' | 'loading-engine' | 'compressing' | 'done' | 'not-smaller' | 'error';

interface PdfJob {
  id: number
  name: string
  outputName: string
  originalSize: number
  input: ArrayBuffer
  preset: CompressionPreset
  status: Status
  page: number
  total: number
  compressedSize?: number
  blob?: Blob
  errorReason?: string
}

const jobs = ref<PdfJob[]>([]);
let nextId = 0;
let worker: Worker | undefined;
let isRunning = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./pdf-compressor.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<CompressResponse>) => onWorkerMessage(data);
  }
  return worker;
}

function findJob(id: number) {
  return jobs.value.find(job => job.id === id);
}

let finishCurrent: (() => void) | undefined;

function onWorkerMessage(message: CompressResponse) {
  const job = findJob(message.id);
  if (!job) {
    finishCurrent?.();
    return;
  }

  if (message.type === 'loading-engine') {
    job.status = 'loading-engine';
  }
  else if (message.type === 'progress') {
    job.status = 'compressing';
    job.page = message.page;
    job.total = message.total;
  }
  else if (message.type === 'done') {
    const blob = new Blob([message.output], { type: 'application/pdf' });
    job.compressedSize = blob.size;
    // Keeping a larger file makes no sense: tell the user the original is already as small as it gets
    if (blob.size >= job.originalSize) {
      job.status = 'not-smaller';
    }
    else {
      job.status = 'done';
      job.blob = blob;
    }
    finishCurrent?.();
  }
  else {
    job.status = 'error';
    job.errorReason = message.reason;
    finishCurrent?.();
  }
}

function runJob(job: PdfJob): Promise<void> {
  return new Promise((resolve) => {
    finishCurrent = resolve;
    job.status = 'waiting';
    job.page = 0;
    job.total = 0;
    job.blob = undefined;
    job.compressedSize = undefined;
    job.errorReason = undefined;

    // Send a copy so the original bytes stay available for re-compressing with another preset
    const input = job.input.slice(0);
    const request: CompressRequest = { id: job.id, input, preset: job.preset };
    getWorker().postMessage(request, [input]);
  });
}

// PDFs are compressed one after the other to keep memory usage predictable
async function processQueue() {
  if (isRunning) {
    return;
  }
  isRunning = true;

  try {
    let job = jobs.value.find(candidate => candidate.status === 'waiting');
    while (job) {
      await runJob(job);
      job = jobs.value.find(candidate => candidate.status === 'waiting');
    }
  }
  finally {
    isRunning = false;
  }
}

async function onFilesUpload(files: File[]) {
  for (const file of files) {
    const input = await file.arrayBuffer();
    // Reject other files right away, without downloading the engine
    const isPdfFile = isPdf(new Uint8Array(input));

    jobs.value.unshift({
      id: nextId++,
      name: file.name,
      outputName: buildOutputFilename(file.name),
      originalSize: file.size,
      input: isPdfFile ? input : new ArrayBuffer(0),
      preset: preset.value,
      status: isPdfFile ? 'waiting' : 'error',
      errorReason: isPdfFile ? undefined : 'notPdf',
      page: 0,
      total: 0,
    });
  }

  processQueue();
}

function recompress(job: PdfJob) {
  job.preset = preset.value;
  job.status = 'waiting';
  processQueue();
}

function download(job: PdfJob) {
  if (!job.blob) {
    return;
  }

  const url = URL.createObjectURL(job.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = job.outputName;
  link.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  jobs.value = jobs.value.filter(job => job.status === 'loading-engine' || job.status === 'compressing');
}

const isBusy = computed(() => jobs.value.some(job => ['waiting', 'loading-engine', 'compressing'].includes(job.status)));
const hasLargeFile = computed(() => jobs.value.some(job => job.originalSize > largeFileSize));

function progressPercentage(job: PdfJob) {
  return job.total > 0 ? Math.round((job.page / job.total) * 100) : 0;
}

function formatRatio(job: PdfJob) {
  const ratio = getSavedRatio({ originalSize: job.originalSize, compressedSize: job.compressedSize ?? job.originalSize });
  return `-${Math.round(ratio * 100)}%`;
}

onScopeDispose(() => worker?.terminate());
</script>

<template>
  <div>
    <c-card>
      <div mb-2 font-bold>
        {{ t('tools.pdf-compressor.preset') }}
      </div>
      <n-radio-group v-model:value="preset" name="pdf-compressor-preset" data-test-id="pdf-compressor-preset" mb-4>
        <div flex flex-col gap-2>
          <n-radio v-for="option in compressionPresets" :key="option" :value="option">
            <strong>{{ t(`tools.pdf-compressor.presets.${option}.label`) }}</strong>
            <span op-70> · {{ presetResolution[option] }} dpi · {{ t(`tools.pdf-compressor.presets.${option}.hint`) }}</span>
          </n-radio>
        </div>
      </n-radio-group>

      <c-file-upload
        multiple
        accept="application/pdf,.pdf"
        :title="t('tools.pdf-compressor.upload')"
        data-test-id="pdf-compressor-upload"
        @files-upload="onFilesUpload"
      />

      <div mt-2 text-xs op-60>
        {{ t('tools.pdf-compressor.privacy') }}
        {{ t('tools.pdf-compressor.engine') }}
        <a href="https://github.com/murmur-wu/it-tools" target="_blank" rel="noopener" class="text-primary">{{ t('tools.pdf-compressor.sourceCode') }}</a>
      </div>

      <n-alert v-if="hasLargeFile" type="warning" mt-3>
        {{ t('tools.pdf-compressor.largeFile') }}
      </n-alert>
    </c-card>

    <c-card v-if="jobs.length > 0" mt-5>
      <div mb-4 flex items-center>
        <div flex-1 />
        <c-button size="small" :disabled="isBusy" @click="clearAll">
          {{ t('tools.pdf-compressor.clear') }}
        </c-button>
      </div>

      <div
        v-for="job in jobs"
        :key="job.id"
        mb-3 border-b border-gray-300 border-op-20 pb-3
        data-test-id="compressed-pdf"
        :data-status="job.status"
      >
        <div flex flex-wrap items-center gap-3>
          <div min-w-0 flex-1>
            <div break-all font-bold>
              {{ job.status === 'done' ? job.outputName : job.name }}
            </div>
            <div text-sm op-70>
              <template v-if="job.status === 'done'">
                {{ formatBytes(job.originalSize) }} → <strong>{{ formatBytes(job.compressedSize ?? 0) }}</strong>
              </template>
              <template v-else>
                {{ formatBytes(job.originalSize) }}
              </template>
              · {{ t(`tools.pdf-compressor.presets.${job.preset}.label`) }}
            </div>
          </div>

          <template v-if="job.status === 'done'">
            <n-tag type="success" size="small" data-test-id="pdf-compressor-ratio">
              {{ formatRatio(job) }}
            </n-tag>
            <c-button size="small" data-test-id="pdf-compressor-download" @click="download(job)">
              {{ t('tools.pdf-compressor.download') }}
            </c-button>
          </template>

          <c-button
            v-if="['done', 'not-smaller', 'error'].includes(job.status) && job.errorReason !== 'notPdf' && job.preset !== preset"
            size="small"
            data-test-id="pdf-compressor-recompress"
            @click="recompress(job)"
          >
            {{ t('tools.pdf-compressor.recompress') }}
          </c-button>
        </div>

        <div v-if="job.status === 'waiting'" mt-2 text-sm op-70>
          {{ t('tools.pdf-compressor.waiting') }}
        </div>
        <div v-else-if="job.status === 'loading-engine'" mt-2 flex items-center gap-2 text-sm op-70>
          <n-spin size="small" />
          {{ t('tools.pdf-compressor.loadingEngine') }}
        </div>
        <div v-else-if="job.status === 'compressing'" mt-2>
          <n-progress
            type="line"
            :percentage="progressPercentage(job)"
            :show-indicator="false"
            :processing="job.total === 0"
          />
          <div mt-1 text-sm op-70>
            {{ job.total > 0 ? t('tools.pdf-compressor.progress', { page: job.page, total: job.total }) : t('tools.pdf-compressor.compressing') }}
          </div>
        </div>
        <n-alert v-else-if="job.status === 'not-smaller'" type="info" mt-2>
          {{ t('tools.pdf-compressor.notSmaller') }}
        </n-alert>
        <n-alert v-else-if="job.status === 'error'" type="error" mt-2>
          {{ t(`tools.pdf-compressor.errors.${job.errorReason}`) }}
        </n-alert>
      </div>
    </c-card>
  </div>
</template>
