'use client';

import { useRef, useState, useCallback } from 'react';

const PREF_KEY = 'runtrack_audio_cues';

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 1.1;
  utterance.volume = 1.0;

  // Use fr-FR voice if available, otherwise first available
  const voices = speechSynthesis.getVoices();
  const frVoice = voices.find((v) => v.lang.startsWith('fr'));
  if (frVoice) utterance.voice = frVoice;

  speechSynthesis.speak(utterance);
}

export function useAudioCues() {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PREF_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const isEnabledRef = useRef(isEnabled);
  const lastAnnouncedKmRef = useRef(0);

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      isEnabledRef.current = next;
      try { localStorage.setItem(PREF_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  /** Call this inside the start button handler (user gesture) to warm up iOS Speech API */
  const warmUp = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance('');
    speechSynthesis.speak(u);
  }, []);

  /** Call on every distance update during tracking */
  const checkDistance = useCallback((distanceMeters: number) => {
    if (!isEnabledRef.current) return;
    const km = Math.floor(distanceMeters / 1000);
    if (km > 0 && km > lastAnnouncedKmRef.current) {
      lastAnnouncedKmRef.current = km;
      const s = km > 1 ? 's' : '';
      speak(`${km} kilomètre${s} parcouru${s}`);
    }
  }, []);

  /** Reset on new run start */
  const reset = useCallback(() => {
    lastAnnouncedKmRef.current = 0;
  }, []);

  return { isEnabled, toggleEnabled, warmUp, checkDistance, reset };
}
