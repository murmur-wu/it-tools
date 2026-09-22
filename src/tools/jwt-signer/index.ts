import { Signature } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.jwt-signer.title'),
  path: '/jwt-signer',
  description: translate('tools.jwt-signer.description'),
  keywords: ['jwt', 'sign', 'verify', 'signature', 'hmac', 'hs256', 'rs256', 'es256', 'jws', 'token', 'generate'],
  component: () => import('./jwt-signer.vue'),
  icon: Signature,
  createdAt: new Date('2026-09-21'),
});
