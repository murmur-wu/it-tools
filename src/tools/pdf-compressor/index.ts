import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';
import PdfIcon from '~icons/mdi/file-pdf-box';

export const tool = defineTool({
  name: translate('tools.pdf-compressor.title'),
  path: '/pdf-compressor',
  description: translate('tools.pdf-compressor.description'),
  keywords: ['pdf', 'compress', 'compressor', 'reduce', 'shrink', 'size', 'optimize', 'ghostscript', 'scan', 'document'],
  component: () => import('./pdf-compressor.vue'),
  icon: PdfIcon,
  createdAt: new Date('2026-09-24'),
});
