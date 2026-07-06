import { createContext, useContext, type RefObject } from 'react';

export const MediaElementContext = createContext<RefObject<HTMLVideoElement | null> | null>(null);

export function useMediaElementRef(): RefObject<HTMLVideoElement | null> {
  const ctx = useContext(MediaElementContext);
  if (!ctx) throw new Error('useMediaElementRef must be used within MediaElementContext.Provider');
  return ctx;
}
