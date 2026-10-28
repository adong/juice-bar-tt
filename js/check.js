/* The headless check of the rules, in Node (node tools/check.js) or in the page (game.check()). No Three.js.
     1 cups slide and stop by the same rules at any fps (20, 30, 60, 144 and a wobbly frame rate)
     2 animals catch a cup, drink and slide back (and a push past the door serves them too)
     3 empties come back and can be caught (and fall off if nobody is there)
     4 splashes cost a life only on NORMAL (and the brother's magic cups never do)
     5 a wave ends when every animal is served, and never before
   plus: the autopilot clears every wave on EASY and NORMAL, and random keys never take a server off the counters.
   JB.Check.sabotage() breaks one rule at a time (JB.SABOTAGE) and runs the check again: each must be caught.
   Classic script: adds JB.Check to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const TUNE = JB.TUNE;
  const Sim = JB.Sim;
  const SUB = Sim.SUB;
  const L = TUNE.L;

  const FPS = [20, 30, 60, 144, 'wobbly'];
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  // a bar with nobody in it yet (no one queued), for setting up a scene by hand. It only ends the wave with { clear: true }.
  function quietBar(o = {}) {
    const M = Sim.create(Object.assign({ diff: 'easy' }, o));
    M.queue.length = 0;
    M.total = 0;
    M.noClear = !o.clear;
    return M;
  }
  function addAnimal(M, row, x, o = {}) {
    const A = JB.ANIMALS.find((a) => a.kind === (o.kind || 'giraffe'));
    const a = {
      id: ++M.ids, kind: A.kind, A, row, x, state: 'walk', t: o.t || 0, thirst: o.thirst || 1, drunk: 0, slideLeft: 0, drinkT: 0,
      speed: o.speed != null ? o.speed : M.speed * A.speed, leaveT: 0, by: 0, magicCup: false, cup: false, why: '',
    };
    M.animals.push(a);
    M.total++;
    return a;
  }
  const addCup = (M, row, x, kind = 'full', magic = false) => {
    const c = { id: ++M.ids, row, x, kind, by: 0, magic, t: 0, state: 'slide' };
    M.cups.push(c);
    return c;
  };
  // runs M for `secs` at a frame rate; `each(M, frameNo)` can change the inputs; every event gets collected
  function run(M, fps, secs, inputs = () => [{}], until) {
    const log = [];
    let n = 0, wob = 0.37;
    while (M.time < secs) {
      let dt;
      if (fps === 'wobbly') { wob = (wob * 9301 + 49297) % 233280; dt = 1 / 200 + (wob / 233280) * (1 / 15 - 1 / 200); } else dt = 1 / fps;
      M.step(dt, inputs(M, n++));
      for (const e of M.events) log.push(e);
      M.events.length = 0;
      if (until && until(M, log)) break;
    }
    return log;
  }
  const first = (log, type, f) => log.find((e) => e.type === type && (!f || f(e)));

  function checkAll(o = {}) {
    const t0 = Date.now();
    const fails = [];
    const r = { fails, fps: 0, catches: 0, empties: 0, splashes: 0, soaks: [], keys: 0 };
    const ok = (cond, what) => { if (!cond) fails.push(what); return cond; };

    // ---------------------------------------------------------------- 1 the same at any fps
    // a lone cup: where it is after 1 s, and when it falls off the door end
    const lone = FPS.map((fps) => {
      const M = quietBar();
      const c = addCup(M, 0, TUNE.sendX);
      let x1 = null;
      const log = run(M, fps, 4, () => [{}], (m) => { if (x1 === null && m.time >= 1 - 1e-9) x1 = c.x + (m.time - 1) * TUNE.cupV; return c.state !== 'slide'; });
      return { fps, x1, splash: first(log, 'splash') };
    });
    for (const a of lone) {
      ok(a.splash && near(a.splash.t, lone[2].splash.t, 3 * SUB), `1 fps: a lone cup at ${a.fps} fps fell off at ${a.splash ? a.splash.t.toFixed(3) : 'never'} s, at 60 fps ${lone[2].splash && lone[2].splash.t.toFixed(3)} s`);
      ok(a.x1 !== null && near(a.x1, TUNE.sendX - TUNE.cupV, 0.08), `1 fps: a lone cup at ${a.fps} fps was at ${a.x1 && a.x1.toFixed(2)} after 1 s (should be ${(TUNE.sendX - TUNE.cupV).toFixed(2)})`);
      r.fps++;
    }
    // a whole round trip: a still animal catches it, slides back, drinks, sends the empty, the server grabs it
    const trips = FPS.map((fps) => {
      const M = quietBar();
      const a = addAnimal(M, 1, 6.5, { speed: 0 });
      addCup(M, 1, TUNE.sendX);
      const log = run(M, fps, 12, () => [{}], (m, lg) => !!first(lg, 'grab'));
      return { fps, M, a, catch: first(log, 'catch'), drank: first(log, 'drank'), grab: first(log, 'grab'), served: first(log, 'served') };
    });
    const T60 = trips[2];
    for (const tr of trips) {
      const tag = `1 fps: the round trip at ${tr.fps} fps`;
      if (!ok(tr.catch && tr.drank && tr.grab, `${tag} didn't finish (catch ${!!tr.catch}, drink ${!!tr.drank}, grab ${!!tr.grab})`)) continue;
      ok(near(tr.catch.t, T60.catch.t, 3 * SUB), `${tag}: caught at ${tr.catch.t.toFixed(3)} s, at 60 fps ${T60.catch.t.toFixed(3)} s`);
      ok(near(tr.drank.x, T60.drank.x, 0.03), `${tag}: stopped sliding at ${tr.drank.x.toFixed(3)}, at 60 fps ${T60.drank.x.toFixed(3)}`);
      ok(near(tr.drank.t, T60.drank.t, 4 * SUB), `${tag}: the empty came back at ${tr.drank.t.toFixed(3)} s, at 60 fps ${T60.drank.t.toFixed(3)} s`);
      ok(near(tr.grab.t, T60.grab.t, 4 * SUB), `${tag}: the empty was caught at ${tr.grab.t.toFixed(3)} s, at 60 fps ${T60.grab.t.toFixed(3)} s`);
      r.fps++;
    }
    // walking animals and a walking server cover the same ground at any fps
    const walks = FPS.map((fps) => {
      const M = quietBar();
      const a = addAnimal(M, 2, 0.5, { speed: 0.6 });
      M.servers[0].x = L;
      run(M, fps, 5, (m) => [{ x: m.time < 1 ? -1 : 0 }]);
      return { fps, ax: a.x, sx: M.servers[0].x };
    });
    for (const w of walks) {
      ok(near(w.ax, walks[2].ax, 0.02), `1 fps: an animal at ${w.fps} fps walked to ${w.ax.toFixed(3)}, at 60 fps ${walks[2].ax.toFixed(3)}`);
      ok(near(w.sx, walks[2].sx, TUNE.walkV / 15), `1 fps: the server at ${w.fps} fps walked to ${w.sx.toFixed(2)}, at 60 fps ${walks[2].sx.toFixed(2)}`);
      r.fps++;
    }
    // holding Space fills the cup in the same time at any fps
    for (const fps of FPS) {
      const M = quietBar();
      const log = run(M, fps, 3, () => [{ fill: true }], (m, lg) => !!first(lg, 'full'));
      const f = first(log, 'full');
      ok(f && near(f.t, M.D.fillT, 1 / 14), `1 fps: holding Space at ${fps} fps filled the cup at ${f ? f.t.toFixed(3) : 'never'} s (should be ${M.D.fillT} s)`);
      r.fps++;
    }

    // ---------------------------------------------------------------- 2 catch, drink, slide back
    for (const diff of ['easy', 'normal']) {
      for (const A of JB.ANIMALS) {
        const M = quietBar({ diff });
        const a = addAnimal(M, 1, 8, { speed: 0, kind: A.kind });
        addCup(M, 1, TUNE.sendX);
        const log = run(M, 60, 10, () => [{}], (m, lg) => !!first(lg, 'drank'));
        const c = first(log, 'catch'), d = first(log, 'drank');
        const slide = M.D.slide * A.slide;
        const tag = `2 ${diff} ${A.name}`;
        if (!ok(c && d, `${tag}: caught ${!!c}, drank ${!!d}`)) continue;
        ok(near(c.x, 8, 0.05), `${tag} caught the cup at ${c.x.toFixed(2)} (it stood at 8)`);
        ok(near(d.x, 8 - slide, 0.05), `${tag} slid back to ${d.x.toFixed(2)} (should be ${(8 - slide).toFixed(2)})`);
        ok(d.t - c.t >= M.D.drinkT - 1e-6, `${tag} drank for only ${(d.t - c.t).toFixed(2)} s`);
        ok(a.state === 'float' && M.done === 1 && M.served === 1, `${tag} with one cup wanted is ${a.state}, served ${M.served}`);
        const e = M.cups.find((k) => k.kind === 'empty' && k.state === 'slide');
        ok(e && near(e.x, d.x + 0.35, 0.05), `${tag}: no empty slid back from where it drank`);
        r.catches++;
      }
    }
    {
      // two cups wanted: back to walking after the first; the cup goes to the animal at the front
      const M = quietBar({ diff: 'normal' });
      const back = addAnimal(M, 0, 2, { speed: 0 });
      const front = addAnimal(M, 0, 6, { speed: 0.5, thirst: 2 });
      addCup(M, 0, TUNE.sendX);
      const log = run(M, 60, 8, () => [{}], (m, lg) => !!first(lg, 'more'));
      ok(first(log, 'catch') && first(log, 'catch').id === front.id, '2 a full cup went past the animal at the front of the queue');
      ok(first(log, 'more') && front.state === 'walk', `2 an animal that wants two cups is ${front.state} after the first (should walk again)`);
      ok(back.state === 'walk' && M.done === 0, '2 the animal at the back drank a cup that was not for it');
      const x0 = front.x;
      run(M, 60, 14);
      ok(front.x > x0 + 0.3, '2 a thirsty-again animal did not walk toward the tap');
      // a cup that pushes an animal right past the door: out it goes, served
      const P = quietBar();
      const a = addAnimal(P, 3, 1.0, { speed: 0, kind: 'penguin' });
      addCup(P, 3, TUNE.sendX);
      const lg2 = run(P, 60, 6, () => [{}], (m, lg) => !!first(lg, 'out'));
      ok(first(lg2, 'out') && P.done === 1 && P.served === 1 && !P.cups.some((k) => k.kind === 'empty'), `2 an animal pushed past the door is ${a.state} (should be out, served, no empty)`);
      // a drinker sliding back stops at the animal behind it
      const Q = quietBar();
      const b1 = addAnimal(Q, 2, 1.5, { speed: 0 });
      const f1 = addAnimal(Q, 2, 4, { speed: 0 });
      addCup(Q, 2, TUNE.sendX);
      const lg3 = run(Q, 60, 6, () => [{}], (m, lg) => !!first(lg, 'drank'));
      ok(first(lg3, 'drank') && f1.x - b1.x >= 0.9 && b1.x === 1.5, `2 a drinker slid through the animal behind it (${f1.x.toFixed(2)} vs ${b1.x.toFixed(2)})`);
      r.catches += 3;
    }

    // ---------------------------------------------------------------- 3 empties come back and can be caught
    for (const diff of ['easy', 'normal']) {
      const M = quietBar({ diff });
      const e = addCup(M, 1, 4, 'empty');
      const log = run(M, 60, 8, () => [{}], (m, lg) => !!first(lg, 'grab') || !!first(lg, 'splash'));
      const g = first(log, 'grab');
      ok(g && e.state === 'gone' && M.empties === 1 && M.score === TUNE.score.empty, `3 ${diff}: an empty sliding to the server at the tap was not caught`);
      ok(g && near(g.t, (L - TUNE.grabR - 4) / M.D.emptyV, 0.02), `3 ${diff}: the empty took ${g && g.t.toFixed(2)} s to come back`);
      // walk out to meet it: caught sooner, where he stands
      const W = quietBar({ diff });
      addCup(W, 1, 2, 'empty');
      const lw = run(W, 60, 8, (m) => [{ x: m.servers[0].x > 6 ? -1 : 0 }], (m, lg) => !!first(lg, 'grab') || !!first(lg, 'splash'));
      const gw = first(lw, 'grab');
      ok(gw && gw.x < 6.2, `3 ${diff}: walking out to meet an empty didn't catch it there (${gw ? gw.x.toFixed(2) : 'not caught'})`);
      // nobody on that counter: it slides off the end
      const N = quietBar({ diff });
      addCup(N, 3, 8, 'empty');
      const ln = run(N, 60, 8, () => [{}], (m, lg) => !!first(lg, 'splash'));
      ok(first(ln, 'splash') && !first(ln, 'grab') && N.empties === 0, `3 ${diff}: an empty on a counter with nobody at it was caught`);
      // step onto its counter in time and it's caught after all
      const U = quietBar({ diff });
      addCup(U, 2, 8, 'empty');
      const lu = run(U, 60, 8, (m, n) => [{ dy: n === 30 ? 1 : 0 }], (m, lg) => !!first(lg, 'grab') || !!first(lg, 'splash'));
      ok(first(lu, 'grab') && !first(lu, 'splash'), `3 ${diff}: moving up to the empty's counter didn't catch it`);
      r.empties += 4;
    }

    // ---------------------------------------------------------------- 4 splashes cost a life only on NORMAL
    for (const diff of ['easy', 'normal']) {
      for (const kind of ['full', 'empty']) {
        const M = quietBar({ diff });
        const lives = M.lives;
        addCup(M, 3, kind === 'full' ? TUNE.sendX : 9, kind);
        const log = run(M, 60, 6, () => [{}], (m, lg) => !!first(lg, 'splash'));
        const lost = lives - M.lives;
        ok(first(log, 'splash'), `4 ${diff}: a ${kind} cup didn't splash`);
        ok(lost === (diff === 'normal' ? 1 : 0), `4 ${diff}: a ${kind} cup's splash cost ${lost} lives (should be ${diff === 'normal' ? 1 : 0})`);
        if (diff === 'normal') {
          run(M, 60, M.time + TUNE.oopsT + 0.2);
          ok(M.state === 'play', `4 normal: the bar was still ${M.state} ${TUNE.oopsT + 0.2} s after a splash`);
        }
        r.splashes++;
      }
      // letting go of a full cup during the pause after a lost life keeps it in hand: nothing slides when play comes back
      if (diff === 'normal') {
        const P = quietBar({ diff });
        run(P, 60, 1, () => [{ fill: true }]);
        addCup(P, 3, -0.9, 'full');
        run(P, 60, P.time + 0.2, () => [{ fill: true }]);
        const inOops = P.state === 'oops';
        run(P, 60, P.time + TUNE.oopsT + 0.5);
        ok(inOops && P.state === 'play' && P.servers[0].sent === 0 && P.servers[0].fill >= 1, `4 normal: letting go during the pause slid ${P.servers[0].sent} cups afterwards (should keep the full cup)`);
      }
      // the brother's cups are magic: no life, on either level
      const B = quietBar({ diff });
      const lives = B.lives;
      addCup(B, 2, TUNE.sendX, 'full', true);
      addCup(B, 3, 10, 'empty', true);
      run(B, 60, 5);
      ok(B.lives === lives && B.splashes === 2, `4 ${diff}: magic cups cost ${lives - B.lives} lives`);
      // a thirsty animal that reaches the tap costs a life on both
      const Th = quietBar({ diff, clear: true });
      const lv = Th.lives;
      addAnimal(Th, 0, TUNE.endX - 0.3, { speed: 0.8 });
      run(Th, 60, 4);
      ok(Th.lives === lv - 1 && Th.done === 1 && Th.state === 'clear', `4 ${diff}: an animal that got to the tap cost ${lv - Th.lives} lives (should be 1), state ${Th.state}`);
      r.splashes++;
    }

    // ---------------------------------------------------------------- the brother
    {
      // 1 player: called three times in a row, he comes three times; each visit slides a cup down every counter
      const M = quietBar();
      for (let k = 0; k < 4; k++) M.callBuddy(0);
      const b = M.buddies[0];
      ok(b.on && b.queue === TUNE.buddy.queue, `companion: called 4 times, ${b.queue} visits waiting (should be ${TUNE.buddy.queue})`);
      const B = TUNE.buddy, visit = B.inT + B.sigT + B.treatT + B.pourT + B.outT;
      const log = run(M, 60, visit * 3 + 0.5);
      const pours = log.filter((e) => e.type === 'buddyPour').length;
      const rowsHit = new Set(M.cups.filter((c) => c.magic && c.kind === 'full').map((c) => c.row));
      ok(pours === 3 && !b.on && b.visits === 3, `companion: ${pours} pours in ${b.visits} visits (should be 3), still on: ${b.on}`);
      ok(rowsHit.size === TUNE.ROWS, `companion: his cups went down ${rowsHit.size} counters (should be all ${TUNE.ROWS})`);
      ok(first(log, 'treat') && first(log, 'buddySay'), 'companion: no treat or no "SAYS" before the pour');
      // and an animal on every counter gets one
      const A = quietBar();
      const zoo = [0, 1, 2, 3].map((row) => addAnimal(A, row, 7, { speed: 0 }));
      A.callBuddy(0);
      run(A, 60, visit + 2.5);
      ok(zoo.every((z) => z.drunk === 1 || z.state === 'drink'), `companion: animals on ${zoo.filter((z) => z.drunk || z.state === 'drink').length} of 4 counters got a cup`);
      // 2 players: T is a high five, no visit
      const H = quietBar({ two: true });
      H.callBuddy(1);
      ok(!H.buddies.length && H.highFives === 1 && H.servers.every((sv) => sv.boost > 0), 'companion: in 2 players T was not a high five');
    }

    // ---------------------------------------------------------------- 5 a wave ends when every animal is served
    {
      const M = quietBar({ clear: true });
      addAnimal(M, 0, 4, { speed: 0 });
      addAnimal(M, 2, 4, { speed: 0 });
      addCup(M, 0, TUNE.sendX);
      run(M, 60, 6);
      ok(M.state === 'play' && M.done === 1, `5 one of two animals served, the wave is ${M.state}`);
      addCup(M, 2, TUNE.sendX);
      const log = run(M, 60, 12, () => [{}], (m, lg) => !!first(lg, 'clear'));
      ok(first(log, 'clear') && M.done === 2 && M.state === 'clear', `5 both animals served, the wave is ${M.state}`);
    }
    const soaks = o.quick ? [[0, 'easy', false], [0, 'normal', false], [1, 'normal', true]] : null;
    const list = soaks || [];
    if (!soaks) for (let n = 0; n < JB.LEVELS.length + 1; n++) for (const diff of ['easy', 'normal']) for (const two of [false, true]) list.push([n, diff, two]);
    for (const [n, diff, two] of list) {
      const s = soak({ n, diff, two, seed: 7 + n });
      r.soaks.push(s);
      ok(s.result === 'clear', `5 the autopilot on wave ${n + 1} ${diff} ${two ? '2P' : '1P'}: ${s.result} after ${s.time} s, ${s.done}/${s.total} served`);
      ok(!s.early, `5 wave ${n + 1} ${diff} ${two ? '2P' : '1P'} ended with ${s.early} animals still to serve`);
    }

    // ---------------------------------------------------------------- random keys never take a server off the bar
    {
      let seed = 99;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const two of [false, true]) {
        const M = Sim.create({ n: 1, diff: 'normal', two, seed: 5 });
        M.lives = 999;
        for (let k = 0; k < (o.quick ? 3000 : 12000); k++) {
          const inp = M.servers.map(() => ({ x: Math.floor(rnd() * 3) - 1, dy: rnd() < 0.08 ? (rnd() < 0.5 ? -1 : 1) : 0, fill: rnd() < 0.5, call: rnd() < 0.002 }));
          M.step(1 / 60, inp);
          M.events.length = 0;
          r.keys++;
          for (const s of M.servers) {
            if (!(s.row >= 0 && s.row < TUNE.ROWS && s.x >= TUNE.xMin - 1e-9 && s.x <= L + 1e-9 && s.fill >= 0 && s.fill <= 1)) {
              fails.push(`random keys: a server got to row ${s.row}, x ${s.x}, fill ${s.fill}`);
              k = 1e9;
              break;
            }
          }
          if (M.state === 'clear') { M.state = 'play'; M.queue.push({ t: M.time + 1, A: JB.ANIMALS[0], thirst: 1 }); M.total++; }
        }
      }
    }
    r.ms = Date.now() - t0;
    r.ok = fails.length === 0;
    return r;
  }

  // The autopilot plays a whole wave. `early` counts animals still unserved if the wave said it was over.
  function soak(o = {}) {
    const M = Sim.create({ n: o.n || 0, diff: o.diff || 'easy', two: !!o.two, seed: o.seed || 1, heroes: o.two ? ['teddy', 'tommy'] : ['teddy', 'tommy'] });
    let early = 0, calls = 0;
    const step = 1 / 60;
    while (M.time < 400 && M.state !== 'clear' && M.state !== 'over') {
      const inp = M.servers.map((s, i) => JB.Bot.think(M, i, { buddy: !!o.buddy }));
      calls += inp.filter((x) => x.call).length;
      M.step(step, inp);
      for (const e of M.events) if (e.type === 'clear' && (M.done < M.total || M.queue.length)) early = M.total - M.done;
      M.events.length = 0;
    }
    return {
      n: M.n, name: M.L.name, diff: M.diff, two: M.two, result: M.state === 'clear' ? 'clear' : M.state === 'over' ? 'over' : 'stuck',
      time: Math.round(M.time), done: M.done, total: M.total, lives: M.lives, lost: M.lost, splashes: M.splashes, tips: M.tipsGot, score: M.score, early, calls,
    };
  }

  // each broken rule, and the check that must catch it
  const BREAKS = [
    ['fpsCups', 'cups slide by the frame, not by the clock', '1 '],
    ['noSlideBack', 'animals drink without sliding back', '2 '],
    ['noEmpty', 'no empty comes back after a drink', '2 '],
    ['noGrab', 'empties can never be caught', '3 '],
    ['easySplash', 'splashes cost a life on EASY too', '4 '],
    ['earlyClear', 'the wave ends one animal early', '5 '],
  ];
  function sabotage(o = {}) {
    const out = [];
    for (const [flag, what, tag] of BREAKS) {
      JB.SABOTAGE[flag] = true;
      let r;
      try { r = checkAll({ quick: true }); } finally { JB.SABOTAGE[flag] = false; }
      const hit = r.fails.filter((f) => f.startsWith(tag));
      out.push({ flag, what, caught: hit.length > 0, fails: r.fails.length, first: hit[0] || r.fails[0] || '' });
    }
    return out;
  }

  JB.Check = { checkAll, sabotage, soak, quietBar, addAnimal, addCup, run, BREAKS };
})();
