import { Photo } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-compressor.title'),
  path: '/image-compressor',
  description: translate('tools.image-compressor.description'),
  keywords: ['image', 'compress', 'compressor', 'webp', 'jpeg', 'png', 'resize', 'optimize', 'picture', 'photo'],
  component: () => import('./image-compressor.vue'),
  icon: Photo,
  createdAt: new Date('2026-09-23'),
});
