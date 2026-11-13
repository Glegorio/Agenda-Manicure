'use client';

import { useEffect } from 'react';

/** Registra o service worker (3.8) só em produção: em dev o cache atrapalharia o hot reload. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
