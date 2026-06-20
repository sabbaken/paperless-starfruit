import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';

export type Theme = 'dark' | 'light' | 'system';

export interface SettingsState {
  theme: Theme;
}

const initialState: SettingsState = {
  theme: 'system',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
  },
});

export const { setTheme } = settingsSlice.actions;

export const selectTheme = (state: RootState): Theme => state.settings.theme;

export default settingsSlice.reducer;
