import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_ENABLED_KEY = "3color-sound-enabled";
const MASTER_VOLUME = 3;
const MAX_VOLUME = 0.18;

function getSavedSoundEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  const savedValue = window.localStorage.getItem(SOUND_ENABLED_KEY);

  if (savedValue === null) {
    return true;
  }

  return savedValue === "true";
}

export function useSoundEffects() {
  const audioContextRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(getSavedSoundEnabled);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    ({
      frequency,
      duration = 0.08,
      type = "sine",
      volume = 0.05,
      startOffset = 0,
    }) => {
      const audioContext = getAudioContext();

      if (!audioContext) {
        return;
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      const startTime = audioContext.currentTime + startOffset;
      const endTime = startTime + duration;
      const effectiveVolume = Math.min(volume * MASTER_VOLUME, MAX_VOLUME);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(effectiveVolume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    },
    [getAudioContext]
  );

  const playSound = useCallback(
    (soundName, options = {}) => {
      const shouldForcePlay = options.force === true;

      if (!soundEnabled && !shouldForcePlay) {
        return;
      }

      if (soundName === "vertex") {
        playTone({
          frequency: 440,
          duration: 0.07,
          volume: 0.04,
        });
        return;
      }

      if (soundName === "button") {
        playTone({
          frequency: 360,
          duration: 0.06,
          volume: 0.04,
        });
        return;
      }

      if (soundName === "conflict") {
        playTone({
          frequency: 220,
          duration: 0.08,
          type: "triangle",
          volume: 0.04,
        });

        playTone({
          frequency: 180,
          duration: 0.08,
          type: "triangle",
          volume: 0.04,
          startOffset: 0.06,
        });

        return;
      }

      if (soundName === "reset") {
        playTone({
          frequency: 330,
          duration: 0.08,
          volume: 0.04,
        });

        playTone({
          frequency: 260,
          duration: 0.08,
          volume: 0.04,
          startOffset: 0.07,
        });

        return;
      }

      if (soundName === "level") {
        playTone({
          frequency: 440,
          duration: 0.07,
          volume: 0.04,
        });

        playTone({
          frequency: 554,
          duration: 0.08,
          volume: 0.04,
          startOffset: 0.07,
        });

        return;
      }

      if (soundName === "complete") {
        playTone({
          frequency: 523,
          duration: 0.09,
          volume: 0.04,
        });

        playTone({
          frequency: 659,
          duration: 0.09,
          volume: 0.04,
          startOffset: 0.08,
        });

        playTone({
          frequency: 784,
          duration: 0.12,
          volume: 0.04,
          startOffset: 0.16,
        });
      }
    },
    [playTone, soundEnabled]
  );

  return {
    soundEnabled,
    setSoundEnabled,
    playSound,
  };
}