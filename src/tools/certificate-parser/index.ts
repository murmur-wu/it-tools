import { Certificate } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.certificate-parser.title'),
  path: '/certificate-parser',
  description: translate('tools.certificate-parser.description'),
  keywords: ['certificate', 'x509', 'x.509', 'pem', 'der', 'ssl', 'tls', 'https', 'expiry', 'san', 'fingerprint', 'chain'],
  component: () => import('./certificate-parser.vue'),
  icon: Certificate,
  createdAt: new Date('2026-09-21'),
});
