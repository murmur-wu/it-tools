<script setup lang="ts">
import {
  type OutputFormat,
  type QualityLevel,
  VideoCompressionError,
  buildOutputFilename,
  compressVideo,
  isVideoCompressionSupported,
  qualityLevels,
  resolutionLimits,
} from './video-compressor.service';
import { getSavedRatio } from '@/tools/image-compressor/image-compressor.service';
import { formatBytes } from '@/utils/convert';

const { t } = useI18n();

const isSupported = isVideoCompressionSupported();

const format = useStorage<OutputFormat>('video-compressor:format', 'mp4');
const quality = useStorage<QualityLevel>('video-compressor:quality', 'medium');
// 0 means "keep the original resolution"
const maxHeight = useStorage<number>('video-compressor:max-height', 1080);

type JobStatus = 'queued' | 'working' | 'done' | 'error';

interface VideoJob {
  id: number
  name: string
  outputName: string
  originalSize: number
  status: JobStatus
  progress: number
  compressedSize?: number
  width?: number
  height?: number
  duration?: number
  blob?: Blob
  error?: string
}

const jobs = ref<VideoJob[]>([]);
// The File is kept off the reactive job so Vue does not try to proxy a large binary object
const files = new Map<number, File>();
const errors = ref<string[]>([]);
let nextId = 0;
let abortController: AbortController | undefined;
let isProcessing = false;

const isWorking = computed(() => jobs.value.some(job => job.status === 'queued' || job.status === 'working'));
const doneJobs = computed(() => jobs.value.filter(job => job.status === 'done'));

function errorMessageOf(error: unknown): string {
  if (error instanceof VideoCompressionError) {
    switch (error.code) {
      case 'no-video-track': return t('tools.video-compressor.errors.noVideoTrack');
      case 'undecodable': return t('tools.video-compressor.errors.undecodable');
      case 'no-encoder': return t('tools.video-compressor.errors.noEncoder');
      case 'unsupported-input': return t('tools.video-compressor.errors.unsupportedInput');
      case 'canceled': return t('tools.video-compressor.errors.canceled');
    }
  }

  return t('tools.video-compressor.errors.failed');
}

// Videos are processed one at a time: each conversion already uses the hardware encoder at full tilt
async function processQueue() {
  if (isProcessing) {
    return;
  }
  isProcessing = true;

  try {
    for (;;) {
      const job = jobs.value.find(candidate => candidate.status === 'queued');
      if (!job) {
        break;
      }

      job.status = 'working';
      abortController = new AbortController();

      try {
        const { blob, width, height, duration } = await compressVideo({
          file: files.get(job.id)!,
          format: format.value,
          quality: quality.value,
          maxHeight: maxHeight.value || undefined,
          signal: abortController.signal,
          onProgress: (progress) => {
            job.progress = progress;
          },
        });

        Object.assign(job, { status: 'done', progress: 1, blob, compressedSize: blob.size, width, height, duration });
      }
      catch (error) {
        Object.assign(job, { status: 'error', error: errorMessageOf(error) });
      }
    }
  }
  finally {
    abortController = undefined;
    isProcessing = false;
  }
}

function onFilesUpload(uploaded: File[]) {
  errors.value = [];

  for (const file of uploaded) {
    if (!file.type.startsWith('video/') && !/\.(mp4|m4v|mov|webm|mkv|ts|m2ts)$/i.test(file.name)) {
      errors.value.push(t('tools.video-compressor.notAVideo', { name: file.name }));
      continue;
    }

    const id = nextId++;
    files.set(id, file);
    jobs.value.unshift({
      id,
      name: file.name,
      outputName: buildOutputFilename({ name: file.name, format: format.value }),
      originalSize: file.size,
      status: 'queued',
      progress: 0,
    });
  }

  processQueue();
}

function cancel() {
  for (const job of jobs.value) {
    if (job.status === 'queued') {
      job.status = 'error';
      job.error = t('tools.video-compressor.errors.canceled');
    }
  }
  abortController?.abort();
}

function download(job: VideoJob) {
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
  cancel();
  jobs.value = [];
  errors.value = [];
  files.clear();
}

const totals = computed(() => {
  const originalSize = doneJobs.value.reduce((sum, job) => sum + job.originalSize, 0);
  const compressedSize = doneJobs.value.reduce((sum, job) => sum + (job.compressedSize ?? 0), 0);

  return { originalSize, compressedSize, saved: getSavedRatio({ originalSize, compressedSize }) };
});

