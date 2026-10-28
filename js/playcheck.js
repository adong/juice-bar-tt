/* The play check: drives the page with real keydown/keyup events on window and pointer events on the touch pad and
   the 🧃 button (never the rules' inputs), lets the game's own loop read them (game.step only moves the clock), and
   measures where the server is drawn ON THE SCREEN. Runs in the page: game.playCheck().
   game.playCheck({ sabotage: 'mirror' }) swaps left and right inside the rules, 'flipRows' swaps up and down,
   'stuckFill' stops him walking while the pour key is held, 'stuckOops' never ends the pause after a lost life:
   each must fail, which proves the check can catch them (game.provePlayCheck() runs them all).
     - on every wave (and round 2), 1 and 2 players, arrows and WASD: → moves him right on screen, ← left,
       ↑ up to the next counter, ↓ down; the top and bottom counters are the ends
     - 2 players: each brother's keys move only him
     - hold Space at the tap: the cup fills; let go: it slides left along the counter on screen
     - an empty sliding back is caught when he moves up to its counter with the keys
     - nothing leaves him stuck: walking works while Space is held, the keys come back after a lost life, after
       pause and after the ? panel, and a "keyboard kid" bashing random keys on every wave never strands him
     - touch: the pad moves him the way the finger points, and the 🧃 button pours and slides
     - T brings his brother, who slides a cup down every counter; 2 players: T is a high five
     - a "keys bot" (the autopilot turned into real key presses) clears wave 1 on EASY and NORMAL, 1 and 2 players */
