import { CalendarStats } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.date-calculator.title'),
  path: '/date-calculator',
  description: translate('tools.date-calculator.description'),
  keywords: ['date', 'calculator', 'days', 'between', 'difference', 'add', 'subtract', 'business', 'working', 'workdays', 'weekday', 'holiday', 'taiwan', 'duration', 'deadline'],
  component: () => import('./date-calculator.vue'),
  icon: CalendarStats,
  createdAt: new Date('2026-10-12'),
});
