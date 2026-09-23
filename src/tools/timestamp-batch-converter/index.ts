import { History } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.timestamp-batch-converter.title'),
  path: '/timestamp-batch-converter',
  description: translate('tools.timestamp-batch-converter.description'),
  keywords: ['timestamp', 'unix', 'epoch', 'batch', 'date', 'time', 'convert', 'timezone', 'bulk'],
  component: () => import('./timestamp-batch-converter.vue'),
  icon: History,
  createdAt: new Date('2026-09-23'),
});
