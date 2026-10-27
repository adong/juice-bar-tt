/* The game's own synth sounds, made with Kit.sound.tone and Kit.sound.hiss (so the one sound switch mutes them).
   JB.Sfx.log keeps the last names played, for checking sound in code while testing muted.
   Classic script: adds JB.Sfx to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const S = () => Kit.sound;
  const tone = (o) => S().tone(o);
  const hiss = (o) => S().hiss(o);
  const log = [];

  const SOUNDS = {
    row(up) { tone({ type: 'triangle', f: up ? 520 : 420, to: up ? 700 : 300, dur: 0.07, vol: 0.07 }); },
    bump() { tone({ type: 'square', f: 180, to: 140, dur: 0.06, vol: 0.04, lp: 900 }); },
    pour() { hiss({ filter: 'bandpass', f: 900, to: 1600, q: 3, dur: 0.18, vol: 0.05 }); },
    full() { tone({ type: 'sine', f: 1320, dur: 0.08, vol: 0.08 }); tone({ type: 'sine', f: 1760, dur: 0.1, vol: 0.06, at: 0.06 }); },
    send() {
      hiss({ filter: 'bandpass', f: 2400, to: 600, q: 1.2, dur: 0.3, vol: 0.09 });
      tone({ type: 'triangle', f: 700, to: 320, dur: 0.22, vol: 0.06 });
    },
    catch() { tone({ type: 'square', f: 660, to: 990, dur: 0.09, vol: 0.06, lp: 2400 }); },
    slurp() {
      for (let k = 0; k < 3; k++) hiss({ filter: 'bandpass', f: 500 + k * 220, to: 1200, q: 4, dur: 0.1, vol: 0.06, at: k * 0.12 });
    },
    empty() { tone({ type: 'triangle', f: 400, to: 520, dur: 0.12, vol: 0.05 }); },
    grab() { tone({ type: 'triangle', f: 1046, dur: 0.08, vol: 0.09 }); tone({ type: 'triangle', f: 1568, dur: 0.12, vol: 0.07, at: 0.06 }); },
    served() { [784, 988, 1175, 1568].forEach((f, k) => tone({ type: 'square', f, dur: 0.1, vol: 0.05, lp: 3000, at: k * 0.07 })); },
    whee() { tone({ type: 'sine', f: 500, to: 1600, dur: 0.45, vol: 0.08 }); },
    float() { tone({ type: 'sine', f: 600, to: 1300, dur: 0.6, vol: 0.06 }); },
    splash() {
      hiss({ filter: 'lowpass', f: 2200, to: 400, dur: 0.35, vol: 0.2 });
      tone({ type: 'sine', f: 300, to: 90, dur: 0.25, vol: 0.12 });
    },
    life() { [523, 440, 349].forEach((f, k) => tone({ type: 'triangle', f, dur: 0.18, vol: 0.1, at: k * 0.14 })); },
    gulp() {
      for (let k = 0; k < 4; k++) tone({ type: 'sine', f: 220 + k * 30, to: 140, dur: 0.09, vol: 0.12, at: k * 0.13 });
    },
    tip() { S().coin(3); tone({ type: 'triangle', f: 1568, dur: 0.2, vol: 0.1, at: 0.08 }); },
    tipDrop() { tone({ type: 'sine', f: 1800, to: 2400, dur: 0.08, vol: 0.05 }); },
    dance() { [659, 784, 659, 988].forEach((f, k) => tone({ type: 'square', f, dur: 0.09, vol: 0.05, lp: 2600, at: k * 0.12 })); },
    treat() { S().coin(2); },
    buddyIn() { S().powerup(); },
    buddyPour() { for (let k = 0; k < 4; k++) hiss({ filter: 'bandpass', f: 2600 - k * 300, to: 500, q: 1.2, dur: 0.28, vol: 0.07, at: k * 0.06 }); },
    highFive() { S().punch(); tone({ type: 'triangle', f: 1046, dur: 0.18, vol: 0.12, at: 0.05 }); },
    clear() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, k) => tone({ type: 'square', f, dur: 0.14, vol: 0.07, lp: 3200, at: k * 0.11 }));
    },
    over() { [523, 466, 415, 392].forEach((f, k) => tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: k * 0.2 })); },
    go() { tone({ type: 'square', f: 784, dur: 0.12, vol: 0.07 }); tone({ type: 'square', f: 1175, dur: 0.2, vol: 0.07, at: 0.12 }); },
    click() { S().click(); },
  };

  JB.Sfx = {
    log,
    play(name, ...args) {
      log.push(name);
      if (log.length > 60) log.shift();
      if (S().isMuted()) return;
      const f = SOUNDS[name];
      if (f) f(...args);
    },
    names: Object.keys(SOUNDS),
  };
})();
