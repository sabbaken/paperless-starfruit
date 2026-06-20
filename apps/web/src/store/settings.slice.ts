import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';

export type Theme = 'dark' | 'light' | 'system';

export interface SettingsState {
  theme: Theme;
  /** Whether the nav sidebar is expanded. Persisted so it survives reloads. */
  sidebarOpen: boolean;
}

const initialState: SettingsState = {
  theme: 'system',
  sidebarOpen: true,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
  },
});

export const { setTheme, setSidebarOpen } = settingsSlice.actions;

export const selectTheme = (state: RootState): Theme => state.settings.theme;

// `?? true` guards rehydration: state persisted before this field existed has no
// `sidebarOpen`, and the default merge replaces the nested object rather than filling it.
export const selectSidebarOpen = (state: RootState): boolean => state.settings.sidebarOpen ?? true;

export default settingsSlice.reducer;
