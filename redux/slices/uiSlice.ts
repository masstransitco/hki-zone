import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ContentType = 'headlines' | 'news' | 'bulletin';

interface UIState {
  contentType: ContentType;
  isMenuOpen: boolean;
  lastContentTypeChange: number | null;
}

const initialState: UIState = {
  contentType: 'headlines',
  isMenuOpen: false,
  lastContentTypeChange: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setContentType: (state, action: PayloadAction<ContentType>) => {
      state.contentType = action.payload;
      state.lastContentTypeChange = Date.now();
    },
    toggleMenu: (state) => {
      state.isMenuOpen = !state.isMenuOpen;
    },
    setMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isMenuOpen = action.payload;
    },
    closeMenu: (state) => {
      state.isMenuOpen = false;
    },
  },
});

export const { setContentType, toggleMenu, setMenuOpen, closeMenu } = uiSlice.actions;
export default uiSlice.reducer;

// Selectors
export const selectContentType = (state: { ui: UIState }) => state.ui.contentType;
export const selectIsMenuOpen = (state: { ui: UIState }) => state.ui.isMenuOpen;
export const selectLastContentTypeChange = (state: { ui: UIState }) => state.ui.lastContentTypeChange;