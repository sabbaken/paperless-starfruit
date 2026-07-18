import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_LOCALE, type Locale } from '@paperless-starfruit/shared';
import type { RootState } from '.';

export type Theme = 'dark' | 'light' | 'system';

export interface SettingsState {
  theme: Theme;
  /** The UI (interface) locale. Distinct from the LLM "Output language" setting. */
  language: Locale;
  /** Whether the nav sidebar is expanded. Persisted so it survives reloads. */
  sidebarOpen: boolean;
}

const initialState: SettingsState = {
  theme: 'system',
  language: DEFAULT_LOCALE,
  sidebarOpen: true,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    setLanguage(state, action: PayloadAction<Locale>) {
      state.language = action.payload;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
  },
});

export const { setTheme, setLanguage, setSidebarOpen } = settingsSlice.actions;

export const selectTheme = (state: RootState): Theme => state.settings.theme;

// `?? DEFAULT_LOCALE` guards rehydration: state persisted before this field existed
// has no `language`, and the default merge replaces the nested object rather than filling it.
export const selectLanguage = (state: RootState): Locale =>
  state.settings.language ?? DEFAULT_LOCALE;

// `?? true` guards rehydration: state persisted before this field existed has no
// `sidebarOpen`, and the default merge replaces the nested object rather than filling it.
export const selectSidebarOpen = (state: RootState): boolean => state.settings.sidebarOpen ?? true;

export default settingsSlice.reducer;
