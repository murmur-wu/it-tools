import { LockSquare } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.aes-advanced-encryption.title'),
  path: '/aes-advanced-encryption',
  description: translate('tools.aes-advanced-encryption.description'),
  keywords: ['aes', 'advanced', 'encrypt', 'decrypt', 'cipher', 'key', 'iv', 'nonce', 'cbc', 'gcm', 'ctr', 'ecb', 'hex', 'base64'],
  component: () => import('./aes-advanced-encryption.vue'),
  icon: LockSquare,
  createdAt: new Date('2026-09-21'),
});
