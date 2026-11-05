import { Movie } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.video-compressor.title'),
  path: '/video-compressor',
  description: translate('tools.video-compressor.description'),
  keywords: ['video', 'compressor', 'compress', 'shrink', 'resize', 'convert', 'mp4', 'webm', 'mov', 'h264', 'vp9', 'av1', 'webcodecs'],
  component: () => import('./video-compressor.vue'),
  icon: Movie,
  createdAt: new Date('2026-11-05'),
});
