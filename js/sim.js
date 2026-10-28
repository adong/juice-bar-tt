/* The rules of TT Juice Bar, with no Three.js, so Node runs them too (tools/check.js) and the page only draws them.
   Four counters, rows 0-3 from the bottom of the screen up. x runs along a counter: the animals' door at 0, the
   juice tap at L. The servers stand behind the counters; the animals walk in at the door and head for the tap.
     M.step(dt, inputs)  runs the rules in fixed 1/240 s steps whatever dt is, so everything slides and stops the
                         same way at any frame rate. inputs[i] = { x: -1 / 0 / 1 walk, dy: counters to move
                         (+1 up, -1 down), fill: Space held, call: T pressed }.
   What happens goes into M.events, for the page's effects and sounds.
   JB.SABOTAGE flags break one rule on purpose, so the checks can prove they would catch it.
   Classic script: adds JB.Sim to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const TUNE = JB.TUNE;
  const SUB = 1 / 240;
  const SAB = (JB.SABOTAGE = JB.SABOTAGE || {});
  const LIVE = { enter: 1, walk: 1, drink: 1 }; // animals still at the counter (in the queue)
  const THIRSTY = { enter: 1, walk: 1 }; // animals that catch a full cup

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(o = {}) {
    const n = o.n || 0;
    const diff = o.diff === 'normal' ? 'normal' : 'easy';
    const D = TUNE.diff[diff];
    const lv = n % JB.LEVELS.length, loop = Math.floor(n / JB.LEVELS.length);
    const rand = rng(o.seed || 1234 + n * 77);
    const two = !!o.two;
    const heroes = o.heroes || ['teddy', 'tommy'];
    const M = {
      n, lv, loop, L: JB.LEVELS[lv], diff, D, two, rand,
      state: 'play', stateT: 0, time: 0, acc: 0, callDt: 0,
      lives: o.lives != null ? o.lives : two ? D.lives2 : D.lives,
      score: o.score || 0,
      servers: [], animals: [], cups: [], tips: [], buddies: [], events: [],
      queue: [], total: 0, done: 0, served: 0, dance: 0, oops: null, winner: 0, ids: 0,
      splashes: 0, tipsGot: 0, empties: 0, lost: 0, highFives: 0,
    };
    const rows = two ? [2, 1] : [1];
    (two ? heroes.slice(0, 2) : [heroes[0]]).forEach((id, i) => {
      M.servers.push({ i, id, row: rows[i], x: TUNE.L, fill: 0, held: false, boost: 0, dance: 0, walking: 0, sent: 0, caught: 0, tips: 0, served: 0, full: false });
    });
    if (!two) M.buddies.push({ id: heroes[1] || 'tommy', on: false, phase: '', t: 0, queue: 0, visits: 0, treat: null });

    // who comes in, and when
    const count = D.count[lv] + loop;
    const gap = D.gap[lv] / (1 + loop * 0.1);
    let t = 1.2;
    for (let k = 0; k < count; k++) {
      const A = JB.ANIMALS[Math.floor(rand() * JB.ANIMALS.length)];
      let thirst = 1;
      if (diff === 'normal') thirst = Math.min(2, 1 + A.thirst + (rand() < D.thirsty2 ? 1 : 0));
      M.queue.push({ t, A, thirst });
      t += gap * (0.75 + rand() * 0.5);
    }
    M.total = count;
    M.speed = D.speed[lv] * (1 + loop * TUNE.loopSpeed);

    M.step = (dt, inputs) => step(M, dt, inputs || []);
    M.callBuddy = (i) => callBuddy(M, i || 0);
    return M;
  }

  const ev = (M, type, o) => M.events.push(Object.assign({ type, t: M.time }, o));
  function setState(M, s) {
    M.state = s;
    M.stateT = 0;
  }

  // ---------------------------------------------------------------- one frame
  function step(M, dt, inputs) {
    M.callDt = dt;
    if (M.state === 'play' || M.state === 'oops') {
      inputs.forEach((inp, i) => { if (inp && inp.call && i < M.servers.length) callBuddy(M, i); });
    }
    if (M.state === 'play') {
      M.servers.forEach((s, i) => { if (inputs[i] && inputs[i].dy) moveRow(M, s, inputs[i].dy); });
    }
    M.acc += dt;
    while (M.acc >= SUB - 1e-9) {
      sub(M, SUB, inputs);
      M.acc -= SUB;
    }
  }

  function sub(M, dt, inputs) {
    M.time += dt;
    M.stateT += dt;
    for (const s of M.servers) {
      if (s.boost > 0) s.boost = Math.max(0, s.boost - dt);
      if (s.dance > 0) s.dance = Math.max(0, s.dance - dt);
    }
    if (M.state === 'clear' || M.state === 'over') {
      leavers(M, dt);
      return;
    }
    buddyStep(M, dt);
    if (M.state === 'oops') {
      // nothing moves, but letting go of the pour key now doesn't fire the cup later: he just keeps it
      M.servers.forEach((sv, i) => { sv.held = !!(inputs[i] && inputs[i].fill); });
      leavers(M, dt);
      if (!SAB.stuckOops && M.stateT >= TUNE.oopsT) setState(M, M.lives <= 0 ? 'over' : 'play');
      if (M.state === 'over') ev(M, 'over');
      return;
    }
    M.servers.forEach((s, i) => serverStep(M, s, inputs[i] || {}, dt));
    spawn(M);
    animalsStep(M, dt);
    cupsStep(M, dt);
    tipsStep(M, dt);
    if (M.dance > 0) M.dance = Math.max(0, M.dance - dt);
    checkClear(M);
  }

  // ---------------------------------------------------------------- servers
  function moveRow(M, s, dy) {
    if (SAB.flipRows) dy = -dy;
    const to = Math.max(0, Math.min(TUNE.ROWS - 1, s.row + Math.sign(dy)));
    if (to === s.row) {
      ev(M, 'bump', { i: s.i, dy: Math.sign(dy) });
      return;
    }
    ev(M, 'row', { i: s.i, from: s.row, to, fromX: s.x });
    s.row = to;
    s.x = TUNE.L; // switching counters puts you straight at that counter's tap
  }

  function serverStep(M, s, inp, dt) {
    let x = Math.sign(inp.x || 0);
    if (SAB.mirror) x = -x;
    if (SAB.stuckFill && inp.fill) x = 0;
    s.walking = x;
    if (x) s.x = Math.max(TUNE.xMin, Math.min(TUNE.L, s.x + x * TUNE.walkV * (s.boost > 0 ? TUNE.boostWalk : 1) * dt));
    const atTap = s.x >= TUNE.L - TUNE.tapR;
    const fillT = M.D.fillT * (s.boost > 0 ? TUNE.boostFill : 1);
    if (inp.fill && atTap && s.fill < 1) {
      s.fill = Math.min(1, s.fill + dt / fillT);
      if (s.fill >= 1) ev(M, 'full', { i: s.i, row: s.row });
    }
    if (inp.fill && !atTap && !s.held) ev(M, 'notTap', { i: s.i });
    if (!inp.fill && s.held && atTap && s.fill >= 1) {
      M.cups.push({ id: ++M.ids, row: s.row, x: TUNE.sendX, kind: 'full', by: s.i, magic: false, t: 0, state: 'slide' });
      s.fill = 0;
      s.sent++;
      ev(M, 'send', { i: s.i, row: s.row });
    }
    s.held = !!inp.fill;
    s.full = s.fill >= 1;
    // a tip on this counter, close enough to grab
    for (const tip of M.tips) {
      if (tip.gone || tip.row !== s.row || Math.abs(tip.x - s.x) > TUNE.tipR) continue;
      tip.gone = true;
      s.tips++;
      M.tipsGot++;
      M.score += TUNE.score.tip;
      s.dance = 0.9;
      M.dance = M.D.danceT; // everyone stops to watch the little dance
      ev(M, 'tip', { i: s.i, row: s.row, x: tip.x, points: TUNE.score.tip });
    }
  }

  // ---------------------------------------------------------------- animals
  function spawn(M) {
    const q = M.queue[0];
    if (!q || M.time < q.t) return;
    const per = M.D.perRow[M.lv] + (M.loop ? 1 : 0);
    let best = [], fewest = 1e9;
    for (let r = 0; r < TUNE.ROWS; r++) {
      const here = M.animals.filter((a) => a.row === r && LIVE[a.state]);
      if (here.length >= per || here.some((a) => a.x < TUNE.spacing - 0.9)) continue; // full, or someone in the doorway
      if (here.length < fewest) { fewest = here.length; best = [r]; } else if (here.length === fewest) best.push(r);
    }
    if (!best.length) return; // try again in a moment
    M.queue.shift();
    const row = best[Math.floor(M.rand() * best.length)];
    const a = {
      id: ++M.ids, kind: q.A.kind, A: q.A, row, x: -1.25, state: 'enter', t: M.rand() * TUNE.rhythm.walk, thirst: q.thirst, drunk: 0,
      slideLeft: 0, drinkT: 0, speed: M.speed * q.A.speed, leaveT: 0, by: 0, magicCup: false, cup: false, why: '',
    };
    M.animals.push(a);
    ev(M, 'enter', { id: a.id, row, kind: a.kind });
  }

  // the nearest animal in front of a (toward the tap) on its counter, still in the queue
  function ahead(M, a) {
    let b = null;
    for (const o of M.animals) if (o !== a && o.row === a.row && LIVE[o.state] && o.x > a.x && (!b || o.x < b.x)) b = o;
    return b;
  }
  function behind(M, a) {
    let b = null;
    for (const o of M.animals) if (o !== a && o.row === a.row && LIVE[o.state] && o.x < a.x && (!b || o.x > b.x)) b = o;
    return b;
  }

  function animalsStep(M, dt) {
    const R = TUNE.rhythm, cycle = R.walk + R.pause;
    for (const a of M.animals) {
      if (a.state === 'enter' || a.state === 'walk') {
        let v = 0;
        if (a.state === 'enter') v = TUNE.enterV;
        else {
          a.t += dt;
          if (a.t % cycle < R.walk) v = (a.speed * cycle) / R.walk;
        }
        if (M.dance > 0) v = 0;
        if (v) {
          const b = ahead(M, a);
          const nx = Math.min(a.x + v * dt, b ? b.x - TUNE.spacing : 1e9);
          if (nx > a.x) a.x = nx;
        }
        if (a.state === 'enter' && a.x >= 0.15) a.state = 'walk';
        if (a.state === 'walk' && a.x >= TUNE.endX) tooThirsty(M, a);
      } else if (a.state === 'drink') {
        if (a.slideLeft > 0) {
          const d = Math.min(a.slideLeft, M.D.slideV * a.A.slide * dt);
          const b = behind(M, a);
          if (b && b.state !== 'drink' && a.x - d - b.x < 0.95) a.slideLeft = 0; // bumped into the queue: stop there
          else {
            a.x -= d;
            a.slideLeft -= d;
            if (a.x < -0.4) { outTheDoor(M, a); continue; }
          }
        } else {
          a.drinkT -= dt;
          if (a.drinkT <= 0) finishDrink(M, a);
        }
      }
    }
    leavers(M, dt);
  }

  // animals on their way out: whoosh out the door, or float away on a balloon
  function leavers(M, dt) {
    for (const a of M.animals) {
      if (a.state === 'out') {
        a.x -= M.D.slideV * dt;
        a.leaveT += dt;
        if (a.x < -2.2) a.state = 'gone';
      } else if (a.state === 'float') {
        a.leaveT += dt;
        if (a.leaveT >= TUNE.floatT) a.state = 'gone';
      }
    }
  }

  function credit(M, a) {
    M.done++;
    M.served++;
    M.score += TUNE.score.served;
    const s = M.servers[a.by] || M.servers[0];
    if (!a.magicCup) s.served++;
  }
  function outTheDoor(M, a) {
    a.state = 'out';
    a.leaveT = 0;
    a.cup = false;
    a.why = 'out';
    credit(M, a);
    ev(M, 'out', { id: a.id, row: a.row, kind: a.kind, points: TUNE.score.served });
  }
  function finishDrink(M, a) {
    a.drunk++;
    a.cup = false;
    M.cups.push({ id: ++M.ids, row: a.row, x: a.x + 0.35, kind: 'empty', by: a.by, magic: a.magicCup, t: 0, state: 'slide' });
    ev(M, 'drank', { id: a.id, row: a.row, x: a.x });
    if (SAB.noEmpty) M.cups.pop();
    if (a.drunk >= a.thirst) {
      a.state = 'float';
      a.leaveT = 0;
      a.why = 'served';
      credit(M, a);
      ev(M, 'served', { id: a.id, row: a.row, x: a.x, kind: a.kind, points: TUNE.score.served });
    } else {
      a.state = 'walk';
      a.t = TUNE.rhythm.walk; // a little rest first
      ev(M, 'more', { id: a.id, row: a.row, x: a.x, kind: a.kind });
    }
  }
  function tooThirsty(M, a) {
    a.state = 'float';
    a.leaveT = 0;
    a.why = 'tap';
    M.done++;
    ev(M, 'thirsty', { id: a.id, row: a.row, kind: a.kind });
    loseLife(M, 'thirsty', a.row);
  }

  // ---------------------------------------------------------------- cups and tips
  function cupsStep(M, dt) {
    const fullMove = SAB.fpsCups ? (TUNE.cupV / 60) * (dt / Math.max(dt, M.callDt)) : TUNE.cupV * dt;
    for (const c of M.cups) {
      if (c.state !== 'slide') continue;
      c.t += dt;
      if (c.kind === 'full') {
        c.x -= fullMove;
        let best = null;
        for (const a of M.animals) if (a.row === c.row && THIRSTY[a.state] && a.x <= c.x + 0.05 && (!best || a.x > best.x)) best = a;
        if (best && c.x - best.x <= TUNE.catchR) {
          c.state = 'gone';
          best.state = 'drink';
          best.slideLeft = SAB.noSlideBack ? 0 : M.D.slide * best.A.slide;
          best.drinkT = M.D.drinkT;
          best.by = c.by;
          best.magicCup = c.magic;
          best.cup = true;
          M.score += TUNE.score.catch;
          ev(M, 'catch', { id: best.id, row: c.row, x: best.x, cup: c.id, magic: c.magic, points: TUNE.score.catch });
          if (M.rand() < M.D.tipP) {
            const tip = { id: ++M.ids, row: c.row, x: Math.max(1.2, Math.min(TUNE.L - 1.2, best.x + 0.2)), t: M.D.tipT, gone: false };
            M.tips.push(tip);
            ev(M, 'tipDrop', { row: tip.row, x: tip.x });
          }
          continue;
        }
        if (c.x < -TUNE.fallDoor) splash(M, c);
      } else {
        c.x += M.D.emptyV * dt;
        if (!SAB.noGrab) {
          const s = M.servers.find((o) => o.row === c.row && c.x >= o.x - TUNE.grabR);
          if (s) {
            c.state = 'gone';
            s.caught++;
            M.empties++;
            M.score += TUNE.score.empty;
            ev(M, 'grab', { i: s.i, row: c.row, x: c.x, points: TUNE.score.empty });
            continue;
          }
        }
        if (c.x > TUNE.L + TUNE.fall) splash(M, c);
      }
    }
    if (M.cups.length > 40) M.cups = M.cups.filter((c) => c.state === 'slide');
  }
  function splash(M, c) {
    c.state = 'gone';
    M.splashes++;
    const life = !c.magic && (M.D.splashLife || SAB.easySplash);
    ev(M, 'splash', { row: c.row, x: c.x, kind: c.kind, magic: c.magic, life });
    if (life) loseLife(M, 'splash', c.row);
  }
  function tipsStep(M, dt) {
    for (const tip of M.tips) {
      if (tip.gone) continue;
      tip.t -= dt;
      if (tip.t <= 0) {
        tip.gone = true;
        ev(M, 'tipGone', { row: tip.row, x: tip.x });
      }
    }
    if (M.tips.length > 20) M.tips = M.tips.filter((t) => !t.gone);
  }

  function loseLife(M, why, row) {
    M.lives = Math.max(0, M.lives - 1);
    M.lost++;
    M.oops = { why, row };
    setState(M, 'oops');
    ev(M, 'life', { why, row, lives: M.lives });
  }

  function checkClear(M) {
    const need = SAB.earlyClear ? M.total - 1 : M.total;
    if (M.state !== 'play' || M.noClear || M.queue.length > (SAB.earlyClear ? 1 : 0) || M.done < need) return;
    setState(M, 'clear');
    M.score += TUNE.score.wave;
    for (const c of M.cups) if (c.state === 'slide') { c.state = 'gone'; ev(M, 'pop', { row: c.row, x: c.x, kind: c.kind }); }
    for (const t of M.tips) if (!t.gone) { t.gone = true; ev(M, 'tipGone', { row: t.row, x: t.x }); }
    let w = 0;
    M.servers.forEach((s, i) => { if (s.served > M.servers[w].served) w = i; });
    M.winner = w;
    ev(M, 'clear', { winner: w, points: TUNE.score.wave });
  }

  // ---------------------------------------------------------------- the brother
  // 1 player: T calls the other brother (as often as you like, up to 3 waiting). He pops in, does his signature
  // move, tosses a treat (quicker pouring), then fills a cup and slides it down every counter at once.
  // 2 players: T is a high five, and both pour quicker for a bit.
  function callBuddy(M, i) {
    if (M.state !== 'play' && M.state !== 'oops') return false;
    if (M.two) {
      for (const s of M.servers) { s.boost = TUNE.highFiveT; s.dance = 0.7; }
      M.highFives++;
      ev(M, 'highfive', { i });
      return true;
    }
    const b = M.buddies[0];
    if (!b || b.queue >= TUNE.buddy.queue) return false;
    b.queue++;
    if (!b.on) {
      b.on = true;
      b.phase = 'in';
      b.t = 0;
      ev(M, 'buddyIn', { id: b.id });
    } else ev(M, 'buddyQueue', { id: b.id, queue: b.queue });
    return true;
  }
  function buddyStep(M, dt) {
    const B = TUNE.buddy;
    for (const b of M.buddies) {
      if (!b.on) continue;
      b.t += dt;
      const next = (p) => { b.phase = p; b.t = 0; };
      if (b.phase === 'in' && b.t >= B.inT) next('sig');
      else if (b.phase === 'sig' && b.t >= B.sigT) {
        b.treat = JB.TREATS[Math.floor(M.rand() * JB.TREATS.length)];
        next('treat');
        ev(M, 'treat', { id: b.id, emoji: b.treat[0], name: b.treat[1] });
      } else if (b.phase === 'treat' && b.t >= B.treatT) {
        M.servers[0].boost = TUNE.boostT;
        next('pour');
        ev(M, 'buddySay', { id: b.id });
      } else if (b.phase === 'pour' && b.t >= B.pourT) {
        for (let r = 0; r < TUNE.ROWS; r++) M.cups.push({ id: ++M.ids, row: r, x: TUNE.sendX, kind: 'full', by: 0, magic: true, t: 0, state: 'slide' });
        next('out');
        ev(M, 'buddyPour', { id: b.id });
      } else if (b.phase === 'out' && b.t >= B.outT) {
        b.queue = Math.max(0, b.queue - 1);
        b.visits++;
        if (b.queue > 0) next('in');
        else { b.on = false; b.phase = ''; }
        ev(M, 'buddyOut', { id: b.id, again: b.on });
      }
    }
  }

  // helpers for the autopilot and the checks
  const thirstyOn = (M, r) => M.animals.filter((a) => a.row === r && THIRSTY[a.state]);
  const cupsOn = (M, r, kind) => M.cups.filter((c) => c.row === r && c.state === 'slide' && c.kind === kind);

  JB.Sim = { create, SUB, DT: 1 / 120, thirstyOn, cupsOn, LIVE, THIRSTY };
})();
