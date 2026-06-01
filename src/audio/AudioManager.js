/**
 * AudioManager — Web Audio API music and SFX
 * Uses procedural synthesis for ambient music layers.
 */
import { debug } from '../utils/debug.js';
import { getSiteBaseHref } from '../utils/siteBase.js';

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._currentTrack = null;
    this._nodes = [];
    this._trackGain = null;
    this.masterVolume = 0.8;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    // M76: hard mute toggles independent of volume sliders. When muted,
    // music elements are paused outright (not just volume=0) so iOS Safari
    // doesn't report a media session as active, and external audio (e.g.
    // the user's own Spotify) plays through cleanly.
    try {
      this._musicMuted = localStorage.getItem('emberveil_music_muted') === '1';
      this._sfxMuted   = localStorage.getItem('emberveil_sfx_muted')   === '1';
    } catch (_) {
      this._musicMuted = false;
      this._sfxMuted = false;
    }
    this._started = false;
    this._unlocked = false;
    this._pendingMusic = null;
    this._musicEl = null;
    // M69: separate handles for overworld vs combat tracks so combat can
    // pause/resume the overworld music without trampling state.
    this._overworldEl = null;
    this._overworldKey = null; // e.g. 'overworld_act3'
    this._overworldPausedAt = 0;
    this._overworldPausedKey = null;
    this._combatEl = null;
    // Track every active music HTMLAudioElement so volume changes apply
    // uniformly. Fixes the M65 bug where setMusicVolume only affected
    // the most recently created element.
    this._allMusicEls = new Set();
    this._sfxMissing = new Set();
  }

  // M69: helper — track a music element for volume management.
  _registerMusicEl(el) {
    if (!el) return;
    this._allMusicEls.add(el);
    try { el.volume = this._musicMuted ? 0 : this.musicVolume * this.masterVolume; } catch (_) {}
    if (this._musicMuted) {
      try { el.pause(); } catch (_) {}
    }
  }
  _unregisterMusicEl(el) {
    if (!el) return;
    this._allMusicEls.delete(el);
  }

  _baseUrl() {
    return getSiteBaseHref();
  }

  _tryPlayMusicFile(name) {
    debug.audio('_tryPlayMusicFile', name);
    try {
      const url = this._baseUrl() + 'music/' + name + '.ogg';
      const el = new Audio(url);
      el.loop = true;
      el.volume = this.musicVolume * this.masterVolume;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* autoplay may reject; fallback handled on error */ });
      }
      el.addEventListener('error', () => {
        if (this._musicEl === el) {
          this._musicEl = null;
        }
        this._unregisterMusicEl(el);
      }, { once: true });
      this._musicEl = el;
      this._registerMusicEl(el);
      return true;
    } catch (_) {
      return false;
    }
  }

  _ensureContext() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this.masterVolume;
    this._masterGain.connect(this._ctx.destination);
    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = this.musicVolume;
    this._musicGain.connect(this._masterGain);
    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this.sfxVolume;
    this._sfxGain.connect(this._masterGain);
  }

  resume() {
    this._ensureContext();
    // Only call ctx.resume() once unlocked by a user gesture. Calling it
    // earlier throws the Chrome/Safari autoplay warning.
    if (this._unlocked && this._ctx.state === 'suspended') {
      try { this._ctx.resume(); } catch (_) {}
    }
    this._started = true;
  }

  // M72: unlock audio after a user gesture. Resumes the AudioContext and
  // plays a silent buffer to fully unlock iOS Safari. Idempotent.
  unlock() {
    if (this._unlocked) return;
    try {
      this._ensureContext();
      const ctx = this._ctx;
      if (ctx.state === 'suspended') {
        try { ctx.resume(); } catch (_) {}
      }
      // Silent buffer trick for iOS Safari.
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        if (src.start) src.start(0); else src.noteOn(0);
      } catch (_) {}
      this._unlocked = true;
      // Flush any queued music request.
      if (this._pendingMusic) {
        const pending = this._pendingMusic;
        this._pendingMusic = null;
        try {
          if (pending.kind === 'title') this.playTitleMusic();
          else if (pending.kind === 'intro') this.playIntroMusic();
          else if (pending.kind === 'overworld') this.playOverworldMusic(pending.act, pending.zoneId);
          else if (pending.kind === 'town') this.playTownMusic(pending.act);
          else if (pending.kind === 'combat') this.playCombatMusic(pending.zoneId, pending.opts || {});
        } catch (_) {}
      }
    } catch (_) {}
  }

  queuePendingMusic(kind, data = {}) {
    this._pendingMusic = { kind, ...data };
  }

  _newTrackGain() {
    if (!this._ctx) return;
    this._trackGain = this._ctx.createGain();
    this._trackGain.gain.value = 1;
    this._trackGain.connect(this._musicGain);
  }

  playIntroMusic() {
    if (this._musicMuted) return;
    if (!this._unlocked) { this.queuePendingMusic('intro'); return; }
    this.resume();
    this._stopCurrentTrack();
    this._tryPlayMusicFile('intro_theme');
  }

  playTitleMusic() {
    if (this._musicMuted) return;
    if (!this._unlocked) { this.queuePendingMusic('title'); return; }
    this.resume();
    this._stopCurrentTrack();
    if (this._tryPlayMusicFile('title_theme')) return;
    this._newTrackGain();
    this._currentTrack = this._buildAmbientLayer([
      { freq: 55, type: 'sine', gain: 0.08, detune: 0 },
      { freq: 82.5, type: 'sine', gain: 0.05, detune: 5 },
      { freq: 110, type: 'sine', gain: 0.04, detune: -3 },
    ]);
    this._addPad([220, 277.2, 329.6, 440], 0.03);
  }

  // M69: derive an act number (1-6) from a zone id by checking mapData.
  // Lazy-imported via dynamic require pattern not available in browser ESM,
  // so callers should pass the act explicitly. This helper falls back to 1.
  actForZone(zoneId) {
    try {
      // Cached on first lookup.
      if (!AudioManager._zoneActMap) AudioManager._zoneActMap = {};
      const cached = AudioManager._zoneActMap[zoneId];
      if (cached) return cached;
    } catch (_) {}
    return 1;
  }

  // M69: overworld (calm exploration) music — one track per act.
  playOverworldMusic(actNum, zoneId) {
    debug.audio('playOverworldMusic', { actNum, zoneId });
    if (this._musicMuted) return;
    if (!this._unlocked) { this.queuePendingMusic('overworld', { act: actNum, zoneId }); return; }
    this.resume();
    const act = Math.max(1, Math.min(6, actNum || 1));
    const key = `overworld_act${act}`;
    // If the same overworld track is already playing, do nothing.
    if (this._overworldKey === key && this._overworldEl && !this._overworldEl.paused) {
      // Make sure it's installed as the active music el.
      this._musicEl = this._overworldEl;
      return;
    }
    // Stop any existing overworld track.
    this._stopOverworldTrack();
    // Also stop combat music if playing — overworld is the new ambience.
    this._stopCombatTrack();
    // M73 hotfix: stop any lingering intro/title track (file-based or synth).
    this._stopCurrentTrack();
    try {
      const url = this._baseUrl() + 'music/' + key + '.ogg';
      const el = new Audio(url);
      el.loop = true;
      el.volume = this.musicVolume * this.masterVolume;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      el.addEventListener('error', () => {
        if (this._overworldEl === el) this._overworldEl = null;
        if (this._musicEl === el) this._musicEl = null;
        this._unregisterMusicEl(el);
      }, { once: true });
      this._overworldEl = el;
      this._overworldKey = key;
      this._musicEl = el;
      this._registerMusicEl(el);
    } catch (_) {
      // Fallback: synth title pad.
      this._newTrackGain();
      this._buildAmbientLayer([
        { freq: 220, type: 'triangle', gain: 0.06, detune: 0 },
        { freq: 330, type: 'sine', gain: 0.04, detune: 2 },
      ]);
    }
  }

  pauseOverworldMusic() {
    debug.audio('pauseOverworldMusic', { key: this._overworldKey, t: this._overworldEl?.currentTime });
    if (this._overworldEl) {
      try {
        this._overworldPausedAt = this._overworldEl.currentTime || 0;
        this._overworldPausedKey = this._overworldKey;
        this._overworldEl.pause();
      } catch (_) {}
      // Keep _overworldEl reference so we can resume; clear _musicEl so
      // combat music takes over the "current track" slot.
      if (this._musicEl === this._overworldEl) this._musicEl = null;
    }
  }

  resumeOverworldMusic(actNum, zoneId) {
    debug.audio('resumeOverworldMusic', { actNum, zoneId, pausedAt: this._overworldPausedAt });
    const act = Math.max(1, Math.min(6, actNum || 1));
    const key = `overworld_act${act}`;
    if (this._overworldEl && this._overworldPausedKey === key) {
      try {
        this._overworldEl.currentTime = this._overworldPausedAt || 0;
        this._overworldEl.volume = this.musicVolume * this.masterVolume;
        const p = this._overworldEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        this._musicEl = this._overworldEl;
        this._overworldKey = key;
        this._registerMusicEl(this._overworldEl);
        return;
      } catch (_) {}
    }
    this.playOverworldMusic(act, zoneId);
  }

  _stopOverworldTrack() {
    if (this._overworldEl) {
      try { this._overworldEl.pause(); } catch (_) {}
      try { this._overworldEl.src = ''; } catch (_) {}
      this._unregisterMusicEl(this._overworldEl);
      if (this._musicEl === this._overworldEl) this._musicEl = null;
      this._overworldEl = null;
    }
    this._overworldKey = null;
    this._overworldPausedAt = 0;
    this._overworldPausedKey = null;
  }

  _stopCombatTrack() {
    if (this._combatEl) {
      try { this._combatEl.pause(); } catch (_) {}
      try { this._combatEl.src = ''; } catch (_) {}
      this._unregisterMusicEl(this._combatEl);
      if (this._musicEl === this._combatEl) this._musicEl = null;
      this._combatEl = null;
    }
  }

  _tryPlayCombatFile(name) {
    try {
      const url = this._baseUrl() + 'music/' + name + '.ogg';
      const el = new Audio(url);
      el.loop = true;
      el.volume = this.musicVolume * this.masterVolume;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      el.addEventListener('error', () => {
        if (this._combatEl === el) this._combatEl = null;
        this._unregisterMusicEl(el);
      }, { once: true });
      this._combatEl = el;
      this._musicEl = el;
      this._registerMusicEl(el);
      return true;
    } catch (_) {
      return false;
    }
  }

  playCombatMusic(zoneId, opts = {}) {
    debug.audio('playCombatMusic', { zoneId, opts });
    if (this._musicMuted) return;
    if (!this._unlocked) { this.queuePendingMusic('combat', { zoneId, opts }); return; }
    this.resume();
    // M69: pause overworld instead of stopping, so we can resume after combat.
    this.pauseOverworldMusic();
    this._stopCombatTrack();
    // M65: bosses get the loud epic track; routine combat gets calmer variants
    // rotated by zone so the same track isn't on a loop across every encounter.
    const isBoss = !!opts.isBoss;
    // M69: remember the act for resume after combat.
    this._lastCombatAct = opts.act || this._lastCombatAct || 1;
    this._lastCombatZone = zoneId || this._lastCombatZone || null;
    if (isBoss) {
      if (this._tryPlayCombatFile('boss_theme')) return;
      if (this._tryPlayCombatFile('combat_theme')) return;
    } else {
      const calmTracks = ['combat_calm_01', 'combat_calm_02', 'combat_calm_03'];
      let idx = 0;
      if (zoneId) {
        let h = 0; for (const c of zoneId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        idx = h % calmTracks.length;
      } else {
        idx = Math.floor(Math.random() * calmTracks.length);
      }
      if (this._tryPlayCombatFile(calmTracks[idx])) return;
      if (this._tryPlayCombatFile('combat_theme')) return;
    }
    this._newTrackGain();
    // Darker music for hell/void zones
    if (zoneId === 'hell_breach' || zoneId === 'shattered_core') {
      this._buildAmbientLayer([
        { freq: 55, type: 'sawtooth', gain: 0.06, detune: 0 },
        { freq: 82.5, type: 'square', gain: 0.03, detune: -12 },
        { freq: 110, type: 'sawtooth', gain: 0.025, detune: 5 },
      ]);
      this._addPulse(55, 0.15, 0.3);
    } else if (zoneId === 'cosmic_rift' || zoneId === 'eternal_void') {
      this._buildAmbientLayer([
        { freq: 41.2, type: 'sine', gain: 0.07, detune: 0 },
        { freq: 55, type: 'sawtooth', gain: 0.04, detune: 7 },
        { freq: 82.5, type: 'square', gain: 0.02, detune: -8 },
      ]);
      this._addPulse(41.2, 0.18, 0.25);
    } else {
      this._buildAmbientLayer([
        { freq: 110, type: 'sawtooth', gain: 0.04, detune: 0 },
        { freq: 165, type: 'square', gain: 0.02, detune: 8 },
      ]);
      this._addPulse(110, 0.12, 0.4);
    }
  }

  // M69: town now uses the same calm overworld music as the world map.
  // Callers may pass the current act number for correct selection.
  playTownMusic(actNum = 1) {
    return this.playOverworldMusic(actNum, null);
  }

  // Legacy fallback retained for synth path / future use.
  _legacyPlayTownMusic() {
    this.resume();
    this._stopCurrentTrack();
    if (this._tryPlayMusicFile('town_theme')) return;
    this._newTrackGain();
    this._currentTrack = this._buildAmbientLayer([
      { freq: 220, type: 'triangle', gain: 0.06, detune: 0 },
      { freq: 330, type: 'sine', gain: 0.04, detune: 2 },
      { freq: 440, type: 'sine', gain: 0.03, detune: -2 },
    ]);
    this._addPad([220, 293.7, 369.9], 0.04);
  }

  _buildAmbientLayer(oscillators) {
    if (!this._ctx) return [];
    const nodes = [];
    for (const osc of oscillators) {
      const o = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      const f = this._ctx.createBiquadFilter();
      o.type = osc.type;
      o.frequency.value = osc.freq;
      o.detune.value = osc.detune;
      f.type = 'lowpass';
      f.frequency.value = 800;
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(this._trackGain || this._musicGain);
      o.start();
      g.gain.linearRampToValueAtTime(osc.gain, this._ctx.currentTime + 3);
      nodes.push(o, g, f);
    }
    this._nodes.push(...nodes);
    return nodes;
  }

  _addPad(freqs, gainVal) {
    if (!this._ctx) return;
    const interval = 4;
    let time = this._ctx.currentTime + 2;
    const play = () => {
      if (!this._ctx) return;
      for (const freq of freqs) {
        const o = this._ctx.createOscillator();
        const g = this._ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.value = 0;
        o.connect(g);
        g.connect(this._trackGain || this._musicGain);
        o.start(time);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(gainVal, time + 0.5);
        g.gain.setValueAtTime(gainVal, time + interval - 1);
        g.gain.linearRampToValueAtTime(0, time + interval);
        o.stop(time + interval + 0.1);
        this._nodes.push(o, g);
      }
      time += interval;
    };
    for (let i = 0; i < 20; i++) play();
  }

  _addPulse(freq, gainVal, interval) {
    if (!this._ctx) return;
    let time = this._ctx.currentTime + 0.5;
    for (let i = 0; i < 60; i++) {
      const o = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g);
      g.connect(this._trackGain || this._musicGain);
      o.start(time);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gainVal, time + 0.02);
      g.gain.linearRampToValueAtTime(0, time + interval * 0.8);
      o.stop(time + interval);
      this._nodes.push(o, g);
      time += interval;
    }
  }

  _stopCurrentTrack() {
    if (this._musicEl) {
      try { this._musicEl.pause(); } catch(_) {}
      try { this._musicEl.currentTime = 0; } catch(_) {}
      try { this._musicEl.src = ''; } catch(_) {}
      this._unregisterMusicEl(this._musicEl);
      if (this._musicEl === this._overworldEl) this._overworldEl = null;
      if (this._musicEl === this._combatEl) this._combatEl = null;
      this._musicEl = null;
    }
    if (this._trackGain) {
      try { this._trackGain.gain.cancelScheduledValues(this._ctx.currentTime); } catch(_) {}
      try { this._trackGain.gain.value = 0; } catch(_) {}
      try { this._trackGain.disconnect(); } catch(_) {}
      this._trackGain = null;
    }
    const now = this._ctx?.currentTime || 0;
    for (const node of this._nodes) {
      try { node.stop?.(now); } catch(_) {}
      try { node.disconnect?.(); } catch(_) {}
    }
    this._nodes = [];
  }

  stopCombatMusic() {
    // M69: stop combat element and resume overworld track if we paused it.
    this._stopCombatTrack();
    if (this._overworldPausedKey) {
      const m = /overworld_act(\d)/.exec(this._overworldPausedKey);
      const act = m ? parseInt(m[1], 10) : (this._lastCombatAct || 1);
      this.resumeOverworldMusic(act, this._lastCombatZone);
    }
  }
  stopAllSfx() { /* SFX are scheduled one-shots; nothing to cancel */ }

  // M75: subdued synth dirge used for defeat until a real track is generated.
  // Slow minor-key pad — deliberately somber, not the arcade defeat.mp3.
  _playDefeatDirge() {
    this._ensureContext();
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;
    // A minor triad descending: A3 (220), C4 (261.6), E4 (329.6), low A2 (110).
    const voices = [
      { freq: 110, type: 'sine',     gain: 0.14 },
      { freq: 164.8, type: 'triangle', gain: 0.08 }, // E3
      { freq: 220, type: 'sine',     gain: 0.09 }, // A3
      { freq: 261.6, type: 'sine',   gain: 0.06 }, // C4
    ];
    for (const v of voices) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      o.type = v.type;
      o.frequency.value = v.freq;
      f.type = 'lowpass';
      f.frequency.value = 600;
      g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this._sfxGain);
      g.gain.linearRampToValueAtTime(v.gain, t + 0.8);
      g.gain.setValueAtTime(v.gain, t + 2.2);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
      o.start(t);
      o.stop(t + 3.7);
    }
  }

  stopLoop() { this._stopCurrentTrack(); }

  playSfx(type) {
    debug.audio('playSfx', type);
    if (this._sfxMuted) return;
    this.resume();
    // M65: redirect legacy keys to new punchy replacements when available.
    if (type && AudioManager.SFX_ALIASES?.[type] && !this._sfxMissing.has(AudioManager.SFX_ALIASES[type])) {
      type = AudioManager.SFX_ALIASES[type];
    }
    // M75: play real SFX files from public/sfx/. File map includes extension
    // because the directory mixes .mp3 and .ogg. Falls through to synth on
    // error so we never silently drop a cue.
    if (type === 'defeat') {
      // M75: defeat.mp3 is a goofy arcade jingle. Until a real dirge is
      // generated, play a slow minor-key synth pad instead.
      this._playDefeatDirge();
      return;
    }
    const fname = type && !this._sfxMissing.has(type) ? AudioManager.SFX_FILES?.[type] : null;
    if (fname) {
      try {
        const url = this._baseUrl() + 'sfx/' + fname;
        const el = new Audio(url);
        el.volume = this.sfxVolume * this.masterVolume;
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => { this._sfxMissing.add(type); });
        }
        return;
      } catch (_) {
        this._sfxMissing.add(type);
      }
    }
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(this._sfxGain);

    switch(type) {
      case 'click':
        o.frequency.value = 880;
        o.type = 'sine';
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t); o.stop(t + 0.1);
        break;
      case 'hit':
        o.frequency.value = 200;
        o.type = 'sawtooth';
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.start(t); o.stop(t + 0.2);
        break;
      case 'spell':
        o.frequency.setValueAtTime(440, t);
        o.frequency.linearRampToValueAtTime(880, t + 0.3);
        o.type = 'sine';
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); o.stop(t + 0.4);
        break;
      case 'victory':
        o.frequency.setValueAtTime(440, t);
        o.frequency.setValueAtTime(554, t + 0.15);
        o.frequency.setValueAtTime(659, t + 0.3);
        o.frequency.setValueAtTime(880, t + 0.45);
        o.type = 'sine';
        g.gain.setValueAtTime(0.25, t);
        g.gain.setValueAtTime(0.25, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        o.start(t); o.stop(t + 1.0);
        break;
      case 'defeat':
        o.frequency.setValueAtTime(440, t);
        o.frequency.linearRampToValueAtTime(220, t + 0.8);
        o.type = 'sawtooth';
        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0.001, t + 1.2);
        o.start(t); o.stop(t + 1.2);
        break;
      case 'levelup':
      case 'level_up': {
        // Ascending arpeggio
        const notes = [261.6, 329.6, 392, 523.3, 659.3];
        notes.forEach((freq, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(this._sfxGain);
          o2.type = 'sine'; o2.frequency.value = freq;
          const st = t + i * 0.08;
          g2.gain.setValueAtTime(0, st);
          g2.gain.linearRampToValueAtTime(0.2, st + 0.03);
          g2.gain.exponentialRampToValueAtTime(0.001, st + 0.25);
          o2.start(st); o2.stop(st + 0.25);
        });
        o.start(t); o.stop(t); // stop unused base oscillator
        break;
      }
      case 'purchase':
        o.frequency.setValueAtTime(660, t);
        o.frequency.setValueAtTime(880, t + 0.05);
        o.type = 'triangle';
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.start(t); o.stop(t + 0.2);
        break;
      case 'shrine':
        o.frequency.setValueAtTime(523.3, t);
        o.frequency.linearRampToValueAtTime(1046.5, t + 0.5);
        o.type = 'sine';
        g.gain.setValueAtTime(0.08, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        o.start(t); o.stop(t + 0.8);
        break;
      case 'craft':
        o.frequency.setValueAtTime(300, t);
        o.frequency.setValueAtTime(400, t + 0.05);
        o.frequency.setValueAtTime(600, t + 0.1);
        o.type = 'sawtooth';
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.3);
        break;
      case 'ng_plus': {
        // Triumphant fanfare
        const fanfare = [440, 554.4, 659.3, 880, 1108.7];
        fanfare.forEach((freq, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(this._sfxGain);
          o2.type = 'triangle'; o2.frequency.value = freq;
          const st = t + i * 0.1;
          g2.gain.setValueAtTime(0, st);
          g2.gain.linearRampToValueAtTime(0.25, st + 0.04);
          g2.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
          o2.start(st); o2.stop(st + 0.5);
        });
        o.start(t); o.stop(t);
        break;
      }
    }
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    if (this._masterGain) this._masterGain.gain.value = v;
    // M69: apply to ALL active music elements, not just _musicEl.
    const vol = this.musicVolume * this.masterVolume;
    for (const el of this._allMusicEls) {
      try { el.volume = vol; } catch (_) {}
    }
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this._musicGain) this._musicGain.gain.value = v;
    const vol = this.musicVolume * this.masterVolume;
    for (const el of this._allMusicEls) {
      try { el.volume = vol; } catch (_) {}
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this._sfxGain) this._sfxGain.gain.value = this._sfxMuted ? 0 : v;
  }

  setMusicMuted(on) {
    this._musicMuted = !!on;
    try { localStorage.setItem('emberveil_music_muted', this._musicMuted ? '1' : '0'); } catch (_) {}
    const vol = this._musicMuted ? 0 : this.musicVolume * this.masterVolume;
    for (const el of this._allMusicEls) {
      try { el.volume = vol; } catch (_) {}
      if (this._musicMuted) { try { el.pause(); } catch (_) {} }
    }
    if (this._musicGain) {
      try { this._musicGain.gain.value = this._musicMuted ? 0 : this.musicVolume; } catch (_) {}
    }
  }

  setSfxMuted(on) {
    this._sfxMuted = !!on;
    try { localStorage.setItem('emberveil_sfx_muted', this._sfxMuted ? '1' : '0'); } catch (_) {}
    if (this._sfxGain) {
      try { this._sfxGain.gain.value = this._sfxMuted ? 0 : this.sfxVolume; } catch (_) {}
    }
  }

  isMusicMuted() { return !!this._musicMuted; }
  isSfxMuted()   { return !!this._sfxMuted; }
}

