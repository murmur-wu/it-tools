import { Language } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.chinese-converter.title'),
  path: '/chinese-converter',
  description: translate('tools.chinese-converter.description'),
  keywords: ['chinese', 'traditional', 'simplified', 'opencc', '繁體', '簡體', '繁简', '简繁', '转换', '轉換', 'taiwan', 'hong kong', 'zh-tw', 'zh-cn'],
  component: () => import('./chinese-converter.vue'),
  icon: Language,
  createdAt: new Date('2026-09-21'),
});
