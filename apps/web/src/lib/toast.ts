import toast from 'react-hot-toast';

/**
 * Wrap a save request in a single loading → success/error toast. Reuses one toast
 * id so rapid consecutive saves update the same toast instead of stacking.
 */
export function toastSave<T>(promise: Promise<T>): Promise<T> {
  return toast.promise(
    promise,
    {
      loading: 'Saving…',
      success: 'Saved',
      error: (e) => (e instanceof Error ? e.message : 'Save failed'),
    },
    { id: 'settings-save' },
  );
}
