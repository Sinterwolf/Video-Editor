import { createContext, useContext, type RefObject } from 'react';

export const AudioElementContext = createContext<RefObject<HTMLAudioElement | null> | null>(null);

export function useAudioElementRef(): RefObject<HTMLAudioElement | null> {
  const ctx = useContext(AudioElementContext);
  if (!ctx) throw new Error('useAudioElementRef must be used within AudioElementContext.Provider');
  return ctx;
}
