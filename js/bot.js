/* The autopilot: plays a server the way a good kid would. It gives back the same input the keys give,
   { x, dy, fill, call }, so the attract demo, the soak in js/check.js and the "keys bot" in js/playcheck.js (which
   turns it into real key presses) all use it. In 2 players each bot looks after two counters.
   Classic script: adds JB.Bot to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const TUNE = JB.TUNE;
  const S = JB.Sim;
  const mem = new WeakMap();

  function think(M, i, o = {}) {
    const s = M.servers[i];
    const out = { x: 0, dy: 0, fill: false, call: false };
    if (!s || M.state !== 'play') return out;
    let m = mem.get(s);
    if (!m) mem.set(s, (m = { callT: 2 + i, wait: 0 }));
    const L = TUNE.L, D = M.D;
    const mine = M.two ? (i === 0 ? [2, 3] : [0, 1]) : [0, 1, 2, 3];
    // every job, with how many seconds are left before it goes wrong
    let best = null, uncoveredAll = 0;
    const consider = (row, left, kind, x) => { if (!best || left < best.left) best = { row, left, kind, x }; };
    for (const r of mine) {
      const thirsty = S.thirstyOn(M, r).sort((a, b) => b.x - a.x);
      const inflight = S.cupsOn(M, r, 'full').length;
      const open = thirsty.slice(inflight);
      uncoveredAll += open.length;
      if (open.length) consider(r, (TUNE.endX - open[0].x) / Math.max(0.15, open[0].speed) - 1.2, 'serve');
      const other = M.servers.some((o2) => o2 !== s && o2.row === r);
      if (!other) {
        for (const c of S.cupsOn(M, r, 'empty')) consider(r, (L + TUNE.fall - c.x) / D.emptyV + (D.splashLife ? -0.6 : 7), 'empty');
      }
    }
    // a tip, when nothing is in a hurry
    if ((!best || best.left > 7) && !o.noTips) {
      let tip = null;
      for (const t of M.tips) if (!t.gone && mine.includes(t.row) && t.t > 1.2 && (!tip || t.x > tip.x)) tip = t;
      if (tip) best = { row: tip.row, left: 0, kind: 'tip', x: tip.x };
    }
    // the companion: called when it's getting busy
    m.callT -= M.callDt || 1 / 60;
    if (o.buddy && !M.two && uncoveredAll >= 2 && m.callT <= 0 && !M.buddies[0].on) {
      out.call = true;
      m.callT = 6;
    }
    if (!best) {
      // nothing to do: walk back to the tap and have a cup ready
      if (s.x < L - TUNE.tapR) out.x = 1;
      else out.fill = true;
      return out;
    }
    if (best.row !== s.row) {
      out.dy = Math.sign(best.row - s.row);
      out.fill = s.held && s.fill > 0; // keep hold of a cup that's on its way
      return out;
    }
    if (best.kind === 'tip') {
      out.x = Math.abs(best.x - s.x) < 0.2 ? 0 : Math.sign(best.x - s.x);
      out.fill = s.held; // letting go at the tap would slide the cup to nobody
      return out;
    }
    if (s.x < L - TUNE.tapR) {
      out.x = 1;
      out.fill = s.held;
      return out;
    }
    if (best.kind === 'serve') out.fill = !(s.fill >= 1 && s.held); // fill, then let go to slide it
    else out.fill = true; // waiting for an empty: get a cup ready
    return out;
  }

  JB.Bot = { think };
})();