// M75: explicit filename map so we pick the right extension (.mp3 vs .ogg).
// Keys are logical SFX names; values are the actual file under public/sfx/.
AudioManager.SFX_FILES = {
  'block_shield':    'block_shield.mp3',
  'boss_roar':       'boss_roar.mp3',
  'chest_open':      'chest_open.mp3',
  'crit_slash':      'crit_slash.mp3',
  'crit_cue':        'crit_cue.mp3',
  'door_open':       'door_open.mp3',
  'drake_screech':   'drake_screech.mp3',
  'enemy_die':       'enemy_die.mp3',
  'enemy_death':     'enemy_death.mp3',
  'enemy_growl':     'enemy_growl.mp3',
  'fire_crackle':    'fire_crackle.mp3',
  'gold_gain':       'gold_gain.mp3',
  'hero_death':      'hero_death.mp3',
  'hero_hurt':       'hero_hurt.mp3',
  'hero_hurt_f':     'hero_hurt_f.mp3',
  'hit_arrow':       'hit_arrow.mp3',
  'hit_blunt':       'hit_blunt.mp3',
  'hit_sword':       'hit_sword.mp3',
  'item_pickup':     'item_pickup.mp3',
  'level_up':        'level_up.mp3',
  'owl_hoot':        'owl_hoot.mp3',
  'portal_warp':     'portal_warp.mp3',
  'quest_complete':  'quest_complete.mp3',
  'rest_heal':       'rest_heal.mp3',
  'shrine_pray':     'shrine_pray.mp3',
  'spell_arcane':    'spell_arcane.mp3',
  'spell_buff':      'spell_buff.mp3',
  'spell_dark':      'spell_dark.mp3',
  'spell_debuff':    'spell_debuff.mp3',
  'spell_explode':   'spell_explode.mp3',
  'spell_fire':      'spell_fire.mp3',
  'spell_heal':      'spell_heal.mp3',
  'spell_holy':      'spell_holy.mp3',
  'spell_ice':       'spell_ice.mp3',
  'spell_lightning': 'spell_lightning.mp3',
  'spell_shadow':    'spell_shadow.mp3',
  'spell_summon':    'spell_summon.mp3',
  'status_burn':     'status_burn.mp3',
  'status_freeze':   'status_freeze.mp3',
  'status_poison':   'status_poison.mp3',
  'status_stun':     'status_stun.mp3',
  'thunder_rumble':  'thunder_rumble.mp3',
  'torch_lit':       'torch_lit.mp3',
  'trap_spring':     'trap_spring.mp3',
  'unlock':          'unlock.mp3',
  'victory_fanfare': 'victory_fanfare.mp3',
  'wind_gust':       'wind_gust.mp3',
  'wolf_howl':       'wolf_howl.mp3',
  'melee_hit_light': 'melee_hit_light.mp3',
  'melee_hit_heavy': 'melee_hit_heavy.mp3',
  'melee_slash':     'melee_slash.mp3',
  'melee_crit':      'melee_crit.mp3',
  'melee_miss':      'melee_miss.mp3',
  'arrow_shoot':     'arrow_shoot.mp3',
  'arrow_hit':       'arrow_hit.mp3',
  'punch':           'punch.mp3',
  'axe_chop':        'axe_chop.mp3',
  'dagger_stab':     'dagger_stab.mp3',
  'parry':           'parry.mp3',
  'potion_drink':    'potion_drink.mp3',
  'potion_heal_cue': 'potion_heal_cue.mp3',
};

