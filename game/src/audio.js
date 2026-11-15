// Synthesised sound for LUMEN KEEP (WebAudio only, no audio files).
//
// Every sound is a short oscillator + gain envelope built on the fly, so
// the game loads nothing over the network. The context is created lazily
// on the first user gesture; until then every call is a silent no-op.
// In headless screenshot runs the context is never created at all.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    enabled: true,
  };

  // Call from a user gesture (click / key) to unlock sound in the browser.
  audio.ensure = function ensure() {
    if (audio.ctx || !audio.enabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.22;
      audio.master.connect(audio.ctx.destination);
    } catch (err) {
      audio.enabled = false;
    }
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.22;
    return audio.muted;
  };

  // One tone: frequency slide from f0 to f1 over `dur` seconds.
  function tone(f0, f1, dur, type, vol, when) {
    if (!audio.ctx || audio.muted || !audio.enabled) return;
    try {
      const t0 = audio.ctx.currentTime + (when || 0);
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(1, f0), t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      gain.gain.setValueAtTime(vol || 0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) {
      // Sound must never break the game.
    }
  }

  // A short burst of filtered noise, for shatters and impacts.
  function noise(dur, vol, freq) {
    if (!audio.ctx || audio.muted || !audio.enabled) return;
    try {
      const t0 = audio.ctx.currentTime;
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 1800;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.4, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start(t0);
    } catch (err) {
      // Sound must never break the game.
    }
  }

  audio.shot = function shot() {
    tone(880, 320, 0.09, 'square', 0.16);
  };
  audio.hit = function hit() {
    tone(220, 140, 0.06, 'triangle', 0.25);
  };
  audio.shatter = function shatter() {
    noise(0.18, 0.5, 2400);
    tone(520, 90, 0.16, 'sawtooth', 0.2);
  };
  audio.pickup = function pickup() {
    tone(660, 990, 0.08, 'sine', 0.3);
    tone(990, 1320, 0.1, 'sine', 0.22, 0.06);
  };
  audio.hurt = function hurt() {
    tone(160, 60, 0.25, 'sawtooth', 0.4);
    noise(0.12, 0.3, 700);
  };
  audio.beaconHit = function beaconHit() {
    tone(120, 70, 0.2, 'sawtooth', 0.35);
  };
  audio.alarm = function alarm() {
    tone(520, 520, 0.14, 'square', 0.18);
    tone(392, 392, 0.14, 'square', 0.18, 0.16);
  };
  audio.horn = function horn() {
    tone(196, 196, 0.35, 'sawtooth', 0.3);
    tone(294, 294, 0.35, 'sawtooth', 0.22, 0.05);
    tone(392, 392, 0.4, 'sawtooth', 0.2, 0.1);
  };
  audio.dash = function dash() {
    noise(0.12, 0.25, 3200);
  };
  audio.win = function win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => tone(n, n, 0.22, 'triangle', 0.3, i * 0.12));
  };
  audio.lose = function lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => tone(n, n * 0.94, 0.3, 'sawtooth', 0.22, i * 0.16));
  };

  return audio;
}
