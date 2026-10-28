/* The game you see: scene, camera, the servers, the animals, the cups, effects, the HUD, menus, the companion's
   visits, the main loop and the window.game test hooks. It only reads the rules' state (js/sim.js) and turns their
   events into effects and sounds.
   Sections: setup · world · characters · effects · events · camera · HUD · screens · flow · loop · input · boot · hooks */
(function () {
  'use strict';
  const JB = window.JB;
  const T = THREE;
  const gfx = Kit.gfx;
  const People = Kit.people;
  const A = JB.Art;
  const Sim = JB.Sim;
  const TUNE = JB.TUNE, L = TUNE.L;
  const { wx, rowY, rowZ, TOP, BEHIND } = A;
  const $ = (id) => document.getElementById(id);
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const tr = (s) => (Kit.lang ? Kit.lang.t(s) : s);
  const nameOf = (id) => Kit.roster.get(id).name;
  const SIZE = { teddy: 0.88, tommy: 0.8 }; // the servers (the kit's people are 2 m tall)
  const ANIMAL_SIZE = { bunny: 0.88, giraffe: 0.86, hippo: 1.02, penguin: 0.96 };
  const SERVER_DX = -0.3; // a server at the tap stands just left of the jug
  const BUDDY_AT = new T.Vector3(wx(L + 0.85), 0, 1.2); // the visiting brother pops up in front of the bottom counter, by the taps

  // ---------------------------------------------------------------- saved settings
  const SAVE_KEY = 'juiceBarTT.v1';
  const saved = { diff: 'easy', hero: 'teddy', wave: 0, unlocked: 0, best: { easy: 0, normal: 0 }, served: 0 };
  try { Object.assign(saved, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  saved.best = Object.assign({ easy: 0, normal: 0 }, saved.best);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ } };

  // ---------------------------------------------------------------- state
  const G = {
    screen: 'loading', two: false, diff: saved.diff === 'normal' ? 'normal' : 'easy', hero: saved.hero === 'tommy' ? 'tommy' : 'teddy',
    wave: Math.min(saved.wave || 0, saved.unlocked || 0), M: null, attract: false, phase: 'intro', phaseT: 0, time: 0,
    hold: false, autoPause: true, run: null, touch: false, bannerT: 0, after: null, afterT: 0, camKey: '', modeFocus: 0,
    letGo: 0, notTapT: 0, lastInputs: [],
  };

  // ---------------------------------------------------------------- setup
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 1, 500);
  const hemi = new T.HemisphereLight('#ffffff', '#9a7a68', 0.8);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e0', 0.95);
  sun.position.set(-6, 22, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.bias = -0.0006;
  sun.target.position.set(0, 2, -4);
  scene.add(sun);
  scene.add(sun.target);

  const fx = {
    puffs: A.SpritePool(scene, 120, A.puffTexture()),
    drops: A.SpritePool(scene, 160, A.puffTexture()),
    stars: A.SpritePool(scene, 60, gfx.emojiTexture('⭐')),
    sparks: A.SpritePool(scene, 60, gfx.emojiTexture('✨')),
    notes: A.SpritePool(scene, 30, gfx.emojiTexture('🎵')),
    confetti: A.Confetti(scene, 2400),
    words: [],
    flyers: [],
  };
  let thumbs = {};

  // ---------------------------------------------------------------- world
  const world = { B: null, servers: [], buddy: null, animals: new Map(), cups: new Map(), tips: new Map(), streams: [], lv: -1 };

  function disposeTree(o) {
    o.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
      for (const m of ms) {
        if (m.map && !m.map.userData.keep) m.map.dispose();
        m.dispose();
      }
    });
  }
  function drop(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    disposeTree(o);
  }
  function clearWorld() {
    if (world.B) drop(world.B.root);
    for (const v of world.servers) { drop(v.root); drop(v.cup); }
    if (world.buddy) drop(world.buddy.root);
    for (const v of world.animals.values()) drop(v.root);
    for (const c of world.cups.values()) drop(c);
    for (const c of world.tips.values()) drop(c);
    for (const w of fx.words) scene.remove(w.s);
    for (const f of fx.flyers) scene.remove(f.s);
    fx.words.length = fx.flyers.length = 0;
    for (const k of ['puffs', 'drops', 'stars', 'sparks', 'notes', 'confetti']) fx[k].clear();
    for (const st of world.streams) st.visible = false;
    world.servers = [];
    world.buddy = null;
    world.animals.clear();
    world.cups.clear();
    world.tips.clear();
    world.B = null;
  }

  function buildWorld(M) {
    clearWorld();
    const theme = M.L.theme;
    world.B = A.buildBar(theme);
    scene.add(world.B.root);
    scene.background = new T.Color(theme.sky);
    hemi.intensity = theme.night ? 0.62 : 0.8;
    sun.intensity = theme.night ? 0.6 : 0.95;
    document.body.style.background = theme.wall;
    world.servers = M.servers.map((s, i) => makeServer(s.id, M.two ? i : -1, i));
    if (M.buddies.length) {
      const b = M.buddies[0];
      world.buddy = makeServer(b.id, 2, 0, (SIZE[b.id] || 0.8) * 1.08);
      world.buddy.root.visible = false;
    }
    G.camKey = '';
  }

  // ---------------------------------------------------------------- characters
  function makeServer(id, tagIdx, i, scale) {
    const entry = Kit.roster.get(id);
    const p = People.build(entry.look);
    // a juice-bar apron
    const apron = new T.Mesh(new T.BoxGeometry(0.66, 0.52, 0.03), gfx.std('#ffffff', { roughness: 0.8 }));
    apron.position.set(0, 0.2, -0.2);
    p.hips.add(apron);
    const pocket = new T.Mesh(new T.BoxGeometry(0.3, 0.16, 0.035), gfx.std(i === 1 ? '#ff6f91' : '#ff9a1f'));
    pocket.position.set(0, 0.12, -0.215);
    p.hips.add(pocket);
    const root = new T.Group();
    root.add(p.root);
    const sc = scale || SIZE[id] || 0.74;
    p.root.scale.setScalar(sc);
    scene.add(root);
    let tag = null;
    if (tagIdx === 0 || tagIdx === 1 || tagIdx === 2) {
      tag = gfx.nameTag(entry.name, tagIdx === 0 ? '#8cc2ff' : tagIdx === 1 ? '#ffb0b0' : entry.tag || '#ffb02e');
      tag.position.y = 2.15 * sc + 0.3;
      tag.scale.multiplyScalar(0.5);
      root.add(tag);
    }
    const ball = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('🏀'), transparent: true, depthWrite: false }));
    ball.scale.setScalar(0.5);
    ball.visible = false;
    root.add(ball);
    const cup = A.makeCup(JB.JUICES[0].color);
    cup.visible = false;
    scene.add(cup);
    return { root, p, entry, scale: sc, ph: 0, ang: Math.PI, tag, ball, cup, sendT: 0, hop: 0, pos: null, row: -1 };
  }

  function turnTo(v, target, dt, rate = 12) {
    let d = target - v.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.ang += d * damp(rate, dt);
    v.p.root.rotation.y = v.ang;
  }
  // a person faces -z: these turn him to face right (toward the taps), left (toward the doors) or the camera
  const RIGHT = -Math.PI / 2 - 0.55, LEFT = Math.PI / 2 + 0.55, FRONT = Math.PI;

  // the winner's signature move: Teddy shadow-boxes then sinks a jump shot; Tommy does his Y pose
  function celebrate(v, t, k) {
    const sig = v.entry.signature || ['wave'];
    v.p.root.position.y = 0;
    v.ball.visible = false;
    if (sig.includes('jumpshot')) {
      if (t < 1.6) People.pose(v.p, t * 9, 'boxing', k);
      else {
        const j = ((t - 1.6) % 1.6) / 1.6;
        People.pose(v.p, t * 6, 'jumpshot', k);
        v.p.root.position.y = Math.sin(Math.min(1, j * 2) * Math.PI) * 0.4;
        v.ball.visible = true;
        if (j > 0.35) {
          const b = (j - 0.35) / 0.65;
          v.ball.position.set(Math.sin(b * Math.PI) * 0.2, 1.5 + b * 2 - b * b * 1.1, 0.3);
        } else v.ball.position.set(0, 1.45 + v.p.root.position.y, 0.3);
      }
    } else {
      People.pose(v.p, t * 7, sig[0], k);
      v.p.root.position.y = Math.abs(Math.sin(t * 5)) * 0.16;
    }
  }

  function syncServers(M, dt) {
    const k = damp(18, dt);
    M.servers.forEach((s, i) => {
      const v = world.servers[i];
      if (!v) return;
      const shared = M.two && M.servers[1 - i].row === s.row && Math.abs(M.servers[1 - i].x - s.x) < 0.6;
      const tx = wx(s.x) + SERVER_DX + (shared ? (i === 0 ? 0.35 : -0.35) : 0), ty = rowY(s.row), tz = rowZ(s.row) + BEHIND - (shared && i === 1 ? 0.25 : 0);
      if (!v.pos || v.row !== s.row) {
        if (v.pos && v.row >= 0) v.hop = 1; // a quick hop to the next counter
        if (!v.pos) v.pos = new T.Vector3(tx, ty, tz);
        v.row = s.row;
      }
      // walking along a counter is followed straight away; a hop between counters takes a moment
      const fast = v.hop > 0 ? damp(30, dt) : 1;
      v.pos.x += (tx - v.pos.x) * (v.hop > 0 ? fast : 1);
      v.pos.y += (ty - v.pos.y) * fast;
      v.pos.z += (tz - v.pos.z) * fast;
      if (v.hop > 0) v.hop = Math.max(0, v.hop - dt * 6);
      v.root.position.set(v.pos.x, v.pos.y + Math.sin(v.hop * Math.PI) * 0.45, v.pos.z);
      v.ball.visible = false;
      const atTap = s.x >= L - TUNE.tapR;
      const pouring = s.held && atTap && s.fill < 1 && M.state === 'play' && G.phase === 'play';
      v.ph += dt * 10;
      v.sendT = Math.max(0, v.sendT - dt);
      if (M.state === 'clear' && G.phase === 'play' && i === M.winner && !G.attract) {
        turnTo(v, FRONT, dt);
        celebrate(v, M.stateT, k);
      } else if (M.state === 'over') {
        turnTo(v, FRONT, dt);
        People.pose(v.p, v.ph, 'stand', k);
        v.p.head.rotation.x = 0.35;
      } else if (s.dance > 0) {
        v.ang += dt * 14;
        v.p.root.rotation.y = v.ang;
        People.pose(v.p, v.ph, 'wave', k);
      } else if (v.sendT > 0) {
        turnTo(v, LEFT, dt, 25);
        People.pose(v.p, v.ph, 'give', 1 - Math.exp(-30 * dt));
      } else if (s.walking) {
        turnTo(v, s.walking > 0 ? RIGHT : LEFT, dt, 18);
        People.pose(v.p, v.ph * 1.3, 'run', k);
      } else if (pouring || (s.held && atTap)) {
        turnTo(v, RIGHT + 0.2, dt);
        People.pose(v.p, v.ph, 'grab', k);
      } else {
        turnTo(v, FRONT, dt, 8);
        People.pose(v.p, v.ph * 0.3, 'stand', k);
      }
      if (M.state !== 'over') v.p.head.rotation.x *= 1 - k;
      // the cup he's filling sits on the counter under the spout
      const show = s.fill > 0 && atTap;
      v.cup.visible = show;
      if (show) {
        v.cup.setColor(JB.JUICES[s.row].color);
        v.cup.setFill(s.fill);
        v.cup.position.set(wx(TUNE.sendX), rowY(s.row) + TOP, rowZ(s.row));
        v.cup.scale.setScalar(s.fill >= 1 ? 1 + Math.sin(G.time * 14) * 0.05 : 1);
      }
      // the juice pouring out of the jug
      const st = streamFor(i);
      st.visible = pouring;
      if (pouring) st.position.set(wx(TUNE.sendX), rowY(s.row) + TOP + 0.55, rowZ(s.row) - 0.02), st.material.color.set(JB.JUICES[s.row].color);
    });
    // the counter you're at glows a little
    if (world.B) world.B.rows.forEach((R, r) => {
      const here = M.servers.some((s) => s.row === r) && !G.attract;
      R.glow.material.opacity += ((here ? 0.35 + Math.sin(G.time * 4) * 0.08 : 0) - R.glow.material.opacity) * damp(10, dt);
      R.level.scale.y = 0.75 + 0.25 * Math.cos(G.time * 0.7 + r);
    });
  }
  function streamFor(i) {
    if (!world.streams[i]) {
      const m = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.5, 8), new T.MeshBasicMaterial({ color: '#ff9a1f' }));
      m.visible = false;
      scene.add(m);
      world.streams[i] = m;
    }
    return world.streams[i];
  }

  // the visiting brother: pops up on a crate by the taps, does his move, tosses a treat, then pours for everyone
  function syncBuddy(M, dt) {
    const v = world.buddy;
    if (!v) return;
    const b = M.buddies[0];
    const k = damp(14, dt);
    if (!b || !b.on) {
      v.root.visible = false;
      v.ball.visible = false;
      return;
    }
    v.root.visible = true;
    v.ph += dt * 10;
    const base = BUDDY_AT.clone();
    let pop = 1;
    if (b.phase === 'in') pop = Math.min(1, b.t / TUNE.buddy.inT);
    if (b.phase === 'out') pop = Math.max(0, 1 - b.t / TUNE.buddy.outT);
    v.root.scale.setScalar(Math.max(0.01, pop));
    v.root.position.copy(base);
    v.root.position.y += Math.sin(pop * Math.PI) * 0.6;
    v.ball.visible = false;
    if (b.phase === 'sig') {
      turnTo(v, FRONT, dt, 20);
      celebrate(v, b.t, k);
    } else if (b.phase === 'treat') {
      turnTo(v, LEFT, dt, 20);
      People.pose(v.p, v.ph, 'give', k);
    } else if (b.phase === 'pour') {
      turnTo(v, LEFT, dt, 20);
      People.pose(v.p, v.ph, 'grab', k);
      v.p.armL.rotation.x += (-2.6 - v.p.armL.rotation.x) * k;
      v.p.armR.rotation.x += (-2.6 - v.p.armR.rotation.x) * k;
    } else {
      turnTo(v, FRONT, dt, 12);
      People.pose(v.p, v.ph, 'wave', k);
    }
  }

  function syncAnimals(M, dt) {
    const seen = new Set();
    for (const a of M.animals) {
      if (a.state === 'gone') continue;
      seen.add(a.id);
      let v = world.animals.get(a.id);
      if (!v) {
        const o = A.makeAnimal(a.kind);
        const root = new T.Group();
        root.add(o.root);
        o.root.scale.setScalar(ANIMAL_SIZE[a.kind] || 0.85);
        const cup = A.makeCup(JB.JUICES[a.row].color);
        cup.visible = false;
        cup.position.set(0, -0.2, 0.42);
        cup.rotation.x = -0.55;
        o.head.add(cup);
        const balloon = A.makeBalloon(a.id);
        balloon.visible = false;
        balloon.position.set(0.25, o.H * 0.85, 0);
        o.root.add(balloon);
        scene.add(root);
        v = { root, o, cup, balloon, ang: 0.9, ph: Math.random() * 6, last: a.state, sx: 1 };
        world.animals.set(a.id, v);
      }
      const o = v.o;
      const k = damp(14, dt);
      v.ph += dt * (a.kind === 'bunny' ? 9 : 7);
      let x = a.x, y = rowY(a.row), lift = 0;
      let face = 0.95, armL = 0, armR = 0, legs = 0, bob = 0, headX = 0, spin = 0;
      v.cup.visible = a.cup;
      v.balloon.visible = a.state === 'float';
      const moving = (a.state === 'walk' || a.state === 'enter') && M.dance <= 0 && M.state === 'play' && (a.state === 'enter' || a.t % (TUNE.rhythm.walk + TUNE.rhythm.pause) < TUNE.rhythm.walk);
      if (moving) {
        legs = Math.sin(v.ph) * 0.6;
        bob = a.kind === 'bunny' ? Math.abs(Math.sin(v.ph * 0.5)) * 0.28 : Math.abs(Math.sin(v.ph)) * 0.06;
        armL = -legs * 0.6;
        armR = legs * 0.6;
        if (a.kind === 'penguin') spin = Math.sin(v.ph) * 0.15;
      } else if (a.state === 'walk' || a.state === 'enter') {
        // having a look around, or watching the dance
        face = M.dance > 0 ? 0.3 : 0.95 + Math.sin(G.time * 2 + a.id) * 0.25;
        if (M.dance > 0) { bob = Math.abs(Math.sin(G.time * 9 + a.id)) * 0.2; armL = armR = -2.6 + Math.sin(G.time * 9) * 0.3; }
      } else if (a.state === 'drink') {
        face = 0.55;
        armR = -2.2;
        headX = a.slideLeft > 0 ? 0.1 : -0.35 + Math.sin(G.time * 12) * 0.05;
        if (a.slideLeft > 0) spin = Math.sin(G.time * 20) * 0.08; // whoosh, backwards
      } else if (a.state === 'float') {
        if (a.why === 'tap' && a.leaveT < 1.0) {
          // drinking straight from the jug!
          x = L + 0.1;
          face = 1.4;
          headX = -0.4 + Math.sin(G.time * 16) * 0.08;
          armL = armR = -2.4;
        } else {
          const t = Math.max(0, a.leaveT - (a.why === 'tap' ? 1.0 : 0));
          lift = t * t * 1.4 + t * 0.8;
          face = 0.2 + Math.sin(G.time * 3) * 0.3;
          armL = -2.8 + Math.sin(G.time * 8) * 0.4;
          legs = Math.sin(G.time * 6) * 0.3;
        }
      } else if (a.state === 'out') {
        spin = G.time * 16;
        face = -1;
      }
      v.root.position.set(wx(x), y + lift + bob, rowZ(a.row) + BEHIND + 0.05);
      v.ang += (face - v.ang) * k;
      o.root.rotation.y = v.ang + spin;
      o.root.visible = !(a.state === 'out' && a.x < -1.9);
      if (o.legs[0]) { o.legs[0].rotation.x += (legs - o.legs[0].rotation.x) * k; }
      if (o.legs[1]) { o.legs[1].rotation.x += (-legs - o.legs[1].rotation.x) * k; }
      if (o.arms[0]) o.arms[0].rotation.x += (armL - o.arms[0].rotation.x) * k;
      if (o.arms[1]) o.arms[1].rotation.x += (armR - o.arms[1].rotation.x) * k;
      o.head.rotation.x += (headX - o.head.rotation.x) * k;
      if (a.kind === 'bunny') {
        const flop = moving ? Math.sin(v.ph) * 0.15 : 0;
        if (o.head.userData['ear-1']) o.head.userData['ear-1'].rotation.x = flop;
        if (o.head.userData.ear1) o.head.userData.ear1.rotation.x = -flop;
      }
      v.last = a.state;
    }
    for (const [id, v] of world.animals) if (!seen.has(id)) { drop(v.root); world.animals.delete(id); }
  }

  function syncCups(M, dt) {
    const seen = new Set();
    for (const c of M.cups) {
      if (c.state !== 'slide') continue;
      seen.add(c.id);
      let m = world.cups.get(c.id);
      if (!m) {
        m = A.makeCup(JB.JUICES[c.row].color);
        if (c.magic) {
          const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('✨'), transparent: true, depthWrite: false }));
          s.scale.setScalar(0.4);
          s.position.set(0.15, 0.55, 0);
          m.add(s);
        }
        m.setFill(c.kind === 'full' ? 1 : 0);
        scene.add(m);
        world.cups.set(c.id, m);
      }
      m.position.set(wx(c.x), rowY(c.row) + TOP, rowZ(c.row));
      // over the edge: it tips and drops
      const over = c.kind === 'full' ? -0.5 - c.x : c.x - (L + 0.95);
      m.rotation.z = over > 0 ? (c.kind === 'full' ? 1 : -1) * over * 2.5 : Math.sin(G.time * 20 + c.id) * 0.04;
      if (over > 0) m.position.y -= over * over * 3;
    }
    for (const [id, m] of world.cups) if (!seen.has(id)) { drop(m); world.cups.delete(id); }
    // tips: spinning coins on the counter
    const tseen = new Set();
    for (const t of M.tips) {
      if (t.gone) continue;
      tseen.add(t.id);
      let m = world.tips.get(t.id);
      if (!m) {
        m = A.makeCoin();
        scene.add(m);
        world.tips.set(t.id, m);
      }
      m.position.set(wx(t.x), rowY(t.row) + TOP + 0.3 + Math.sin(G.time * 5 + t.id) * 0.06, rowZ(t.row) - 0.1);
      m.rotation.y = G.time * 4;
      m.visible = t.t > 2 || Math.sin(G.time * 18) > 0; // blinks before it goes
    }
    for (const [id, m] of world.tips) if (!tseen.has(id)) { drop(m); world.tips.delete(id); }
  }

  function syncFriends(M, dt) {
    if (!world.B) return;
    world.B.friends.forEach((f, i) => {
      const party = M.dance > 0 || (M.state === 'clear' && !G.attract);
      const t = G.time * (party ? 9 : 2.5) + i * 1.7;
      f.body.position.y = party ? Math.abs(Math.sin(t)) * 0.35 : Math.abs(Math.sin(t)) * 0.04;
      f.body.rotation.y = party ? Math.sin(t * 0.5) * 0.8 : 0;
      const up = party ? -2.7 + Math.sin(t) * 0.3 : -0.2 + Math.sin(t) * 0.1;
      if (f.arms[0]) f.arms[0].rotation.x += (up - f.arms[0].rotation.x) * damp(12, dt);
      if (f.arms[1]) f.arms[1].rotation.x += ((party ? -2.7 - Math.sin(t) * 0.3 : -0.2) - f.arms[1].rotation.x) * damp(12, dt);
      if (party && Math.random() < dt * 3) {
        const p = new T.Vector3();
        f.root.getWorldPosition(p);
        fx.notes.spawn(p.x + (Math.random() - 0.5), p.y + 1.8, p.z, { life: 1.2, vy: 1.2, vx: (Math.random() - 0.5) * 0.6, size: 0.45 });
      }
    });
  }

  // ---------------------------------------------------------------- effects
  function word(text, x, y, z, o = {}) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: A.word(tr(text), o.fill, o.stroke), transparent: true, depthWrite: false, depthTest: false }));
    const sz = o.size || 1.5;
    s.scale.set(sz * 3.2, sz, 1);
    s.position.set(x, y, z + 0.6);
    s.renderOrder = 10;
    scene.add(s);
    fx.words.push({ s, t: 0, life: o.life || 1.1, y, sz });
  }
  function updateWords(dt) {
    for (let k = fx.words.length - 1; k >= 0; k--) {
      const w = fx.words[k];
      w.t += dt;
      const p = w.t / w.life;
      const pop = p < 0.15 ? 0.5 + (p / 0.15) * 0.6 : 1.1 - Math.min(0.1, (p - 0.15) * 0.3);
      w.s.scale.set(w.sz * 3.2 * pop, w.sz * pop, 1);
      w.s.position.y = w.y + p * 0.8;
      w.s.material.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      if (w.t >= w.life) { scene.remove(w.s); w.s.material.dispose(); fx.words.splice(k, 1); }
    }
  }
  function flyer(emoji, from, to, dur, done) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), transparent: true, depthWrite: false }));
    s.scale.setScalar(0.7);
    scene.add(s);
    fx.flyers.push({ s, from: from.clone(), to: to.clone(), t: 0, dur, done });
  }
  function updateFlyers(dt) {
    for (let k = fx.flyers.length - 1; k >= 0; k--) {
      const f = fx.flyers[k];
      f.t += dt;
      const p = Math.min(1, f.t / f.dur);
      f.s.position.lerpVectors(f.from, f.to, p);
      f.s.position.y += Math.sin(p * Math.PI) * 2;
      f.s.material.rotation = p * 8;
      if (p >= 1) { scene.remove(f.s); f.s.material.dispose(); fx.flyers.splice(k, 1); if (f.done) f.done(); }
    }
  }
  function puff(x, y, z, n = 6, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      fx.puffs.spawn(x, y, z + 0.3, { life: 0.6, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.0 + 0.6, size: o.size || 0.45, grow: 0.8, color: o.color });
    }
  }
  function splashFx(x, y, z, color) {
    for (let k = 0; k < 22; k++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      fx.drops.spawn(x, y + 0.2, z + 0.3, { life: 0.7 + Math.random() * 0.4, vx: Math.cos(a) * s, vy: 2 + Math.random() * 4, vz: Math.sin(a) * 0.6, g: 12, size: 0.16 + Math.random() * 0.14, color });
    }
  }
  function stars(x, y, z, n = 6) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      fx.stars.spawn(x, y, z + 0.4, { life: 0.8, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 + 1, size: 0.35, g: 3 });
    }
  }

  // ---------------------------------------------------------------- events
  const sfx = (name, ...a) => { if (!G.attract) JB.Sfx.play(name, ...a); };
  const cupAt = (row, x) => new T.Vector3(wx(x), rowY(row) + TOP + 0.5, rowZ(row));
  const headOf = (i) => {
    const v = world.servers[i];
    return v ? v.root.position.clone().add(new T.Vector3(0, 1.9 * v.scale, 0)) : new T.Vector3();
  };
  const YUM = ['YUM!', 'THANKS!', 'SLURP!', 'YUMMY!'];

  function handleEvents(M) {
    const evs = M.events.splice(0);
    for (const e of evs) {
      switch (e.type) {
        case 'row': sfx('row', e.to > e.from); break;
        case 'bump': sfx('bump'); break;
        case 'full':
          sfx('full');
          if (!G.attract && G.letGo < 3 && !M.two) {
            G.letGo++;
            const p = cupAt(e.row, TUNE.sendX);
            word('LET GO!', p.x - 0.6, p.y + 0.9, p.z, { size: 0.8, life: 0.9, fill: '#ffffff', stroke: '#2fc27a' });
          }
          break;
        case 'notTap':
          if (!G.attract && G.time > G.notTapT) {
            G.notTapT = G.time + 4;
            toast('POUR AT THE TAP →');
          }
          break;
        case 'send': {
          sfx('send');
          const v = world.servers[e.i];
          if (v) v.sendT = 0.25;
          const p = cupAt(e.row, TUNE.sendX);
          puff(p.x, p.y - 0.3, p.z, 4, { size: 0.3 });
          break;
        }
        case 'catch': {
          sfx('catch');
          const p = cupAt(e.row, e.x);
          word(`+${e.points}`, p.x, p.y + 1.3, p.z, { size: 0.6, life: 0.8, fill: '#ffffff', stroke: '#3d8bff' });
          break;
        }
        case 'drank': sfx('empty'); break;
        case 'more': {
          const p = cupAt(e.row, e.x);
          word('MORE!', p.x, p.y + 1.6, p.z, { size: 0.8, life: 1.0, fill: '#ffffff', stroke: '#ff9a1f' });
          break;
        }
        case 'served': {
          sfx('served');
          const p = cupAt(e.row, e.x);
          word(YUM[e.id % YUM.length], p.x, p.y + 1.7, p.z, { size: 0.9, life: 1.1 });
          if (!G.attract) fx.confetti.burst(p.x, p.y + 1, p.z, 40, 3);
          break;
        }
        case 'out': {
          sfx('whee');
          const p = cupAt(e.row, -0.5);
          word('WHEEE!', p.x + 0.6, p.y + 1.6, p.z, { size: 0.9, life: 1.1, fill: '#ffffff', stroke: '#a46bff' });
          if (!G.attract) fx.confetti.burst(p.x, p.y + 1, p.z, 40, 3);
          break;
        }
        case 'thirsty': {
          sfx('gulp');
          const A0 = JB.ANIMALS.find((x) => x.kind === e.kind);
          const p = cupAt(e.row, L);
          word('GLUG GLUG!', p.x - 1, p.y + 1.6, p.z, { size: 0.9, life: 1.4, fill: '#ffffff', stroke: '#ff3d7f' });
          toast(`${A0.name} WAS TOO THIRSTY!`, 'oops');
          break;
        }
        case 'splash': {
          sfx('splash');
          const p = cupAt(e.row, e.kind === 'full' ? -0.9 : L + 0.7);
          splashFx(p.x, p.y - 0.5, p.z, e.kind === 'full' ? JB.JUICES[e.row].color : '#d8f4ff');
          word('SPLASH!', p.x + (e.kind === 'full' ? 0.8 : -0.8), p.y + 0.9, p.z, { size: 0.9, life: 1.0, fill: '#18d4ff', stroke: '#ffffff' });
          if (!e.life && !e.magic && !G.attract && G.splashTips < 2) {
            G.splashTips++;
            toast(e.kind === 'full' ? 'SPLASH! NOBODY CAUGHT IT' : 'SPLASH! CATCH THE EMPTY CUPS');
          }
          break;
        }
        case 'life':
          sfx('life');
          $('lives').classList.remove('hit');
          void $('lives').offsetWidth;
          $('lives').classList.add('hit');
          if (e.why === 'splash') toast('OOPS! A SPLASH', 'oops');
          break;
        case 'tip': {
          sfx('tip');
          sfx('dance');
          const p = cupAt(e.row, e.x);
          word(`+${e.points}`, p.x, p.y + 1.2, p.z, { size: 0.8, life: 1.0, fill: '#ffd400', stroke: '#ff9a1f' });
          stars(p.x, p.y + 0.3, p.z, 8);
          toast('A TIP! DANCE PARTY!', 'good');
          break;
        }
        case 'tipDrop': sfx('tipDrop'); break;
        case 'tipGone': { const p = cupAt(e.row, e.x); puff(p.x, p.y - 0.1, p.z, 4, { size: 0.25 }); break; }
        case 'pop': { const p = cupAt(e.row, e.x); puff(p.x, p.y - 0.2, p.z, 5, { size: 0.3 }); break; }
        case 'highfive':
          sfx('highFive');
          toast('HIGH FIVE! QUICK POURING!', 'buddy');
          for (let i = 0; i < world.servers.length; i++) { const h = headOf(i); stars(h.x, h.y, h.z, 6); }
          break;
        case 'buddyIn': {
          sfx('buddyIn');
          toast(`${nameOf(e.id)} IS HERE!`, 'buddy');
          puff(BUDDY_AT.x, BUDDY_AT.y + 1, BUDDY_AT.z, 10, { size: 0.6 });
          break;
        }
        case 'buddyQueue': toast(`${nameOf(e.id)} WILL COME AGAIN! ×${e.queue}`, 'buddy'); break;
        case 'treat': {
          sfx('treat');
          const from = world.buddy ? world.buddy.root.position.clone().add(new T.Vector3(0, 1.4, 0)) : new T.Vector3();
          flyer(e.emoji, from, headOf(0), 0.55);
          toast(`${e.emoji} ${e.name} FROM ${nameOf(e.id)}!`, 'good');
          break;
        }
        case 'buddySay': toast(`${nameOf(e.id)} SAYS: JUICE FOR EVERYONE!`, 'buddy'); break;
        case 'buddyPour':
          sfx('buddyPour');
          for (let r = 0; r < TUNE.ROWS; r++) {
            const p = cupAt(r, TUNE.sendX);
            flyer('🧃', BUDDY_AT.clone().add(new T.Vector3(0, 1.6, 0)), p, 0.3 + r * 0.06);
            for (let k = 0; k < 4; k++) fx.sparks.spawn(p.x, p.y, p.z + 0.3, { life: 0.7, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.5, size: 0.35 });
          }
          break;
        case 'buddyOut': break;
        case 'clear':
          sfx('clear');
          if (!G.attract) {
            banner('WAVE CLEAR!', '<small>EVERY ANIMAL HAD A DRINK!</small>', 2600, 'win');
            const h = headOf(M.winner);
            for (let k = 0; k < 4; k++) setTimeout(() => fx.confetti.burst(h.x + (k - 1.5) * 3, h.y + 1, h.z, 160, 6), k * 260);
            G.after = () => results('clear');
            G.afterT = 3.4;
          }
          break;
        case 'over':
          sfx('over');
          if (!G.attract) {
            banner('GOOD TRY!', '', 1800, 'cool');
            G.after = () => results('over');
            G.afterT = 2.2;
          }
          break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- camera
  // Fits the whole bar into the part of the screen the HUD and the touch controls leave free.
  function reserved(touch, two) {
    const css = getComputedStyle(document.documentElement);
    const pad = parseFloat(css.getPropertyValue('--pad')) || 150, btn = parseFloat(css.getPropertyValue('--btn')) || 96, padin = parseFloat(css.getPropertyValue('--padin')) || 52;
    const bars = document.querySelector('.bars');
    const top = (G.screen === 'play' || G.screen === 'pause') && bars ? bars.getBoundingClientRect().bottom + 4 : 10;
    const base = { top, left: 58, right: 10, bottom: 8 };
    if (G.screen === 'title') return [{ top: 6, left: 6, right: 6, bottom: 6 }];
    if (!touch) return [base];
    const side = { top, left: 16 + padin + pad + 8, right: 16 + btn + 22, bottom: 8 };
    const bottom = { top, left: 58, right: 10, bottom: pad + 26 };
    return two ? [bottom] : [side, bottom];
  }
  const camDir = new T.Vector3(0, Math.sin(0.36), Math.cos(0.36));
  function boxFor(title) {
    const R = TUNE.ROWS - 1;
    return new T.Box3(new T.Vector3(wx(-4.9), -0.1, rowZ(R) + BEHIND - 0.8), new T.Vector3(wx(L + 2.0), rowY(R) + (title ? 4.2 : 2.5), title ? 0.55 : 1.0));
  }
  function projectBox(box, W, H) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const v = new T.Vector3();
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
      const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0, x1, y0, y1 };
  }
  function fitCamera(force) {
    const M = G.M;
    if (!M) return;
    const W = innerWidth, H = innerHeight;
    const title = G.screen === 'title';
    const key = [W, H, G.touch, M.two, G.screen].join();
    if (!force && key === G.camKey) return;
    G.camKey = key;
    const box = boxFor(title);
    const center = box.getCenter(new T.Vector3());
    camera.fov = 30;
    camera.aspect = W / H;
    camera.clearViewOffset();
    let best = null;
    for (const r of reserved(G.touch, M.two)) {
      const pw = Math.max(80, W - r.left - r.right), ph = Math.max(80, H - r.top - r.bottom);
      // the nearest camera at which the bar still fits in that space
      let lo = 5, hi = 400;
      for (let it = 0; it < 30; it++) {
        const d = (lo + hi) / 2;
        camera.position.copy(center).addScaledVector(camDir, d);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const b = projectBox(box, W, H);
        if (b.x1 - b.x0 <= pw && b.y1 - b.y0 <= ph) hi = d; else lo = d;
      }
      if (!best || hi < best.d) best = { d: hi, r, pw, ph };
    }
    camera.position.copy(center).addScaledVector(camDir, best.d);
    camera.lookAt(center);
    camera.far = best.d * 3;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const b = projectBox(box, W, H);
    const rcx = best.r.left + best.pw / 2, rcy = best.r.top + best.ph / 2;
    camera.setViewOffset(W, H, (b.x0 + b.x1) / 2 - rcx, (b.y0 + b.y1) / 2 - rcy, W, H);
    camera.updateProjectionMatrix();
    G.fit = { d: best.d, rect: best.r };
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    G.camKey = '';
    fitCamera(true);
  }

  // ---------------------------------------------------------------- HUD
  const textCache = new Map();
  function setText(el, text) {
    if (textCache.get(el) === text) return;
    textCache.set(el, text);
    el.textContent = text;
  }
  function toast(text, cls) {
    if (G.attract) return;
    if (G.lastToast === text && G.time - G.lastToastT < 1.6) return; // the same news twice in a row: once is enough
    G.lastToast = text;
    G.lastToastT = G.time;
    const box = $('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(() => d.remove(), 1950);
  }
  function banner(text, small, ms, cls) {
    const b = $('banner');
    b.className = 'banner ' + (cls || '');
    b.innerHTML = text + (small || ''); // English: the page translator puts the 中文 in (writing 中文 here would stick)
    void b.offsetWidth;
    b.classList.add('show');
    G.bannerT = (ms || 1200) / 1000;
  }
  function setupHud(M) {
    document.body.classList.toggle('two', M.two);
    M.servers.forEach((s, i) => {
      const pb = $('pb' + i);
      pb.querySelector('.face img').src = thumbs[s.id] || '';
      setText(pb.querySelector('.nm'), nameOf(s.id));
    });
    $('pb1').style.visibility = M.two ? 'visible' : 'hidden';
    const bid = M.two ? 'tommy' : M.buddies[0].id;
    $('budInfo').style.display = M.two ? 'none' : '';
    $('budInfo').querySelector('img').src = thumbs[bid] || '';
    setText($('budInfo').querySelector('span'), `${nameOf(bid)} HELPS`);
    $('budBtn').querySelector('img').src = thumbs[bid] || '';
    $('budBtn').title = M.two ? 'High five (T)' : 'Call your brother (T)';
    setText($('barName'), `WAVE ${M.n + 1} · ${M.L.name}`);
  }
  function updateHud(M) {
    M.servers.forEach((s, i) => $('pb' + i).classList.toggle('fast', s.boost > 0));
    setText($('lives'), '❤️'.repeat(Math.min(M.lives, 9)));
    setText($('score'), M.score.toLocaleString('en-US'));
    setText($('served'), `🧃 ${M.done}/${M.total}`);
    setText($('hi'), `HI-SCORE ${Math.max(saved.best[M.diff], M.score).toLocaleString('en-US')}`);
    const on = !M.two && M.buddies[0] && M.buddies[0].on;
    $('budInfo').classList.toggle('on', !!on);
    $('budBtn').classList.toggle('on', !!on);
  }

  // ---------------------------------------------------------------- screens
  function show(name) {
    G.screen = name;
    for (const s of ['title', 'pause', 'results']) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', name !== 'play' && name !== 'pause');
    $('touch').style.visibility = name === 'play' ? 'visible' : 'hidden';
    JB.Input.enable(name === 'play');
    Kit.sound.music(name === 'play' ? 'play' : name === 'pause' ? 'pause' : name === 'results' ? 'over' : 'title');
    G.camKey = '';
  }
  function titleScreen() {
    G.attract = true;
    G.run = null;
    G.after = null;
    show('title');
    renderTitle();
    startAttract();
  }
  function startAttract() {
    G.attract = true;
    const M = Sim.create({ n: G.wave % JB.LEVELS.length, diff: 'easy', heroes: [G.hero, Kit.roster.buddyFor(G.hero)], seed: 1 + Math.floor(Math.random() * 999) });
    M.lives = 99;
    G.M = M;
    buildWorld(M);
    G.phase = 'play';
    G.phaseT = 0;
    fitCamera(true);
  }
  function renderTitle() {
    document.body.classList.toggle('two', false);
    $('title').classList.toggle('two-mode', G.modeFocus === 1);
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.diff)));
    document.querySelectorAll('.hero').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hero === G.hero)));
    $('mode1').classList.toggle('focus', !!G.keyNav && G.modeFocus === 0);
    $('mode2').classList.toggle('focus', !!G.keyNav && G.modeFocus === 1);
    $('mode1').classList.toggle('pulse', G.modeFocus === 0);
    $('mode2').classList.toggle('pulse', G.modeFocus === 1);
    $('waves').querySelectorAll('.wave').forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === G.wave));
      b.classList.toggle('lock', i > saved.unlocked);
    });
    const Lv = JB.LEVELS[G.wave % JB.LEVELS.length];
    setText($('waveLabel'), `WAVE ${G.wave + 1} · ${Lv.name}`);
  }
  function setDiff(d) {
    G.diff = d;
    saved.diff = d;
    persist();
    renderTitle();
  }
  function setHero(h) {
    G.hero = h;
    saved.hero = h;
    persist();
    renderTitle();
  }
  function pickWave(i) {
    if (i < 0 || i > saved.unlocked || i >= JB.LEVELS.length) return;
    G.wave = i;
    saved.wave = i;
    persist();
    renderTitle();
    startAttract();
  }

  // ---------------------------------------------------------------- flow
  function startGame(two, n = G.wave) {
    G.two = !!two;
    G.attract = false;
    G.letGo = 0;
    G.splashTips = 0;
    const heroes = G.two ? ['teddy', 'tommy'] : [G.hero, Kit.roster.buddyFor(G.hero)];
    G.run = { n, score: 0, lives: null, two: G.two, diff: G.diff, heroes, served: 0, tips: 0, empties: 0, kind: '' };
    startLevel();
  }
  function startLevel() {
    const r = G.run;
    JB.Input.setTwo(r.two);
    JB.Input.reset();
    const M = Sim.create({ n: r.n, diff: r.diff, two: r.two, heroes: r.heroes, score: r.score, lives: r.lives, seed: 1 + Math.floor(Math.random() * 99999) });
    G.M = M;
    G.attract = false;
    buildWorld(M);
    show('play');
    textCache.clear();
    setupHud(M);
    updateHud(M);
    G.phase = 'intro';
    G.phaseT = 0;
    G.after = null;
    const sub = M.loop > 0 ? `<small>ROUND ${M.loop + 1}: QUICKER ANIMALS!</small>` : '<small>READY?</small>';
    banner(`WAVE ${M.n + 1}`, sub, 1500, 'cool');
    fitCamera(true);
  }
  function results(kind) {
    const M = G.M, r = G.run;
    if (!M || !r) return;
    G.after = null;
    r.score = M.score;
    r.served += M.served;
    r.tips += M.tipsGot;
    r.empties += M.empties;
    const best = saved.best[r.diff];
    const newBest = M.score > best;
    if (newBest) saved.best[r.diff] = M.score;
    saved.served = (saved.served || 0) + M.served;
    r.kind = kind;
    if (kind === 'clear') {
      r.lives = M.lives;
      saved.unlocked = Math.max(saved.unlocked || 0, Math.min(JB.LEVELS.length - 1, r.n + 1));
      G.wave = Math.min(saved.unlocked, (r.n + 1) % JB.LEVELS.length);
      saved.wave = G.wave;
    }
    persist();
    const winner = M.servers[M.winner] || M.servers[0];
    const tie = M.two && M.servers[0].served === M.servers[1].served;
    $('resFace').src = thumbs[kind === 'clear' ? winner.id : M.servers[0].id] || '';
    $('resTitle').textContent = kind === 'clear' ? 'WAVE CLEAR!' : 'GOOD TRY!';
    $('resSub').textContent = kind === 'clear'
      ? (M.two ? (tie ? 'Teddy and Tommy served the same number!' : `${nameOf(winner.id)} served the most animals!`) : `${nameOf(winner.id)} gave every animal a drink!`)
      : 'The animals got too thirsty. Have another go!';
    const stats = $('resStats');
    stats.innerHTML = '';
    const line = (a, b, cls) => {
      const d = document.createElement('div');
      d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = a;
      d.querySelector('span').textContent = b;
      if (cls) d.querySelector('span').className = cls;
      stats.appendChild(d);
    };
    line('SCORE', M.score.toLocaleString('en-US'));
    line('HI-SCORE', newBest ? 'NEW HI-SCORE!' : Math.max(best, M.score).toLocaleString('en-US'), newBest ? 'new' : '');
    line('ANIMALS SERVED', `🧃 ${r.served}`);
    if (r.empties) line('EMPTY CUPS CAUGHT', `🥤 ${r.empties}`);
    if (r.tips) line('TIPS', `🪙 ${r.tips}`);
    if (M.two) line('SERVED THIS WAVE', `${nameOf(M.servers[0].id)} ${M.servers[0].served} · ${nameOf(M.servers[1].id)} ${M.servers[1].served}`);
    $('nextBtn').style.display = kind === 'clear' ? '' : 'none';
    $('againBtn').classList.toggle('small', kind === 'clear');
    $('resHint').textContent = kind === 'clear' ? 'Enter to go on · R to play again · Esc for the menu' : 'Enter or R to play again · Esc for the menu';
    show('results');
  }
  function next() {
    const r = G.run;
    if (!r) return titleScreen();
    if (r.kind !== 'clear') return again();
    r.n++;
    startLevel();
  }
  function again() {
    const r = G.run;
    if (!r) return titleScreen();
    startGame(r.two, r.kind === 'clear' ? r.n - (r.n % JB.LEVELS.length) : r.n - (r.n % JB.LEVELS.length));
  }
  function pause(on) {
    if (on && G.screen === 'play') show('pause');
    else if (!on && G.screen === 'pause') show('play');
  }

  // ---------------------------------------------------------------- the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (G.hold) {
      last = now;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    renderer.render(scene, camera);
  }

  function tick(dt) {
    G.time += dt;
    const M = G.M;
    if (!M) return;
    fitCamera(false);
    const live = G.screen === 'play' || (G.attract && G.screen === 'title');
    if (live) {
      G.phaseT += dt;
      if (G.phase === 'intro') {
        if (G.phaseT > 1.5) {
          G.phase = 'play';
          G.phaseT = 0;
          banner('GO!', '', 600);
          sfx('go');
        }
      } else {
        const bot = G.attract || G.autopilot;
        const inputs = bot ? M.servers.map((s, i) => JB.Bot.think(M, i, { buddy: G.attract })) : M.servers.map((s, i) => JB.Input.read(i));
        if (!G.attract) JB.Input.endFrame();
        G.lastInputs = inputs;
        M.step(dt, inputs);
        handleEvents(M);
        if (G.attract && (M.state === 'clear' || M.state === 'over') && M.stateT > 3) {
          startAttract();
          return;
        }
        if (G.after) {
          G.afterT -= dt;
          if (G.afterT <= 0) {
            const f = G.after;
            G.after = null;
            f();
            return;
          }
        }
      }
    }
    if (world.B) world.B.sign.visible = G.screen !== 'title'; // the title has the big logo instead
    syncServers(G.M, dt);
    syncBuddy(G.M, dt);
    syncAnimals(G.M, dt);
    syncCups(G.M, dt);
    syncFriends(G.M, dt);
    for (const k of ['puffs', 'drops', 'stars', 'sparks', 'notes', 'confetti']) fx[k].update(dt);
    updateWords(dt);
    updateFlyers(dt);
    if (G.screen === 'play') updateHud(G.M);
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) $('banner').classList.remove('show');
    }
  }

  // ---------------------------------------------------------------- input wiring
  function wire() {
    const tap = (id, fn) => $(id).addEventListener('click', (e) => {
      Kit.sound.init();
      sfx('click');
      fn(e);
      e.currentTarget.blur();
    });
    tap('mode1', () => startGame(false));
    tap('mode2', () => startGame(true));
    $('mode1').addEventListener('pointerenter', () => { G.modeFocus = 0; renderTitle(); });
    $('mode2').addEventListener('pointerenter', () => { G.modeFocus = 1; renderTitle(); });
    document.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); sfx('click'); setDiff(b.dataset.level); }));
    document.querySelectorAll('.hero').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); sfx('click'); setHero(b.dataset.hero); startAttract(); }));
    tap('pauseBtn', () => pause(true));
    tap('resumeBtn', () => pause(false));
    tap('quitBtn', titleScreen);
    tap('nextBtn', next);
    tap('againBtn', again);
    tap('menuBtn', titleScreen);
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      Kit.sound.toggleMute();
      muteIcon();
    }));
    JB.Input.bindPad(0, $('pad0'));
    JB.Input.bindPad(1, $('pad1'));
    JB.Input.bindPour(0, $('pour0'));
    JB.Input.bindPour(1, $('pour1'));
    JB.Input.bindButton($('budBtn'), 0);
    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !G.touch) setTouch(true);
    }, true);
    addEventListener('keydown', (e) => {
      Kit.sound.init();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      onKey(e);
    });
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) pause(true);
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }
  function setTouch(on) {
    G.touch = on;
    document.body.classList.toggle('touch', on);
    G.camKey = '';
  }
  function muteIcon() {
    document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
  }
  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') {
      Kit.sound.toggleMute();
      muteIcon();
      return;
    }
    if (G.screen === 'title') {
      if (k === 'ArrowLeft' || k === 'KeyA') { G.keyNav = true; G.modeFocus = 0; }
      else if (k === 'ArrowRight' || k === 'KeyD') { G.keyNav = true; G.modeFocus = 1; }
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'ArrowDown' || k === 'KeyS') { G.keyNav = true; setDiff(G.diff === 'easy' ? 'normal' : 'easy'); }
      else if (k === 'KeyH') { setHero(G.hero === 'teddy' ? 'tommy' : 'teddy'); startAttract(); }
      else if (k === 'KeyV') { pickWave((G.wave + 1) % (saved.unlocked + 1)); return; }
      else if (k === 'Digit1') startGame(false);
      else if (k === 'Digit2') startGame(true);
      else if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        startGame(G.modeFocus === 1);
        return;
      }
      renderTitle();
    } else if (G.screen === 'play') {
      if (k === 'KeyP' || k === 'Escape') pause(true); // T (the brother) goes through js/input.js like the other game keys
    } else if (G.screen === 'pause') {
      if (k === 'KeyP' || k === 'Escape' || k === 'Space' || k === 'Enter') {
        e.preventDefault();
        pause(false);
      } else if (k === 'KeyQ') titleScreen();
    } else if (G.screen === 'results') {
      if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        next();
      } else if (k === 'KeyR') again();
      else if (k === 'Escape') titleScreen();
    }
  }

  // Switching language: the logo and the wall sign follow (the 3D words are drawn fresh each time).
  function paintLogo() {
    const zh = Kit.lang && Kit.lang.is('zh');
    $('logoMain').innerHTML = zh ? JB.ZH : JB.TITLE.replace(/TT/g, '<span class="tt">TT</span>');
  }
  function paintSign() {
    if (!world.B || !G.M) return;
    const old = world.B.signMat.map;
    world.B.signMat.map = A.signTexture(G.M.L.theme);
    world.B.signMat.needsUpdate = true;
    if (old) old.dispose();
  }
  if (Kit.lang) Kit.lang.onChange(() => { paintLogo(); paintSign(); textCache.clear(); if (G.M && G.screen !== 'title') { setupHud(G.M); updateHud(G.M); } });

  // ---------------------------------------------------------------- boot
  function boot() {
    document.title = `${JB.TITLE} · Teddy & Tommy`;
    paintLogo();
    $('tagline').textContent = JB.SUBTITLE;
    resize();
    thumbs = Kit.portraits(Kit.roster.list.filter((e) => JB.HEROES.includes(e.id)), { size: 152 });
    document.querySelectorAll('.hero img').forEach((img) => (img.src = thumbs[img.closest('.hero').dataset.hero] || ''));
    const waves = $('waves');
    JB.LEVELS.forEach((Lv, i) => {
      const b = document.createElement('button');
      b.className = 'wave';
      b.setAttribute('role', 'radio');
      b.title = Lv.name;
      b.innerHTML = `<span>${Lv.emoji}</span>${i + 1}`;
      b.addEventListener('click', () => { Kit.sound.init(); sfx('click'); pickWave(i); });
      waves.appendChild(b);
    });
    const zoo = $('zoo');
    JB.ANIMALS.forEach((a) => {
      const d = document.createElement('span');
      d.innerHTML = '<i></i><span><b></b> <em></em></span>';
      d.querySelector('i').textContent = a.emoji;
      d.querySelector('b').textContent = a.name;
      d.querySelector('em').textContent = a.does;
      d.querySelector('em').style.fontStyle = 'normal';
      zoo.appendChild(d);
    });
    muteIcon();
    if (Kit.sound.onMute) Kit.sound.onMute(muteIcon);
    wire();
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) setTouch(true);
    $('loading').classList.add('hidden');
    titleScreen();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hooks (window.game)
  // The hidden Browser pane throttles requestAnimationFrame, so step() ticks and renders synchronously.
  window.game = {
    G, world, scene, camera, renderer, saved: () => saved,
    step(seconds = 0.5, o = {}) {
      G.autoPause = false;
      const n = Math.max(1, Math.round(seconds * 60));
      for (let k = 0; k < n; k++) tick(1 / 60);
      if (o.draw !== false) renderer.render(scene, camera);
      return o.quiet ? null : this.state();
    },
    hold(on = true) {
      G.hold = on;
      G.autoPause = false;
      return on;
    },
    render() { renderer.render(scene, camera); },
    // straight into a wave: { n, diff, two, hero, go }
    start(o = {}) {
      Kit.sound.init();
      G.autoPause = false;
      if (o.diff) G.diff = o.diff;
      if (o.hero) G.hero = o.hero;
      startGame(!!o.two, o.n || 0);
      if (o.go !== false) this.step(1.6, { draw: false });
      return this.state();
    },
    state() {
      const M = G.M;
      if (!M) return { screen: G.screen };
      return {
        screen: G.screen, phase: G.phase, state: M.state, wave: M.n + 1, name: M.L.name, lives: M.lives, score: M.score, attract: G.attract,
        done: M.done, total: M.total, served: M.served, dance: +M.dance.toFixed(2),
        servers: M.servers.map((s) => ({ id: s.id, row: s.row, x: +s.x.toFixed(3), fill: +s.fill.toFixed(2), held: s.held, boost: +s.boost.toFixed(1), sent: s.sent, caught: s.caught })),
        animals: M.animals.filter((a) => a.state !== 'gone').map((a) => ({ id: a.id, kind: a.kind, row: a.row, x: +a.x.toFixed(2), state: a.state })),
        cups: M.cups.filter((c) => c.state === 'slide').map((c) => ({ row: c.row, x: +c.x.toFixed(2), kind: c.kind, magic: c.magic })),
        buddy: M.buddies.map((b) => ({ id: b.id, on: b.on, phase: b.phase, queue: b.queue, visits: b.visits })),
      };
    },
    // send every animal home and stop more coming (for tests that need a quiet bar)
    quiet() {
      const M = G.M;
      M.queue.length = 0;
      M.animals.length = 0;
      M.cups.length = 0;
      M.tips.length = 0;
      M.noClear = true;
      for (const s of M.servers) Object.assign(s, { fill: 0, held: false });
      return this.state();
    },
    // put server i at a counter and a spot along it
    put(i, row, x) {
      Object.assign(G.M.servers[i], { row, x: x == null ? L : x, fill: 0, held: false });
      this.step(1 / 60, { draw: false, quiet: true });
      const v = world.servers[i];
      if (v) { v.hop = 0; v.pos = null; }
      return this.step(1 / 60, { draw: false });
    },
    // where server i (or 'buddy', or an animal id with who = 'animal') is drawn on the screen, in CSS pixels
    screenOf(i, who = 'servers') {
      const v = who === 'animal' ? world.animals.get(i) : who === 'buddy' ? world.buddy : world.servers[i];
      if (!v) return null;
      camera.updateMatrixWorld();
      const p = v.root.position.clone();
      p.y += 0.9;
      p.project(camera);
      return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
    },
    cupScreen(id) {
      const m = world.cups.get(id);
      if (!m) return null;
      camera.updateMatrixWorld();
      const p = m.position.clone().project(camera);
      return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
    },
    buddy() {
      if (G.M) { G.M.callBuddy(0); handleEvents(G.M); }
      return this.state();
    },
    // the autopilot plays for you (for screenshots); the keys still get read and dropped
    autopilot(on = true) {
      G.autopilot = !!on;
      return G.autopilot;
    },
    check: (o) => JB.Check.checkAll(o),
    sabotage: () => JB.Check.sabotage(),
    title: titleScreen,
    results,
    toast,
    setTouch,
    fitCamera,
    handleEvents: () => handleEvents(G.M),
  };

  try {
    boot();
  } catch (err) {
    $('loading').textContent = 'Oops, something went wrong: ' + err.message;
    throw err;
  }
})();
