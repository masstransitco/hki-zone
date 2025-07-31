import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  setContentType, 
  toggleMenu, 
  setMenuOpen, 
  closeMenu,
  selectContentType,
  selectIsMenuOpen,
  ContentType
} from '@/redux/slices/uiSlice';

export const useUIRedux = () => {
  const dispatch = useDispatch();
  const contentType = useSelector(selectContentType);
  const isMenuOpen = useSelector(selectIsMenuOpen);

  const handleSetContentType = useCallback((type: ContentType) => {
    dispatch(setContentType(type));
  }, [dispatch]);

  const handleToggleMenu = useCallback(() => {
    dispatch(toggleMenu());
  }, [dispatch]);

  const handleSetMenuOpen = useCallback((isOpen: boolean) => {
    dispatch(setMenuOpen(isOpen));
  }, [dispatch]);

  const handleCloseMenu = useCallback(() => {
    dispatch(closeMenu());
  }, [dispatch]);

  return {
    contentType,
    isMenuOpen,
    setContentType: handleSetContentType,
    toggleMenu: handleToggleMenu,
    setMenuOpen: handleSetMenuOpen,
    closeMenu: handleCloseMenu,
  };
};