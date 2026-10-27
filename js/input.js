/* Keys and touch, turned into each server's input: { x, dy, fill, call }. x: -1 walk left, 1 walk right; dy: counters
   to move (+1 up, -1 down), one per press; fill: the pour key (or the 🧃 button) is held.
   A key tapped and let go between two frames still counts once (taps are latched until read), and counter moves and
   the call are counted presses, so a quick tap is never lost. Classic script: adds JB.Input to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const held = new Set();
  const tapped = new Set();
  const presses = [{ up: 0, down: 0, call: 0 }, { up: 0, down: 0, call: 0 }];
  const pads = [{ x: 0, dir: '', id: null }, { x: 0, dir: '', id: null }];
  const pours = [{ on: false, tap: false }, { on: false, tap: false }];

  const P1 = { l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], d: ['KeyS'], fill: ['Space', 'KeyF'], call: ['KeyT'] };
  const P2 = { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'], fill: ['Enter', 'NumpadEnter', 'Slash'], call: [] };
  const GAME_KEYS = new Set([...Object.values(P1).flat(), ...Object.values(P2).flat()]);

  let two = false;
  let enabled = false;
  // in 2 players each brother has his own keys; in 1 player every key works for him
  const who = (k) => (two && Object.values(P2).flat().includes(k) ? 1 : 0);

  function keydown(e) {
    if (!enabled || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.code;
    if (!GAME_KEYS.has(k)) return;
    e.preventDefault();
    if (e.repeat) return;
    held.add(k);
    tapped.add(k);
    const p = presses[who(k)];
    if (P1.u.includes(k) || P2.u.includes(k)) p.up++;
    if (P1.d.includes(k) || P2.d.includes(k)) p.down++;
    if (P1.call.includes(k)) presses[0].call++;
  }
  function keyup(e) {
    held.delete(e.code);
  }
  const on = (codes) => codes.some((c) => held.has(c) || tapped.has(c));

  function read(i) {
    const sets = two ? [i === 0 ? P1 : P2] : [P1, P2];
    let x = 0, fill = false;
    for (const s of sets) {
      if (on(s.r)) x += 1;
      if (on(s.l)) x -= 1;
      if (on(s.fill)) fill = true;
    }
    const pi = two ? i : 0;
    const pad = pads[pi];
    if (pad.id !== null) x = pad.x;
    if (pours[pi].on || pours[pi].tap) fill = true;
    pours[pi].tap = false;
    const p = presses[i];
    const dy = p.up > 0 ? 1 : p.down > 0 ? -1 : 0;
    if (p.up > 0) p.up--;
    else if (p.down > 0) p.down--;
    const out = { x: Math.sign(x), dy, fill, call: p.call > 0 };
    if (p.call > 0) p.call--;
    return out;
  }
  // after every server has read this frame's input, the latched taps are done with
  function endFrame() {
    tapped.clear();
  }

  // A round pad: thumb down and slide. Four ways: ▲ ▼ change counter (once each time you push), ◀ ▶ walk.
  function bindPad(i, el) {
    const p = pads[i];
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      let dir = '';
      if (Math.hypot(dx, dy) >= r.width * 0.12) dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy < 0 ? 'u' : 'd';
      if (dir !== p.dir) {
        const q = presses[two ? i : 0];
        if (dir === 'u') q.up++;
        if (dir === 'd') q.down++;
      }
      p.dir = dir;
      p.x = dir === 'r' ? 1 : dir === 'l' ? -1 : 0;
      el.dataset.dir = dir;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      p.id = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      set(e);
    });
    el.addEventListener('pointermove', (e) => { if (p.id === e.pointerId) set(e); });
    const up = (e) => {
      if (p.id !== e.pointerId) return;
      p.id = null;
      p.x = 0;
      p.dir = '';
      el.dataset.dir = '';
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  // the 🧃 button: held while the finger is down (a quick tap still counts for one frame)
  function bindPour(i, el) {
    let id = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      el.classList.add('down');
      const q = pours[two ? i : 0];
      q.on = q.tap = true;
    });
    const up = (e) => {
      if (id !== e.pointerId) return;
      id = null;
      el.classList.remove('down');
      pours[two ? i : 0].on = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  // a big round button that counts as a press of the call for player i
  function bindButton(el, i, cb) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('down');
      presses[two ? i : 0].call++;
      if (cb) cb(e);
    });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  function reset() {
    held.clear();
    tapped.clear();
    for (const p of presses) p.up = p.down = p.call = 0;
    for (const p of pads) { p.x = 0; p.dir = ''; p.id = null; }
    for (const p of pours) p.on = p.tap = false;
  }

  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);
  addEventListener('blur', () => { held.clear(); for (const p of pours) p.on = false; });

  JB.Input = {
    read, endFrame, bindPad, bindPour, bindButton, reset, P1, P2,
    setTwo(v) { two = !!v; },
    enable(v) { enabled = !!v; if (!v) reset(); },
    held: () => [...held],
    pads, pours,
  };
})();
