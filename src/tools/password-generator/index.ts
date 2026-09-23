import { Key } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.password-generator.title'),
  path: '/password-generator',
  description: translate('tools.password-generator.description'),
  keywords: ['password', 'generator', 'random', 'secure', 'passphrase', 'pin', 'strong', 'strength', 'entropy'],
  component: () => import('./password-generator.vue'),
  icon: Key,
  createdAt: new Date('2026-09-23'),
});
