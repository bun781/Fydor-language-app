"use client";

import { useCallback, useEffect, useMemo } from "react";

export interface SpeechOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
}

export interface SpeechProvider {
  readonly supported: boolean;
  cancel(): void;
  speak(text: string, options: SpeechOptions): void;
}

class BrowserSpeechProvider implements SpeechProvider {
  readonly supported = typeof window !== "undefined" && "speechSynthesis" in window;

  cancel() {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
  }

  speak(text: string, options: SpeechOptions) {
    if (!this.supported) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? "en";
    if (options.pitch !== undefined) utterance.pitch = options.pitch;
    if (options.rate !== undefined) utterance.rate = options.rate;
    if (options.volume !== undefined) utterance.volume = options.volume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

class SilentSpeechProvider implements SpeechProvider {
  readonly supported = false;
  cancel() {}
  speak() {}
}

export class SpeechService {
  constructor(
    private readonly language: string,
    private readonly provider: SpeechProvider = createSpeechProvider()
  ) {}

  get supported() {
    return this.provider.supported;
  }

  cancel() {
    this.provider.cancel();
  }

  speak(text: string, options: Omit<SpeechOptions, "lang"> = {}) {
    this.provider.speak(text, {
      lang: this.language,
      ...options
    });
  }
}

export function createSpeechService(language: string, provider?: SpeechProvider) {
  return new SpeechService(language, provider);
}

export function createSpeechProvider() {
  if (typeof window === "undefined") return new SilentSpeechProvider();
  return new BrowserSpeechProvider();
}

export interface SpeechPlaybackActions {
  speak: () => void;
  speakSlow: () => void;
}

export function createSpeechPlaybackController(actions: SpeechPlaybackActions, delayMs = 180) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  return {
    click() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        actions.speak();
      }, delayMs);
    },
    doubleClick() {
      clearTimer();
      actions.speakSlow();
    },
    cancel() {
      clearTimer();
    }
  };
}

export function useSpeechService(language: string): SpeechService {
  return useMemo(() => createSpeechService(language), [language]);
}

export function useSpeechPlayback(text: string, language: string) {
  const speech = useSpeechService(language);

  const speak = useCallback((rate = 1) => {
    speech.speak(text, { rate });
  }, [speech, text]);

  const playback = useMemo(
    () => createSpeechPlaybackController({
      speak: () => speak(1),
      speakSlow: () => speak(0.8)
    }),
    [speak]
  );

  useEffect(() => () => playback.cancel(), [playback]);

  return {
    supported: speech.supported,
    cancel: speech.cancel.bind(speech),
    speak: () => speak(1),
    speakSlow: () => speak(0.8),
    onClick: playback.click,
    onDoubleClick: playback.doubleClick
  };
}
