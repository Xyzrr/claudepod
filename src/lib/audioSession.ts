type AudioSession = {
  type: string;
};

const PLAY_AND_RECORD = "play-and-record";

/**
 * iOS Safari may reset the Audio Session type when getUserMedia starts/stops.
 * Re-applying this is harmless elsewhere and keeps output volume on one route.
 */
export function pinAudioSessionForMicPlayback() {
  const audioSession = (navigator as Navigator & { audioSession?: AudioSession })
    .audioSession;
  if (!audioSession || audioSession.type === PLAY_AND_RECORD) return;

  try {
    audioSession.type = PLAY_AND_RECORD;
  } catch {
    // Unsupported value on this platform: keep the browser default.
  }
}