AudioManager.KNOWN_SFX = new Set([
  'block_shield','boss_roar','chest_open','crit_slash','defeat','door_open',
  'drake_screech','enemy_die','fire_crackle','gold_gain','hit_arrow','hit_blunt',
  'hit_sword','item_pickup','level_up','owl_hoot','portal_warp','quest_complete',
  'rest_heal','shrine_pray','spell_arcane','spell_buff','spell_debuff','spell_fire',
  'spell_heal','spell_holy','spell_ice','spell_lightning','spell_shadow','spell_summon',
  'status_burn','status_freeze','status_poison','status_stun','thunder_rumble',
  'torch_lit','trap_spring','unlock','victory_fanfare','wind_gust','wolf_howl',
  // M65 additions — punchy clangs/booms for combat
  'melee_hit_light','melee_hit_heavy','melee_slash','melee_crit','melee_miss',
  'arrow_shoot','arrow_hit','punch','axe_chop','dagger_stab','shield_block','parry',
  'spell_dark','spell_explode',
  'enemy_death','enemy_growl','hero_hurt','hero_hurt_f','hero_death','crit_cue',
  'potion_drink','potion_heal_cue',
]);

// M70: legacy procedural beep keys → real mp3 files. The M65-era hit_sword/
// hit_blunt/hit_arrow/crit_slash/enemy_die aliases were dropped in M415 after
// audit confirmed no live call sites remain.
AudioManager.SFX_ALIASES = {
  // M70: legacy procedural beep keys → real mp3 files.
  'click':        'item_pickup',
  'hit':          'melee_hit_light',
  'spell':        'spell_arcane',
  'victory':      'victory_fanfare',
  'levelup':      'level_up',
  'purchase':     'gold_gain',
  'shrine':       'shrine_pray',
  'craft':        'unlock',
  'ng_plus':      'victory_fanfare',
  // M75: additional logical keys used by CombatScreen and town screens.
  'miss':         'melee_miss',
  'heal':         'spell_heal',
  'treasure':     'chest_open',
  'portal':       'portal_warp',
  'crit':         'melee_crit',
  'block':        'block_shield',
  'arrow':        'arrow_shoot',
  'fire':         'spell_fire',
  'ice':          'spell_ice',
  'lightning':    'spell_lightning',
  'holy':         'spell_holy',
  'dark':         'spell_dark',
  'shadow':       'spell_shadow',
};