(function () {
  'use strict';
  const JB = window.JB;
  const TUNE = JB.TUNE, L = TUNE.L;
  const KEYNAME = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', Enter: 'Enter', Escape: 'Escape', Slash: '/' };
  const key = (type, code, o = {}) => {
    const k = o.key || KEYNAME[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code);
    window.dispatchEvent(new KeyboardEvent(type, Object.assign({ code, key: k, bubbles: true, cancelable: true }, o.shift ? { shiftKey: true } : {})));
  };
  const tap = (code) => { key('keydown', code); key('keyup', code); };
  const SETS = {
    wasd: { R: 'KeyD', L: 'KeyA', U: 'KeyW', D: 'KeyS', F: 'Space', name: 'WASD' },
    arrows: { R: 'ArrowRight', L: 'ArrowLeft', U: 'ArrowUp', D: 'ArrowDown', F: 'Enter', name: 'arrows' },
  };

  function playCheck(o = {}) {
    o = Object.assign({ log: [] }, o);
    const game = window.game;
    const fails = [];
    let passed = 0;
    const ok = (cond, what) => { if (cond) passed++; else fails.push(what); return cond; };
    const step = (s) => game.step(s, { draw: false, quiet: true });
    const hold = (code, s) => { key('keydown', code); step(s); key('keyup', code); step(1 / 60); };
    const M = () => game.G.M;
    const S = (i) => M().servers[i];
    if (o.sabotage) JB.SABOTAGE[o.sabotage] = true;
    const t0 = Date.now();
    const waves = o.quick ? [0] : JB.LEVELS.map((x, n) => n).concat([JB.LEVELS.length]);
    try {
      for (const n of waves) {
        for (const two of [false, true]) {
          game.start({ n, diff: 'easy', two });
          game.quiet();
          const wave = `wave ${n + 1}${n >= JB.LEVELS.length ? ' (round 2)' : ''} ${two ? '2P' : '1P'}`;
          const sets = two ? [SETS.wasd, SETS.arrows] : [SETS.arrows, SETS.wasd];
          sets.forEach((K, si) => {
            const i = two ? si : 0, other = two ? 1 - i : -1;
            const label = `${wave} ${K.name}`;
            game.put(i, 1, 7);
            if (other >= 0) game.put(other, 3, 5);
            const oth0 = other >= 0 ? game.screenOf(other) : null;
            let a = game.screenOf(i);
            hold(K.R, 0.3);
            let b = game.screenOf(i);
            ok(b.x - a.x > 8 && Math.abs(b.y - a.y) < 4, `${label}: → moved him ${(b.x - a.x).toFixed(0)} px across the screen (should be right)`);
            a = b;
            hold(K.L, 0.3);
            b = game.screenOf(i);
            ok(a.x - b.x > 8 && Math.abs(b.y - a.y) < 4, `${label}: ← moved him ${(b.x - a.x).toFixed(0)} px across the screen (should be left)`);
            if (oth0) {
              const oth1 = game.screenOf(other);
              ok(Math.abs(oth1.x - oth0.x) < 1 && Math.abs(oth1.y - oth0.y) < 1, `${label}: the other brother moved too`);
            }
            game.put(i, 1, L);
            a = game.screenOf(i);
            tap(K.U);
            step(0.35);
            b = game.screenOf(i);
            ok(S(i).row === 2 && a.y - b.y > 12, `${label}: ↑ took him to counter ${S(i).row + 1}, ${(a.y - b.y).toFixed(0)} px up the screen`);
            a = b;
            tap(K.D);
            step(0.35);
            b = game.screenOf(i);
            ok(S(i).row === 1 && b.y - a.y > 12, `${label}: ↓ took him to counter ${S(i).row + 1}, ${(b.y - a.y).toFixed(0)} px down the screen`);
            game.put(i, 3, L);
            tap(K.U);
            step(0.2);
            ok(S(i).row === 3, `${label}: ↑ at the top counter went to ${S(i).row}`);
            game.put(i, 0, L);
            tap(K.D);
            step(0.2);
            ok(S(i).row === 0, `${label}: ↓ at the bottom counter went to ${S(i).row}`);
            // pour: hold, let go, and the cup slides left along the counter on screen
            game.put(i, 0, L);
            key('keydown', K.F);
            step(M().D.fillT + 0.15);
            ok(S(i).fill >= 1, `${label}: holding the pour key filled the cup to ${S(i).fill.toFixed(2)}`);
            const before = M().cups.length;
            key('keyup', K.F);
            step(1 / 60);
            const cup = M().cups.slice(before).find((c) => c.kind === 'full' && c.row === 0);
            if (ok(cup, `${label}: letting go of the pour key didn't slide a cup`)) {
              step(1 / 60);
              const c0 = game.cupScreen(cup.id);
              step(0.3);
              const c1 = game.cupScreen(cup.id);
              ok(c0 && c1 && c0.x - c1.x > 20, `${label}: the cup moved ${c0 && c1 ? (c1.x - c0.x).toFixed(0) : '?'} px on screen (should slide left)`);
            }
            game.quiet();
            // walking works while the pour key is held
            game.put(i, 2, L);
            key('keydown', K.F);
            step(0.1);
            a = game.screenOf(i);
            hold(K.L, 0.3);
            b = game.screenOf(i);
            key('keyup', K.F);
            step(1 / 60);
            ok(a.x - b.x > 8, `${label}: holding the pour key, ← moved him ${(b.x - a.x).toFixed(0)} px (stuck at the tap)`);
            game.quiet();
          });
          // an empty sliding back on the counter above: move up to it and it's caught
          game.put(0, 1, L);
          if (two) game.put(1, 3, L);
          JB.Check.addCup(M(), 2, 8.5, 'empty');
          M().total = 0;
          const caught = S(0).caught;
          tap(two ? 'KeyW' : 'ArrowUp');
          step(1.8);
          ok(S(0).caught === caught + 1, `${wave}: moving up to an empty's counter didn't catch it`);
          game.quiet();
        }
      }

      // ---------------------------------------------------------------- nothing leaves him stuck
      const moves = (label, i = 0, K = SETS.arrows) => {
        game.put(i, S(i).row, 7);
        let a = game.screenOf(i);
        const x0 = S(i).x;
        hold(K.R, 0.25);
        let b = game.screenOf(i);
        const right = b.x - a.x > 8, x1 = S(i).x, dr = b.x - a.x;
        a = b;
        hold(K.L, 0.25);
        b = game.screenOf(i);
        return ok(right && a.x - b.x > 8, `${label}: → and ← didn't move him afterwards (x ${x0.toFixed(2)} → ${x1.toFixed(2)} → ${S(i).x.toFixed(2)}, ${dr.toFixed(0)} / ${(b.x - a.x).toFixed(0)} px, ${M().state}, ${game.G.screen}, held ${JB.Input.held().join(' ')}, other ${S(1 - i) ? S(1 - i).row + '/' + S(1 - i).x.toFixed(2) : '-'}, row ${S(i).row})`);
      };
      // a lost life: a short pause, then the keys work again
      game.start({ n: 0, diff: 'normal' });
      game.quiet();
      JB.Check.addCup(M(), 3, -0.5, 'full');
      step(0.1);
      ok(M().state === 'oops', `after a splash on NORMAL the bar is ${M().state}`);
      step(TUNE.oopsT + 0.2);
      ok(M().state === 'play', `${TUNE.oopsT + 0.2} s after a lost life the bar is still ${M().state}`);
      moves('after a lost life');
      // an animal that got to the tap: the same
      game.quiet();
      JB.Check.addAnimal(M(), 1, TUNE.endX - 0.05, { speed: 1 });
      step(TUNE.oopsT + 0.4);
      moves('after an animal drank from the tap');
      // pause and the ? panel give the keys back
      tap('KeyP');
      step(0.1);
      ok(game.G.screen === 'pause', `P didn't pause (${game.G.screen})`);
      tap('KeyP');
      step(0.1);
      ok(game.G.screen === 'play', `P didn't carry on (${game.G.screen})`);
      moves('after pause');
      if (Kit.help) {
        key('keydown', 'Slash', { key: '?', shift: true });
        key('keyup', 'Slash', { key: '?', shift: true });
        ok(Kit.help.isOpen(), "? didn't open the keys panel");
        tap('KeyX');
        ok(!Kit.help.isOpen(), 'a key did not close the keys panel');
        moves('after the ? panel');
      }

      // ---------------------------------------------------------------- keyboard kid
      const codes = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyF', 'Enter', 'Slash', 'KeyT'];
      let seed = 4242;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const n of waves) {
        for (const two of [false, true]) {
          game.start({ n, diff: 'normal', two });
          M().lives = 999;
          M().noClear = true; // the kid may serve them all: keep bashing
          const down = new Set();
          const secs = o.quick ? 8 : 30;
          for (let f = 0; f < secs * 60; f++) {
            if (rnd() < 0.3) {
              const c = codes[Math.floor(rnd() * codes.length)];
              if (down.has(c)) { key('keyup', c); down.delete(c); } else { key('keydown', c); down.add(c); }
            }
            step(1 / 60);
            if (M().state === 'clear') { M().state = 'play'; M().noClear = true; game.G.after = null; } // the kid served them all: keep bashing
          }
          for (const c of down) key('keyup', c);
          step(0.1);
          const name = `keyboard kid on wave ${n + 1} ${two ? '2P' : '1P'}`;
          for (let i = 0; i < M().servers.length; i++) {
            const s = S(i);
            ok(s.row >= 0 && s.row < TUNE.ROWS && s.x >= TUNE.xMin && s.x <= L, `${name}: server ${i + 1} ended up off the bar (row ${s.row}, x ${s.x})`);
          }
          game.quiet();
          if (M().state !== 'play') step(TUNE.oopsT + 0.2);
          ok(game.G.screen === 'play', `${name}: the game left play (${game.G.screen})`);
          moves(name, 0, two ? SETS.wasd : SETS.arrows);
          if (two) moves(name + ' (2P arrows)', 1, SETS.arrows);
        }
      }

      // ---------------------------------------------------------------- touch
      game.setTouch(true);
      game.start({ n: 0, diff: 'easy' });
      game.quiet();
      step(0.1);
      const pad = document.getElementById('pad0');
      const pt = (type, el, dx, dy) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2 + dx * r.width * 0.35, clientY: r.top + r.height / 2 + dy * r.height * 0.35 }));
      };
      game.put(0, 1, 7);
      let a = game.screenOf(0);
      pt('pointerdown', pad, 1, 0);
      step(0.25);
      let b = game.screenOf(0);
      ok(b.x - a.x > 8, `touch: the pad pushed right moved him ${(b.x - a.x).toFixed(0)} px`);
      a = b;
      pt('pointermove', pad, -1, 0);
      step(0.25);
      b = game.screenOf(0);
      ok(a.x - b.x > 8, `touch: the pad pushed left moved him ${(b.x - a.x).toFixed(0)} px`);
      a = b;
      pt('pointermove', pad, 0, -1);
      step(0.35);
      b = game.screenOf(0);
      ok(S(0).row === 2 && a.y - b.y > 12, `touch: the pad pushed up took him to counter ${S(0).row + 1}`);
      a = b;
      pt('pointermove', pad, 0, 1);
      step(0.35);
      b = game.screenOf(0);
      ok(S(0).row === 1 && b.y - a.y > 12, `touch: the pad pushed down took him to counter ${S(0).row + 1}`);
      pt('pointerup', pad, 0, 1);
      step(0.1);
      const before = S(0).x;
      step(0.2);
      ok(S(0).x === before, 'touch: he kept walking after the finger came off the pad');
      const pour = document.getElementById('pour0');
      game.put(0, 0, L);
      const sent = S(0).sent;
      pt('pointerdown', pour, 0, 0);
      step(M().D.fillT + 0.15);
      ok(S(0).fill >= 1, `touch: holding 🧃 filled the cup to ${S(0).fill.toFixed(2)}`);
      pt('pointerup', pour, 0, 0);
      step(0.05);
      ok(S(0).sent === sent + 1, 'touch: letting go of 🧃 did not slide the cup');
      game.setTouch(false);

      // ---------------------------------------------------------------- the brother
      game.start({ n: 0, diff: 'easy' });
      game.quiet();
      tap('KeyT');
      step(0.4);
      ok(M().buddies[0].on, 'T did not call the brother');
      const sb = game.screenOf(0, 'buddy');
      ok(sb && sb.x > 0 && sb.x < innerWidth && sb.y > 0 && sb.y < innerHeight, `the brother popped up off the screen (${sb && sb.x.toFixed(0)}, ${sb && sb.y.toFixed(0)})`);
      const B = TUNE.buddy;
      step(B.inT + B.sigT + B.treatT + B.pourT);
      const magic = new Set(M().cups.filter((c) => c.magic && c.kind === 'full').map((c) => c.row));
      ok(magic.size === TUNE.ROWS, `the brother slid cups down ${magic.size} counters (should be ${TUNE.ROWS})`);
      ok(S(0).boost > 0, 'the brother\'s treat did not speed up pouring');
      step(1);
      ok(!M().buddies[0].on, 'the brother did not go home');
      game.start({ n: 0, diff: 'easy', two: true });
      tap('KeyT');
      step(0.1);
      ok(M().highFives === 1 && !M().buddies.length, '2 players: T was not a high five');

      // ---------------------------------------------------------------- keys bot: the autopilot, as real key presses
      if (!o.quick || o.keysBot) {
        for (const diff of ['easy', 'normal']) {
          for (const two of [false, true]) {
            game.start({ n: 0, diff, two });
            const sets = two ? [SETS.wasd, SETS.arrows] : [SETS.arrows];
            const down = new Set();
            const want = (code, on) => {
              if (on && !down.has(code)) { key('keydown', code); down.add(code); }
              if (!on && down.has(code)) { key('keyup', code); down.delete(code); }
            };
            let f = 0;
            while (M().state !== 'clear' && M().state !== 'over' && f++ < 60 * 200) {
              sets.forEach((K, i) => {
                const inp = JB.Bot.think(M(), i, {});
                want(K.R, inp.x > 0);
                want(K.L, inp.x < 0);
                want(K.F, inp.fill);
                if (inp.dy) tap(inp.dy > 0 ? K.U : K.D);
              });
              step(1 / 60);
            }
            for (const c of down) key('keyup', c);
            ok(M().state === 'clear', `keys bot on wave 1 ${diff} ${two ? '2P' : '1P'}: ${M().state} after ${(f / 60).toFixed(0)} s, ${M().done}/${M().total} served`);
            o.log.push(`keys bot wave 1 ${diff} ${two ? '2P' : '1P'}: ${M().state} in ${(f / 60).toFixed(0)} s, ${M().lost} lives lost`);
          }
        }
      }
    } catch (err) {
      fails.push('the play check crashed: ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
    } finally {
      if (o.sabotage) JB.SABOTAGE[o.sabotage] = false;
      game.title();
    }
    return { ok: fails.length === 0, passed, failed: fails.length, fails, log: o.log, ms: Date.now() - t0 };
  }

  // the real check must pass, and each sabotage must make it fail
  function provePlayCheck() {
    const real = playCheck();
    const out = { real };
    for (const s of ['mirror', 'flipRows', 'stuckFill', 'stuckOops']) {
      const r = playCheck({ sabotage: s, quick: true });
      out[s] = { failed: r.failed, first: r.fails[0] || '' };
    }
    out.ok = real.ok && ['mirror', 'flipRows', 'stuckFill', 'stuckOops'].every((s) => out[s].failed > 0);
    return out;
  }

  Object.assign(window.game, { playCheck, provePlayCheck });
})();
