// audio.js — procedural music + SFX for La Era de los Titanes (Web Audio API, no assets).
// Unlock on first user gesture (login click). Mute persists in localStorage.
(function (global) {
  "use strict";

  const LS_MUTE = "aot_mute";
  const LS_VOL = "aot_vol";
  const LS_MVOL = "aot_mvol";
  const LS_SVOL = "aot_svol";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Scales (relative intervals). Modes for variety.
  const AEOLIAN   = [1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5];
  const DORIAN    = [1, 9/8, 6/5, 4/3, 3/2, 5/3, 9/5];
  const MIXOLYD   = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9];
  const LYDIAN    = [1, 9/8, 5/4, 45/32, 3/2, 5/3, 15/8];
  const PHRYGIAN  = [1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5];
  const IONIAN    = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8];
  const PENTA_MIN = [1, 6/5, 4/3, 3/2, 9/5, 2, 12/5];
  const SONG_BARS = 32;

  // 20 songs — distinct root / mode / tempo / motif / texture. Auto-rotates.
  // Tuned to "scientific pitch" (C4 = 256 Hz, so C5 = 512 Hz) instead of the
  // usual A440 concert pitch — every root below is the equal-tempered A440
  // note frequency scaled by 256/261.6256; scale ratios are untouched.
  const SONGS = [
    { name: "Amanecer en Helike", beat: 0.58, root: 143.67, scale: AEOLIAN, fifth: 1.5,
      pad: 0.034, pluck: 0.045, sparkle: 0.012, perc: 0.01, percOff: true,
      motif: [0,2,4,2, 3,5,4,0, 4,2,5,4, 3,2,0,4], bars: 32, filter: 880 },
    { name: "Los Olivares", beat: 0.50, root: 161.27, scale: DORIAN, fifth: 1.5,
      pad: 0.028, pluck: 0.05, sparkle: 0.016, perc: 0.012, percOff: true,
      motif: [0,4,2,5, 4,7,5,4, 2,0,4,2, 5,4,2,0], bars: 28, filter: 1000, padType: "triangle" },
    { name: "Ruinas de Argos", beat: 0.64, root: 128.00, scale: PHRYGIAN, fifth: 1.5,
      pad: 0.04, pluck: 0.038, sparkle: 0.008, perc: 0.008,
      motif: [0,1,3,1, 4,3,1,0, 5,4,3,1, 0,3,1,4], bars: 36, filter: 720, shimmer: 0.012, shimmerDeg: 3 },
    { name: "Hondonada de la Gorgona", beat: 0.46, root: 107.63, scale: AEOLIAN, fifth: 1.498,
      pad: 0.036, pluck: 0.042, sparkle: 0.01, perc: 0.014, percOff: true,
      motif: [0,3,5,7, 5,3,0,2, 4,7,5,3, 2,0,3,5], bars: 32, filter: 650, pluckType: "sine" },
    // Reworked — was a plain scale-run hymn; now slower, sparser, with an
    // octave leap and rests so it reads as solemn rather than sing-song.
    { name: "Himno de la Fuente", beat: 0.78, root: 170.86, scale: IONIAN, fifth: 1.5,
      pad: 0.034, pluck: 0.032, sparkle: 0.014, perc: 0.0,
      motif: [0,-1,7,4, 9,-1,7,5, 2,-1,9,7, 5,4,-1,0], bars: 32, filter: 1000, shimmer: 0.012, shimmerDeg: 4 },
    { name: "Vigilia Nocturna", beat: 0.62, root: 120.82, scale: DORIAN, fifth: 1.5,
      pad: 0.038, pluck: 0.036, sparkle: 0.01, perc: 0.007,
      motif: [4,2,0,2, 5,4,2,0, 7,5,4,2, 0,2,4,5], bars: 32, filter: 820, pluckType: "sine" },
    // Reworked — was a bouncy pentatonic chase riff; now syncopated with
    // rests and wide leaps for a predatory, uneven stalking feel.
    { name: "Cacería de Artemisa", beat: 0.34, root: 191.79, scale: PENTA_MIN, fifth: 1.5,
      pad: 0.02, pluck: 0.05, sparkle: 0.014, perc: 0.02, percOff: true,
      motif: [0,-1,7,4, -1,9,4,-1, 7,2,-1,9, 4,-1,2,7], bars: 24, filter: 1200, pluckType: "sawtooth" },
    // Reworked — was a bright arpeggio shrine tune; now slower with a
    // droning fifth and sparse, unevenly-spaced tones for a mystic feel.
    { name: "Luz de Asclepio", beat: 0.9, root: 152.22, scale: LYDIAN, fifth: 1.5,
      pad: 0.038, pluck: 0.03, sparkle: 0.018, perc: 0.0,
      motif: [0,-1,-1,4, -1,7,-1,-1, 5,-1,9,-1, -1,4,-1,-1], bars: 32, filter: 1050, shimmer: 0.018, shimmerDeg: 3 },
    { name: "Brisa del Puerto", beat: 0.54, root: 135.61, scale: MIXOLYD, fifth: 1.498,
      pad: 0.03, pluck: 0.048, sparkle: 0.014, perc: 0.011, percOff: true,
      motif: [0,4,5,4, 2,0,2,4, 7,5,4,2, 0,2,4,0], bars: 28, filter: 980 },
    { name: "Eco del Titán", beat: 0.48, root: 85.43, scale: PHRYGIAN, fifth: 1.5,
      pad: 0.042, pluck: 0.04, sparkle: 0.006, perc: 0.015,
      motif: [0,1,0,4, 3,1,0,5, 4,3,1,0, 4,5,3,0], bars: 32, filter: 600, padType: "triangle" },
    // Reworked — was a lullaby-plain rest theme; now leans on a sustained
    // pad and a sparse, wide-interval motif instead of a walked scale.
    { name: "Descanso del Héroe", beat: 0.85, root: 181.02, scale: IONIAN, fifth: 1.5,
      pad: 0.04, pluck: 0.026, sparkle: 0.01, perc: 0.0,
      motif: [0,-1,-1,5, -1,-1,4,-1, -1,7,-1,-1, 2,-1,0,-1], bars: 36, filter: 900, shimmer: 0.013, shimmerDeg: 2 },
    { name: "Sombra de Circe", beat: 0.56, root: 114.03, scale: PHRYGIAN, fifth: 1.5,
      pad: 0.038, pluck: 0.044, sparkle: 0.01, perc: 0.009, padType: "triangle",
      motif: [0,3,1,-1, 4,3,5,1, 0,-1,4,3, 1,5,3,0], bars: 32, filter: 700, pluckType: "sawtooth" },
    { name: "Forja de Hefesto", beat: 0.4, root: 90.51, scale: MIXOLYD, fifth: 1.5,
      pad: 0.026, pluck: 0.058, sparkle: 0.0, perc: 0.022, percOff: true,
      motif: [0,4,0,4, 3,-1,3,-1, 5,4,2,0, 4,-1,0,-1], bars: 28, filter: 680 },
    { name: "Lamento de las Nereidas", beat: 0.72, root: 128.00, scale: AEOLIAN, fifth: 1.5,
      pad: 0.04, pluck: 0.03, sparkle: 0.016, perc: 0.0, pluckType: "sine",
      motif: [0,-1,3,5, -1,7,5,3, -1,2,0,-1, 3,5,3,0], bars: 36, filter: 760, shimmer: 0.014, shimmerDeg: 3 },
    { name: "Trueno de Zeus", beat: 0.36, root: 80.64, scale: MIXOLYD, fifth: 1.5,
      pad: 0.03, pluck: 0.05, sparkle: 0.0, perc: 0.024, percOff: true,
      motif: [0,7,4,7, 5,-1,5,7, 3,7,2,7, 0,-1,0,7], bars: 28, filter: 620 },
    { name: "Umbral del Inframundo", beat: 0.6, root: 71.84, scale: PHRYGIAN, fifth: 1.498,
      pad: 0.044, pluck: 0.032, sparkle: 0.004, perc: 0.012, padType: "triangle",
      motif: [0,-1,1,-1, 4,-1,3,-1, 0,1,0,-1, 5,4,1,0], bars: 32, filter: 520 },
    { name: "Coro de las Musas", beat: 0.66, root: 161.27, scale: LYDIAN, fifth: 1.5,
      pad: 0.032, pluck: 0.036, sparkle: 0.02, perc: 0.006, padType: "triangle",
      motif: [0,4,7,9, 7,4,-1,5, 9,7,4,2, -1,0,4,-1], bars: 32, filter: 1150, shimmer: 0.016, shimmerDeg: 4 },
    // New — E minor (Aeolian) family alongside "Sombra de Circe" (E Phrygian):
    // same modal neighborhood, distinct scale/register/texture so it reads
    // as kin, not a reskin.
    { name: "Manantial de Mnemósine", beat: 0.74, root: 161.27, scale: AEOLIAN, fifth: 1.5,
      pad: 0.036, pluck: 0.028, sparkle: 0.016, perc: 0.0, pluckType: "sine",
      motif: [0,-1,2,4, -1,5,4,2, -1,0,2,5, 4,2,-1,0], bars: 36, filter: 860, shimmer: 0.015, shimmerDeg: 3 },
    { name: "Susurro de las Náyades", beat: 0.82, root: 80.64, scale: AEOLIAN, fifth: 1.5,
      pad: 0.044, pluck: 0.022, sparkle: 0.01, perc: 0.0, padType: "triangle",
      motif: [0,-1,-1,3, -1,-1,2,-1, -1,4,-1,-1, 0,-1,-1,-1], bars: 32, filter: 560, shimmer: 0.01, shimmerDeg: 2 },
    { name: "Vela de los Dioscuros", beat: 0.6, root: 241.63, scale: AEOLIAN, fifth: 1.5,
      pad: 0.024, pluck: 0.034, sparkle: 0.02, perc: 0.006,
      motif: [0,2,0,4, 3,2,0,5, 4,3,2,0, 5,4,2,0], bars: 32, filter: 1300, shimmer: 0.018, shimmerDeg: 4 },
  ];

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.muted = localStorage.getItem(LS_MUTE) === "1";
      this.vol = clamp(Number(localStorage.getItem(LS_VOL) ?? "0.7"), 0, 1);
      this.musicVol = clamp(Number(localStorage.getItem(LS_MVOL) ?? "1"), 0, 1);
      this.sfxVol = clamp(Number(localStorage.getItem(LS_SVOL) ?? "1"), 0, 1);
      this.unlocked = false;
      this.musicOn = false;
      this._musicTimer = null;
      this._beat = 0;
      this._songIdx = 0;
      this._songBars = 0;
      this._busy = Object.create(null);
    }

    async unlock() {
      if (this.unlocked && this.ctx && this.ctx.state !== "closed") {
        if (this.ctx.state === "suspended") await this.ctx.resume();
        return;
      }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      // Limiter on the master bus: lets us run music/sfx ~50% hotter (below)
      // without the extra headroom clipping when many voices stack at once.
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-6, this.ctx.currentTime);
      this.limiter.knee.setValueAtTime(12, this.ctx.currentTime);
      this.limiter.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this._applyGains();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.unlocked = true;
      if (!this.muted) this.startMusic();
      this._updateMuteBtn();
    }

    _applyGains() {
      if (!this.master) return;
      const m = this.muted ? 0 : this.vol;
      this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.02);
      // ~50% louder default output than the original mix; the limiter above
      // keeps dense passages from clipping at this level.
      this.musicGain.gain.setTargetAtTime(0.42 * this.musicVol, this.ctx.currentTime, 0.02);
      this.sfxGain.gain.setTargetAtTime(1.275 * this.sfxVol, this.ctx.currentTime, 0.02);
    }

    setMuted(m) {
      this.muted = m;
      localStorage.setItem(LS_MUTE, this.muted ? "1" : "0");
      this._applyGains();
      if (this.muted) this.stopMusic();
      else if (this.unlocked) this.startMusic();
      this._updateMuteBtn();
      this._updateSongLabel();
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    setVolume(v) {
      this.vol = clamp(v, 0, 1);
      localStorage.setItem(LS_VOL, String(this.vol));
      this._applyGains();
    }

    setMusicVolume(v) {
      this.musicVol = clamp(v, 0, 1);
      localStorage.setItem(LS_MVOL, String(this.musicVol));
      this._applyGains();
    }

    setSfxVolume(v) {
      this.sfxVol = clamp(v, 0, 1);
      localStorage.setItem(LS_SVOL, String(this.sfxVol));
      this._applyGains();
    }

    _updateMuteBtn() {
      const btn = document.getElementById("muteBtn");
      if (!btn) return;
      const tr = typeof global.t === "function" ? global.t : null;
      btn.textContent = this.muted ? "🔇" : "🔊";
      btn.title = tr ? (this.muted ? tr("audio.unmute") : tr("audio.mute")) : (this.muted ? "Activar sonido" : "Silenciar");
      btn.setAttribute("aria-pressed", this.muted ? "true" : "false");
    }

    _updateSongLabel() {
      const el = document.getElementById("songLabel");
      if (!el) return;
      if (this.muted || !this.musicOn) {
        el.classList.remove("show");
        return;
      }
      const song = SONGS[this._songIdx % SONGS.length];
      el.textContent = "♪ " + song.name;
      el.classList.add("show");
    }

    _env(g, t0, a, d, s, r, peak = 1) {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
    }

    _tone(freq, dur, type, peak, dest, t0) {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      this._env(g, t0, 0.01, dur * 0.25, 0.45, dur * 0.7, peak);
      o.connect(g); g.connect(dest);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }

    _noise(dur, peak, dest, t0, hp = 400, lp = 4000) {
      if (!this.ctx || this.muted) return;
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      const f1 = this.ctx.createBiquadFilter();
      f1.type = "highpass"; f1.frequency.value = hp;
      const f2 = this.ctx.createBiquadFilter();
      f2.type = "lowpass"; f2.frequency.value = lp;
      this._env(g, t0, 0.005, dur * 0.2, 0.3, dur * 0.75, peak);
      src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(dest);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    _rate(key, ms) {
      const t = performance.now();
      if ((this._busy[key] || 0) > t) return false;
      this._busy[key] = t + ms;
      return true;
    }

    // ---- music: 17 distinct procedural songs, auto-rotate ----
    startMusic() {
      if (!this.ctx || this.muted || this.musicOn) return;
      this.musicOn = true;
      this._beat = 0;
      this._songBars = 0;
      this._songIdx = Math.floor(Math.random() * SONGS.length);
      this._updateSongLabel();
      this._scheduleMusic();
    }

    stopMusic() {
      this.musicOn = false;
      if (this._musicTimer) {
        clearTimeout(this._musicTimer);
        this._musicTimer = null;
      }
      this._updateSongLabel();
    }

    _nextSong() {
      let n = this._songIdx;
      if (SONGS.length > 1) {
        while (n === this._songIdx) n = Math.floor(Math.random() * SONGS.length);
      }
      this._songIdx = n;
      this._beat = 0;
      this._songBars = 0;
      this._updateSongLabel();
    }

    _scheduleMusic() {
      if (!this.musicOn || !this.ctx || this.muted) return;
      const song = SONGS[this._songIdx % SONGS.length];
      const t0 = this.ctx.currentTime + 0.03;
      const beat = song.beat;
      const root = song.root;
      const scale = song.scale;
      const bars = 4;
      const beats = bars * 4;
      const dur = beat * beats;

      this._pad(root, dur, song.pad * 0.9, t0, song.padType || "sine", song.filter || 900);
      this._pad(root * song.fifth, dur, song.pad * 0.45, t0, song.padType2 || "triangle", song.filter || 900);
      if (song.shimmer) {
        this._pad(root * 2 * scale[song.shimmerDeg || 4], dur, song.shimmer, t0, "sine", (song.filter || 900) * 1.4);
      }

      const motif = song.motif;
      for (let i = 0; i < beats; i++) {
        const deg = motif[(this._beat + i) % motif.length];
        if (deg < 0) continue;
        const octave = deg >= 7 ? 2 : 1;
        const f = root * 2 * scale[deg % 7] * octave;
        const when = t0 + i * beat;
        this._pluck(f, song.pluck, when, song.pluckType || "triangle");
        if (i % 4 === 0) this._pluck(root * scale[0], song.pluck * 0.65, when, "sine");
        if (song.sparkle && i % 8 === 4) {
          this._pluck(root * 4 * scale[(deg + 2) % 7], song.sparkle, when + beat * 0.5, "sine");
        }
      }

      if (song.perc) {
        for (let i = 0; i < beats; i += 4) {
          this._tick(song.perc, t0 + i * beat);
          if (song.percOff) this._tick(song.perc * 0.55, t0 + (i + 2) * beat);
        }
      }

      this._beat = (this._beat + beats) % motif.length;
      this._songBars = (this._songBars || 0) + bars;
      if (this._songBars >= (song.bars || SONG_BARS)) this._nextSong();
      this._musicTimer = setTimeout(() => this._scheduleMusic(), Math.max(200, dur * 1000 - 50));
    }

    _pad(freq, dur, peak, t0, type = "sine", filterHz = 900) {
      if (!this.ctx || this.muted || peak <= 0) return;
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o1.type = type; o2.type = type === "sine" ? "triangle" : "sine";
      o1.frequency.setValueAtTime(freq, t0);
      o2.frequency.setValueAtTime(freq * 1.004, t0);
      f.type = "lowpass"; f.frequency.setValueAtTime(filterHz, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.min(1.4, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.7), t0 + dur * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
    }

    _pluck(freq, peak, t0, type = "triangle") {
      if (!this.ctx || this.muted || peak <= 0) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.985), t0 + 0.35);
      this._env(g, t0, 0.004, 0.08, 0.25, 0.45, peak);
      o.connect(g); g.connect(this.musicGain);
      o.start(t0); o.stop(t0 + 0.55);
    }

    _tick(peak, t0) {
      if (!this.ctx || this.muted || peak <= 0) return;
      this._noise(0.04, peak, this.musicGain, t0, 600, 2800);
    }

// ---- SFX API ----

    sfx(name, opt) {
      if (!this.unlocked || !this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + 0.001;
      const dest = this.sfxGain;
      switch (name) {
        case "slash":
          if (!this._rate("slash", 70)) return;
          this._noise(0.12, 0.35, dest, t0, 800, 6000);
          this._tone(215.27, 0.08, "sawtooth", 0.08, dest, t0);
          break;
        case "arrow":
          if (!this._rate("arrow", 60)) return;
          this._tone(861.08, 0.12, "triangle", 0.12, dest, t0);
          this._tone(1291.62, 0.08, "sine", 0.06, dest, t0 + 0.02);
          this._noise(0.06, 0.12, dest, t0, 2000, 8000);
          break;
        case "fire":
          if (!this._rate("fire", 60)) return;
          this._noise(0.18, 0.28, dest, t0, 200, 1800);
          this._tone(180, 0.15, "sawtooth", 0.07, dest, t0);
          break;
        case "holy":
          if (!this._rate("holy", 80)) return;
          this._tone(512.00, 0.18, "sine", 0.12, dest, t0);
          this._tone(645.07, 0.2, "sine", 0.1, dest, t0 + 0.05);
          this._tone(766.93, 0.25, "triangle", 0.08, dest, t0 + 0.1);
          break;
        case "aoe":
          if (!this._rate("aoe", 90)) return;
          this._noise(0.25, 0.3, dest, t0, 120, 2500);
          this._tone(107.63, 0.22, "square", 0.06, dest, t0);
          break;
        case "heal":
          if (!this._rate("heal", 120)) return;
          this._tone(383.57, 0.15, "sine", 0.1, dest, t0);
          this._tone(512.00, 0.2, "sine", 0.1, dest, t0 + 0.08);
          this._tone(645.07, 0.28, "triangle", 0.09, dest, t0 + 0.16);
          break;
        case "level":
          this._tone(383.57, 0.18, "triangle", 0.14, dest, t0);
          this._tone(512.00, 0.18, "triangle", 0.14, dest, t0 + 0.14);
          this._tone(645.07, 0.18, "triangle", 0.14, dest, t0 + 0.28);
          this._tone(766.93, 0.4, "sine", 0.16, dest, t0 + 0.42);
          break;
        case "hit": {
          const onMe = opt && opt.onMe;
          if (!this._rate(onMe ? "hitme" : "hit", 50)) return;
          this._noise(0.08, onMe ? 0.28 : 0.18, dest, t0, 300, 3000);
          this._tone(onMe ? 140 : 200, 0.07, "square", onMe ? 0.1 : 0.06, dest, t0);
          break;
        }
        case "crit":
          if (!this._rate("crit", 80)) return;
          this._tone(300, 0.08, "sawtooth", 0.1, dest, t0);
          this._tone(450, 0.1, "sawtooth", 0.1, dest, t0 + 0.05);
          this._noise(0.1, 0.25, dest, t0, 500, 5000);
          break;
        case "dead":
          this._tone(215.27, 0.35, "sawtooth", 0.12, dest, t0);
          this._tone(143.64, 0.45, "sawtooth", 0.1, dest, t0 + 0.15);
          this._tone(95.89, 0.7, "triangle", 0.1, dest, t0 + 0.35);
          break;
        case "ui":
          if (!this._rate("ui", 40)) return;
          this._tone(645.81, 0.05, "sine", 0.05, dest, t0);
          break;
        case "chat":
          if (!this._rate("chat", 200)) return;
          this._tone(724.09, 0.05, "sine", 0.04, dest, t0);
          this._tone(968.71, 0.06, "sine", 0.035, dest, t0 + 0.05);
          break;
        case "invite":
          this._tone(512.00, 0.1, "triangle", 0.1, dest, t0);
          this._tone(645.07, 0.14, "triangle", 0.1, dest, t0 + 0.1);
          break;
        case "pickup":
          if (!this._rate("pickup", 80)) return;
          this._tone(861.08, 0.06, "sine", 0.08, dest, t0);
          this._tone(1148.76, 0.1, "sine", 0.07, dest, t0 + 0.05);
          break;
        case "login":
          this._tone(322.54, 0.15, "triangle", 0.1, dest, t0);
          this._tone(483.26, 0.2, "triangle", 0.1, dest, t0 + 0.12);
          this._tone(645.07, 0.35, "sine", 0.12, dest, t0 + 0.26);
          break;
        default:
          break;
      }
    }

    onFx(m) {
      if (!m || !m.k) return;
      if (m.k === "slash") return this.sfx("slash");
      if (m.k === "proj") {
        if (m.style === "arrow") return this.sfx("arrow");
        if (m.style === "fire" || m.style === "holy") return this.sfx(m.style === "holy" ? "holy" : "fire");
        return this.sfx("arrow");
      }
      if (m.k === "aoe") {
        if (m.style === "holy" || m.style === "judgment") return this.sfx("holy");
        if (m.style === "nova") return this.sfx("holy");
        if (m.style === "titan") return this.sfx("aoe");
        return this.sfx("aoe");
      }
      if (m.k === "heal") return this.sfx("heal");
      if (m.k === "level") return this.sfx("level");
      if (m.k === "recall") return this.sfx("holy");
    }
  }

  const audio = new AudioEngine();
  global.AOTAudio = audio;

  // Unlock on first meaningful gesture anywhere.
  function armUnlock() {
    const go = () => { audio.unlock().catch(() => {}); };
    ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
      document.addEventListener(ev, go, { once: true, capture: true }));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", armUnlock);
  else armUnlock();
})(typeof window !== "undefined" ? window : globalThis);
