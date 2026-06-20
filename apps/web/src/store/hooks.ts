import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '.';

/** Typed `useDispatch` — knows the store's thunk/action types. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/** Typed `useSelector` — selectors receive the full {@link RootState}. */
export const useAppSelector = useSelector.withTypes<RootState>();