function formatRatio(ratio: number) {
  return `${ratio >= 0 ? '-' : '+'}${Math.abs(Math.round(ratio * 100))}%`;
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

// Lookup used by the template; the job list itself stays free of File objects
function fileOf(job: VideoJob): File {
  return files.get(job.id)!;
}
</script>

<template>
  <div>
    <n-alert v-if="!isSupported" type="warning" mb-5 data-test-id="video-compressor-unsupported">
      {{ t('tools.video-compressor.unsupported') }}
    </n-alert>

    <c-card>
      <c-select
        v-model:value="format"
        :label="t('tools.video-compressor.format')"
        label-position="left"
        label-width="140px"
        mb-3
        data-test-id="video-compressor-format"
        :options="[
          { label: 'MP4', value: 'mp4' },
          { label: 'WebM', value: 'webm' },
        ]"
      />

      <c-select
        v-model:value="quality"
        :label="t('tools.video-compressor.quality')"
        label-position="left"
        label-width="140px"
        mb-3
        data-test-id="video-compressor-quality"
        :options="qualityLevels.map(level => ({ label: t(`tools.video-compressor.qualityLevels.${level}`), value: level }))"
      />

      <c-select
        v-model:value="maxHeight"
        :label="t('tools.video-compressor.maxResolution')"
        label-position="left"
        label-width="140px"
        mb-3
        data-test-id="video-compressor-resolution"
        :options="[
          { label: t('tools.video-compressor.original'), value: 0 },
          ...resolutionLimits.map(height => ({ label: `${height}p`, value: height })),
        ]"
      />

      <c-file-upload
        multiple
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv"
        :title="t('tools.video-compressor.upload')"
        data-test-id="video-compressor-upload"
        @files-upload="onFilesUpload"
      />

      <div mt-2 text-xs op-60>
        {{ t('tools.video-compressor.privacy') }}
      </div>

      <div v-for="error in errors" :key="error" mt-3>
        <n-alert type="error">
          {{ error }}
        </n-alert>
      </div>
    </c-card>

    <c-card v-if="jobs.length > 0" mt-5>
      <div mb-4 flex flex-wrap items-center gap-3>
        <span v-if="doneJobs.length > 0">
          {{ formatBytes(totals.originalSize) }} → <strong>{{ formatBytes(totals.compressedSize) }}</strong>
        </span>
        <n-tag v-if="doneJobs.length > 0" :type="totals.saved >= 0 ? 'success' : 'warning'" size="small" data-test-id="video-compressor-total">
          {{ formatRatio(totals.saved) }}
        </n-tag>
        <div flex-1 />
        <c-button v-if="isWorking" size="small" @click="cancel">
          {{ t('tools.video-compressor.cancel') }}
        </c-button>
        <c-button size="small" @click="clearAll">
          {{ t('tools.video-compressor.clear') }}
        </c-button>
      </div>

      <div
        v-for="job in jobs"
        :key="job.id"
        mb-3 border-b border-gray-300 border-op-20 pb-3
        data-test-id="video-job"
        :data-status="job.status"
      >
        <div flex flex-wrap items-center gap-3>
          <div min-w-0 flex-1>
            <div break-all font-bold>
              {{ job.outputName }}
            </div>
            <div text-sm op-70>
              <template v-if="job.status === 'done'">
                {{ formatBytes(job.originalSize) }} → {{ formatBytes(job.compressedSize!) }}
                · {{ job.width }}×{{ job.height }}
                · {{ formatDuration(job.duration!) }}
              </template>
              <template v-else-if="job.status === 'error'">
                {{ job.error }}
              </template>
              <template v-else>
                {{ formatBytes(job.originalSize) }} · {{ fileOf(job).type || '—' }}
              </template>
            </div>
          </div>

          <n-tag v-if="job.status === 'done'" :type="job.compressedSize! <= job.originalSize ? 'success' : 'warning'" size="small">
            {{ formatRatio(getSavedRatio({ originalSize: job.originalSize, compressedSize: job.compressedSize! })) }}
          </n-tag>
          <n-tag v-else-if="job.status === 'error'" type="error" size="small">
            {{ t('tools.video-compressor.status.error') }}
          </n-tag>
          <n-tag v-else-if="job.status === 'queued'" size="small">
            {{ t('tools.video-compressor.status.queued') }}
          </n-tag>

          <c-button v-if="job.status === 'done'" size="small" @click="download(job)">
            {{ t('tools.video-compressor.download') }}
          </c-button>
        </div>

        <n-progress
          v-if="job.status === 'working'"
          type="line"
          :percentage="Math.round(job.progress * 100)"
          indicator-placement="inside"
          processing
          mt-2
        />
      </div>
    </c-card>
  </div>
</template>
