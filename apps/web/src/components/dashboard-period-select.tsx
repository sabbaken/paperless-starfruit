import { useSearchParams } from 'react-router';
import { statsPeriodSchema } from '@paperless-starfruit/shared';
import { useTranslation } from '@/i18n/I18nProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function DashboardPeriodSelect() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = statsPeriodSchema.safeParse(searchParams.get('period'));

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <label htmlFor="dashboard-period" className="sr-only">
        {t('dashboard.period')}
      </label>
      <Select
        value={parsed.success ? parsed.data : '30'}
        onValueChange={(value) => {
          setSearchParams(
            (params) => {
              params.set('period', value);
              return params;
            },
            { replace: true },
          );
        }}
      >
        <SelectTrigger id="dashboard-period" className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30">{t('dashboard.last30Days')}</SelectItem>
          <SelectItem value="90">{t('dashboard.last90Days')}</SelectItem>
          <SelectItem value="365">{t('dashboard.last365Days')}</SelectItem>
          <SelectItem value="all">{t('dashboard.allTime')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
