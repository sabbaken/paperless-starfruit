import toast from 'react-hot-toast';
import { getT } from '@/i18n/t';

/**
 * Wrap a save request in a single loading → success/error toast. Reuses one toast
 * id so rapid consecutive saves update the same toast instead of stacking.
 */
export function toastSave<T>(promise: Promise<T>): Promise<T> {
  const t = getT();
  return toast.promise(
    promise,
    {
      loading: t('common.saving'),
      success: t('common.saved'),
      error: (e) => (e instanceof Error ? e.message : t('common.saveFailed')),
    },
    { id: 'settings-save' },
  );
}
