/* The 3D toys: the juice bar (four counters like steps, doors, juice jugs, the wall and its sign), cups, tip coins,
   balloons, the thirsty animals (a bunny, a giraffe, a hippo, a penguin) and Foxy and Froggy, word bursts, juice
   drops and confetti. Everything is built from boxes, spheres and cylinders, and every texture is painted on a
   canvas: no image or model files. Classic script: adds JB.Art to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const T = THREE;
  const gfx = Kit.gfx;
  const TUNE = JB.TUNE;
  const std = (c, o) => gfx.std(c, Object.assign({ roughness: 0.6 }, o));
  const mesh = (geo, mat, x, y, z, parent, shadow = true) => gfx.mesh(geo, mat, x, y, z, parent, shadow);

  // world units: x along a counter is one unit; row r sits RY higher and RZ further back than row r - 1
  const RY = 1.6, RZ = 2.05;
  const XU = 0.8; // one unit along a counter, in world units
  const TOP = 0.95; // a counter's top, above its row's floor
  const BEHIND = -0.78; // where the servers and the animals stand, behind the counter
  const L = TUNE.L;
  const wx = (x) => (x - L / 2) * XU;
  const rowY = (r) => r * RY;
  const rowZ = (r) => -r * RZ;

  // ---------------------------------------------------------------- textures
  function stripeTexture(a, b, n = 4) {
    const [c, g] = gfx.makeCanvas(128, 32);
    g.fillStyle = a;
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = b;
    for (let k = 0; k < n; k++) g.fillRect((k * 128) / n, 0, 128 / n / 2, 32);
    return gfx.toTexture(c, true);
  }
  function spotTexture(base, spot) {
    const [c, g] = gfx.makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = spot;
    const P = [[20, 22, 13], [70, 16, 11], [108, 40, 12], [40, 64, 15], [92, 82, 13], [22, 104, 11], [64, 112, 12], [118, 116, 9]];
    for (const [x, y, r] of P) {
      g.beginPath();
      g.ellipse(x, y, r, r * 0.8, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    return gfx.toTexture(c, true);
  }
  function wordTexture(text, fill, stroke) {
    const [c, g] = gfx.makeCanvas(512, 160);
    let size = 64;
    g.font = `${size}px ${gfx.FONT}`;
    while (g.measureText(text).width > 480 && size > 26) { size -= 4; g.font = `${size}px ${gfx.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 14;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 256, 84);
    g.lineWidth = 6;
    g.strokeStyle = stroke || '#ff3d7f';
    g.strokeText(text, 256, 80);
    g.fillStyle = fill || '#ffd400';
    g.fillText(text, 256, 80);
    return gfx.toTexture(c);
  }
  const words = new Map();
  function word(text, fill, stroke) {
    const key = text + fill + stroke;
    if (!words.has(key)) {
      const t = wordTexture(text, fill, stroke);
      t.userData.keep = true;
      words.set(key, t);
    }
    return words.get(key);
  }
  function puffTexture(col = '255,255,255') {
    return gfx.radialTexture(64, [[0, `rgba(${col},0.95)`], [0.55, `rgba(${col},0.6)`], [1, `rgba(${col},0)`]]);
  }
  // the big sign on the wall: the game's name, in English or 中文
  function signTexture(theme) {
    const [c, g] = gfx.makeCanvas(1024, 256);
    gfx.roundRect(g, 10, 10, 1004, 236, 60);
    g.fillStyle = theme.trim;
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = '#14121f';
    g.stroke();
    const zh = Kit.lang && Kit.lang.is('zh');
    const text = zh ? JB.ZH : JB.TITLE.toUpperCase();
    let size = zh ? 150 : 120;
    g.font = `${size}px ${gfx.FONT}`;
    while (g.measureText(text).width > 760 && size > 40) { size -= 6; g.font = `${size}px ${gfx.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 22;
    g.strokeStyle = '#14121f';
    g.strokeText(text, 512, 136);
    g.fillStyle = '#ffffff';
    g.fillText(text, 512, 128);
    g.font = `92px ${gfx.EMOJI_FONT}`;
    g.fillText('🧃', 92, 132);
    g.fillText('🍹', 932, 132);
    return gfx.toTexture(c);
  }

  // ---------------------------------------------------------------- the bar
  // Builds one juice bar: floor, four stepped counters with a door at the far end and a juice jug at the tap end,
  // the wall with its sign and the theme's decorations, Foxy and Froggy's little stage. Returns the parts the game moves.
  function buildBar(theme) {
    const root = new T.Group();
    const R = TUNE.ROWS;
    const backZ = rowZ(R - 1) - 2.1;
    // the ground and the wall
    const ground = mesh(new T.PlaneGeometry(80, 40), std(gfx.shade(theme.floor, -0.12), { roughness: 0.9 }), 0, 0, backZ + 20, root, false);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    const wallTex = stripeTexture(theme.wall, theme.wall2, 6);
    wallTex.repeat.set(10, 1);
    const wall = mesh(new T.PlaneGeometry(80, 30), std('#ffffff', { map: wallTex, roughness: 0.95 }), 0, 15, backZ, root, false);
    wall.receiveShadow = true;
    // windows onto the sky
    const sky = std(theme.sky, { emissive: theme.sky, emissiveIntensity: theme.night ? 0.35 : 0.5 });
    const frame = std('#ffffff');
    for (const side of [1]) {
      const g = new T.Group();
      g.position.set(side * 7.2, rowY(R - 1) + 2.9, backZ + 0.05);
      root.add(g);
      mesh(new T.BoxGeometry(3.6, 2.6, 0.1), frame, 0, 0, 0, g, false);
      mesh(new T.BoxGeometry(3.2, 2.2, 0.12), sky, 0, 0, 0.02, g, false);
      mesh(new T.BoxGeometry(0.12, 2.2, 0.16), frame, 0, 0, 0.05, g, false);
      if (theme.night) mesh(new T.SphereGeometry(0.4, 18, 12), std('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 0.9 }), side * 0.8, 0.5, 0.12, g, false).scale.z = 0.3;
      else mesh(new T.SphereGeometry(0.42, 18, 12), std('#fff2a0', { emissive: '#ffd84a', emissiveIntensity: 0.8 }), side * 0.8, 0.45, 0.12, g, false).scale.z = 0.3;
    }
    // the sign
    const signMat = new T.MeshBasicMaterial({ map: signTexture(theme), transparent: true });
    const sign = mesh(new T.PlaneGeometry(5.6, 1.4), signMat, -6.4, rowY(R - 1) + 2.95, backZ + 0.08, root, false);
    decorate(root, theme, backZ);

    const rows = [];
    for (let r = 0; r < R; r++) {
      const y = rowY(r), z = rowZ(r);
      const g = new T.Group();
      g.position.set(0, y, z);
      root.add(g);
      // the step this row stands on (its front is the riser you see below the counter of the row above)
      const floorCol = gfx.shade(theme.floor, r * 0.05);
      if (r > 0) {
        const step = mesh(new T.BoxGeometry(L + 12, y, RZ), std(floorCol, { roughness: 0.85 }), 0, -y / 2, -0.35, g);
        step.receiveShadow = true;
      }
      // the counter
      const front = stripeTexture(theme.counter, gfx.shade(theme.counter, 0.18), 5);
      front.repeat.set(((L + 2) * XU) / 1.6, 1);
      const cMat = std('#ffffff', { map: front });
      const len = L + 2.05, cx = wx(-1.05 + len / 2);
      const counter = mesh(new T.BoxGeometry(len * XU, TOP - 0.12, 0.72), [std(theme.counter), std(theme.counter), std(theme.counter), std(theme.counter), cMat, std(theme.counter)], cx, (TOP - 0.12) / 2, 0, g);
      counter.receiveShadow = true;
      const top = mesh(new T.BoxGeometry(len * XU + 0.16, 0.12, 0.86), std(theme.top, { roughness: 0.35 }), cx, TOP - 0.06, 0, g);
      top.receiveShadow = true;
      mesh(new T.BoxGeometry(len * XU + 0.18, 0.06, 0.06), std(theme.trim), cx, TOP - 0.14, 0.44, g, false);
      // the door the animals come in at
      const door = new T.Group();
      door.position.set(wx(-1.35), 0, BEHIND - 0.1);
      g.add(door);
      const trim = std(theme.trim);
      mesh(new T.BoxGeometry(0.16, 1.9, 0.2), trim, -0.66, 0.95, 0, door);
      mesh(new T.BoxGeometry(0.16, 1.9, 0.2), trim, 0.66, 0.95, 0, door);
      mesh(new T.BoxGeometry(1.5, 0.22, 0.22), trim, 0, 1.92, 0, door);
      mesh(new T.PlaneGeometry(1.18, 1.82), std('#2a2140', { roughness: 1 }), 0, 0.91, -0.08, door, false);
      // the juice jug at the tap end
      const juice = JB.JUICES[r];
      const jug = new T.Group();
      jug.position.set(wx(L + 0.5), TOP, -0.05);
      g.add(jug);
      mesh(new T.CylinderGeometry(0.36, 0.4, 0.12, 20), std('#ffffff'), 0, 0.06, 0, jug);
      mesh(new T.CylinderGeometry(0.34, 0.34, 0.86, 22), std('#e8fbff', { transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 0.55, 0, jug, false);
      const level = mesh(new T.CylinderGeometry(0.31, 0.31, 0.7, 22), std(juice.color, { emissive: juice.color, emissiveIntensity: 0.15 }), 0, 0.47, 0, jug, false);
      mesh(new T.CylinderGeometry(0.37, 0.34, 0.1, 22), std(theme.trim), 0, 1.02, 0, jug);
      const spout = mesh(new T.BoxGeometry(0.34, 0.1, 0.12), std('#c9d2e0', { metalness: 0.5, roughness: 0.3 }), -0.4, 0.3, 0, jug);
      const fruit = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(juice.fruit), transparent: true, depthWrite: false }));
      fruit.scale.setScalar(0.42);
      fruit.position.set(0, 0.55, 0.4);
      jug.add(fruit);
      // a fruit on the front of the counter, by the door, so you can tell the counters apart
      const badge = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(juice.fruit), transparent: true, depthWrite: false }));
      badge.scale.setScalar(0.5);
      badge.position.set(wx(-0.4), TOP * 0.45, 0.42);
      g.add(badge);
      // a glow on the counter you're at
      const glow = mesh(new T.BoxGeometry(len * XU + 0.2, 0.04, 0.9), new T.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false }), cx, TOP + 0.01, 0, g, false);
      rows.push({ g, y, z, jug, level, spout, glow, door, counter });
    }
    // Foxy and Froggy's little stage, at the far end of the top step
    const stage = new T.Group();
    stage.position.set(wx(-3.45), rowY(R - 1), rowZ(R - 1) + BEHIND);
    root.add(stage);
    mesh(new T.BoxGeometry(2.0, 0.22, 1.4), std(theme.trim), 0, 0.11, 0, stage);
    for (const sx of [-0.88, 0.88]) {
      mesh(new T.BoxGeometry(0.42, 0.7, 0.4), std('#2b2b38'), sx, 0.57, -0.4, stage);
      mesh(new T.CylinderGeometry(0.13, 0.13, 0.05, 16), std('#9aa3b5', { metalness: 0.6 }), sx, 0.62, -0.18, stage).rotation.x = Math.PI / 2;
    }
    const foxy = makeAnimal('fox');
    foxy.root.position.set(-0.4, 0.22, 0.1);
    foxy.root.rotation.y = 0.35;
    foxy.root.scale.setScalar(0.85);
    stage.add(foxy.root);
    const froggy = makeAnimal('frog');
    froggy.root.position.set(0.42, 0.22, 0.1);
    froggy.root.rotation.y = -0.2;
    froggy.root.scale.setScalar(0.85);
    stage.add(froggy.root);
    return { root, rows, sign, signMat, stage, friends: [foxy, froggy], backZ };
  }

  function decorate(root, theme, backZ) {
    const z = backZ + 0.25;
    if (theme.deco === 'beach') {
      for (const x of [-13.5, 13.5]) palm(root, x, z);
      mesh(new T.BoxGeometry(60, 0.5, 0.08), std('#18d4ff'), 0, 0.25, backZ + 0.1, root, false);
    } else if (theme.deco === 'jungle') {
      const vine = std('#3fae4a');
      for (let k = 0; k < 9; k++) {
        const x = -14 + k * 3.5, h = 1.5 + ((k * 37) % 5) * 0.4;
        mesh(new T.CylinderGeometry(0.06, 0.06, h, 6), vine, x, 13 - h / 2 - 1.5, z, root, false);
        mesh(new T.SphereGeometry(0.32, 10, 8), std('#5fd35a'), x + 0.2, 13 - h - 1.5, z, root, false).scale.set(1.4, 0.6, 0.4);
      }
      for (const x of [-13.5, 13.5]) palm(root, x, z);
    } else if (theme.deco === 'snow') {
      for (let k = 0; k < 14; k++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('❄️'), transparent: true, depthWrite: false, opacity: 0.8 }));
        s.scale.setScalar(0.6 + (k % 3) * 0.25);
        s.position.set(-15 + k * 2.3, 6 + ((k * 53) % 7), z);
        root.add(s);
      }
      for (const x of [-13.5, 13.5]) {
        const tree = std('#2fa86a');
        for (let k = 0; k < 3; k++) mesh(new T.ConeGeometry(1.4 - k * 0.35, 1.5, 10), tree, x, 1 + k * 1.05, z + 0.5, root);
        mesh(new T.CylinderGeometry(0.2, 0.2, 0.6, 8), std('#7a4a2a'), x, 0.3, z + 0.5, root);
      }
    } else if (theme.deco === 'night') {
      for (let k = 0; k < 24; k++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(k % 3 ? '⭐' : '✨'), transparent: true, depthWrite: false }));
        s.scale.setScalar(0.35 + (k % 4) * 0.12);
        s.position.set(-16 + ((k * 7.3) % 32), 6.2 + ((k * 31) % 9), z);
        root.add(s);
      }
      const bulbs = ['#ff6fd8', '#ffd400', '#18d4ff', '#7ed957'];
      for (let k = 0; k < 16; k++) {
        const c = bulbs[k % 4];
        mesh(new T.SphereGeometry(0.13, 10, 8), std(c, { emissive: c, emissiveIntensity: 0.9 }), -5.2 + k * 0.7, rowY(3) + 4.85 + Math.sin(k * 0.8) * 0.12, z, root, false);
      }
    }
  }
  function palm(root, x, z) {
    const trunk = std('#b9773e');
    for (let k = 0; k < 6; k++) mesh(new T.CylinderGeometry(0.28, 0.33, 0.9, 10), trunk, x + Math.sin(k * 0.5) * 0.25, 0.45 + k * 0.85, z + 0.6, root);
    const leaf = std('#3fc25a');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const l = mesh(new T.BoxGeometry(2.4, 0.08, 0.6), leaf, x + Math.cos(a) * 1.1, 5.3, z + 0.6 + Math.sin(a) * 0.5, root);
      l.rotation.set(0, -a, Math.cos(a) * 0.35 - 0.25);
    }
  }

  // ---------------------------------------------------------------- cups, coins, balloons
  function makeCup(color) {
    const g = new T.Group();
    const glass = mesh(new T.CylinderGeometry(0.19, 0.15, 0.42, 18, 1, true), std('#ffffff', { transparent: true, opacity: 0.55, roughness: 0.1, side: T.DoubleSide }), 0, 0.21, 0, g, false);
    mesh(new T.CylinderGeometry(0.15, 0.15, 0.03, 18), std('#ffffff', { transparent: true, opacity: 0.7 }), 0, 0.015, 0, g, false);
    const fill = mesh(new T.CylinderGeometry(0.17, 0.14, 0.36, 18), std(color, { emissive: color, emissiveIntensity: 0.2 }), 0, 0.2, 0, g, false);
    const straw = mesh(new T.CylinderGeometry(0.025, 0.025, 0.5, 6), std('#ff3d7f'), 0.07, 0.42, 0, g, false);
    straw.rotation.z = -0.25;
    const slice = mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 12, 1, false, 0, Math.PI), std(gfx.shade(color, 0.25)), -0.17, 0.4, 0, g, false);
    slice.rotation.set(Math.PI / 2, 0, 0);
    g.userData = { glass, fill, straw, slice };
    // fill level 0..1: 0 is an empty
    g.setFill = (k) => {
      fill.visible = slice.visible = k > 0.01;
      fill.scale.y = Math.max(0.01, k);
      fill.position.y = 0.03 + 0.18 * Math.max(0.01, k);
    };
    g.setColor = (c) => {
      fill.material.color.set(c);
      fill.material.emissive.set(c);
      slice.material.color.set(gfx.shade(c, 0.25));
    };
    return g;
  }
  function makeCoin() {
    const g = new T.Group();
    const c = mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 20), std('#ffcf3f', { metalness: 0.6, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.3 }), 0, 0, 0, g, false);
    c.rotation.x = Math.PI / 2;
    mesh(new T.CylinderGeometry(0.13, 0.13, 0.07, 5), std('#fff1a0', { metalness: 0.4 }), 0, 0, 0, g, false).rotation.x = Math.PI / 2;
    return g;
  }
  const BALLOONS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957', '#a46bff', '#ff8a3c'];
  function makeBalloon(k) {
    const g = new T.Group();
    const col = BALLOONS[k % BALLOONS.length];
    mesh(new T.SphereGeometry(0.32, 16, 12), std(col, { roughness: 0.25, emissive: col, emissiveIntensity: 0.15 }), 0, 0.95, 0, g, false).scale.y = 1.2;
    mesh(new T.ConeGeometry(0.06, 0.1, 8), std(col), 0, 0.57, 0, g, false).rotation.x = Math.PI;
    mesh(new T.CylinderGeometry(0.008, 0.008, 0.55, 4), std('#ffffff'), 0, 0.27, 0, g, false);
    return g;
  }

  // ---------------------------------------------------------------- the animals
  // A chunky toy animal facing +z (the game turns it toward the tap). Feet at y = 0. Returns the parts that move.
  const LOOKS = {
    bunny: { fur: '#ffffff', belly: '#ffe3ec', ear: '#ffb3c8', nose: '#ff6f91' },
    giraffe: { fur: '#ffcf4a', spot: '#c9772e', belly: '#fff0b8', nose: '#e0a23a' },
    hippo: { fur: '#a99be8', belly: '#d9d0ff', nose: '#8f7fd6' },
    penguin: { fur: '#2b2f45', belly: '#ffffff', beak: '#ff9a1f' },
    fox: { fur: '#ff8a3c', belly: '#fff3e6', nose: '#2b2b38' },
    frog: { fur: '#5fd35a', belly: '#d8ffb0', nose: '#2f8f3a' },
  };
  function eye(parent, x, y, z, r = 0.08) {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    mesh(new T.SphereGeometry(r, 12, 10), std('#ffffff', { roughness: 0.3 }), 0, 0, 0, g, false);
    mesh(new T.SphereGeometry(r * 0.55, 10, 8), std('#14121f', { roughness: 0.3 }), 0, 0, r * 0.6, g, false);
    mesh(new T.SphereGeometry(r * 0.2, 6, 6), new T.MeshBasicMaterial({ color: '#ffffff' }), r * 0.2, r * 0.25, r * 1.05, g, false);
    return g;
  }
  function smile(parent, y, z, w = 0.12) {
    const s = mesh(new T.TorusGeometry(w, 0.022, 6, 14, Math.PI), std('#3a1f2a'), 0, y, z, parent, false);
    s.rotation.z = Math.PI;
    return s;
  }
  function makeAnimal(kind) {
    const C = LOOKS[kind];
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const fur = std(C.fur, { roughness: 0.75 });
    const belly = std(C.belly, { roughness: 0.8 });
    const legs = [], arms = [];
    const head = new T.Group();
    body.add(head);
    let H = 1.6; // height of the top of the head, for the balloon and the name
    const leg = (x, col, h = 0.36, r = 0.11) => {
      const g = new T.Group();
      g.position.set(x, h, 0);
      body.add(g);
      mesh(new T.CylinderGeometry(r, r * 1.1, h, 10), col || fur, 0, -h / 2, 0, g);
      legs.push(g);
      return g;
    };
    const arm = (x, y, col, len = 0.34) => {
      const g = new T.Group();
      g.position.set(x, y, 0.05);
      body.add(g);
      mesh(new T.CylinderGeometry(0.075, 0.085, len, 8), col || fur, 0, -len / 2, 0, g);
      mesh(new T.SphereGeometry(0.1, 10, 8), col || fur, 0, -len, 0, g);
      g.userData.hand = new T.Vector3(0, -len, 0.06);
      arms.push(g);
      return g;
    };
    if (kind === 'bunny') {
      leg(-0.15); leg(0.15);
      mesh(new T.SphereGeometry(0.4, 18, 14), fur, 0, 0.72, 0, body).scale.set(1, 1.1, 0.9);
      mesh(new T.SphereGeometry(0.3, 14, 10), belly, 0, 0.7, 0.17, body).scale.set(1, 1.1, 0.6);
      mesh(new T.SphereGeometry(0.13, 10, 8), fur, 0, 0.55, -0.38, body);
      arm(-0.36, 0.92); arm(0.36, 0.92);
      head.position.set(0, 1.32, 0.02);
      mesh(new T.SphereGeometry(0.34, 18, 14), fur, 0, 0, 0, head);
      for (const s of [-1, 1]) {
        const e = new T.Group();
        e.position.set(s * 0.13, 0.27, -0.02);
        e.rotation.z = -s * 0.15;
        head.add(e);
        mesh(new T.BoxGeometry(0.15, 0.62, 0.08), fur, 0, 0.31, 0, e);
        mesh(new T.BoxGeometry(0.08, 0.48, 0.02), std(C.ear), 0, 0.31, 0.045, e, false);
        e.userData.ear = true;
        head.userData['ear' + s] = e;
        eye(head, s * 0.12, 0.06, 0.27);
        mesh(new T.SphereGeometry(0.07, 8, 6), std('#ffc2d4'), s * 0.2, -0.08, 0.24, head, false).scale.z = 0.4;
      }
      mesh(new T.SphereGeometry(0.06, 10, 8), std(C.nose), 0, -0.04, 0.33, head, false);
      mesh(new T.BoxGeometry(0.1, 0.08, 0.03), std('#ffffff'), 0, -0.15, 0.31, head, false);
      smile(head, -0.08, 0.31, 0.07);
      H = 2.05;
    } else if (kind === 'giraffe') {
      const spots = std('#ffffff', { map: spotTexture(C.fur, C.spot), roughness: 0.75 });
      leg(-0.18, spots, 0.5, 0.09); leg(0.18, spots, 0.5, 0.09);
      mesh(new T.SphereGeometry(0.38, 18, 14), spots, 0, 0.82, 0, body).scale.set(1, 0.95, 1.05);
      arm(-0.34, 0.98, spots); arm(0.34, 0.98, spots);
      mesh(new T.CylinderGeometry(0.13, 0.18, 0.75, 12), spots, 0, 1.38, 0.04, body);
      head.position.set(0, 1.88, 0.08);
      mesh(new T.SphereGeometry(0.26, 16, 12), spots, 0, 0, 0, head).scale.set(1, 0.95, 1.15);
      mesh(new T.SphereGeometry(0.18, 14, 10), std(C.belly), 0, -0.08, 0.2, head).scale.set(1.1, 0.8, 0.8);
      for (const s of [-1, 1]) {
        mesh(new T.CylinderGeometry(0.03, 0.035, 0.22, 6), std('#c9772e'), s * 0.1, 0.3, -0.04, head);
        mesh(new T.SphereGeometry(0.055, 8, 6), std('#8a4a1e'), s * 0.1, 0.42, -0.04, head);
        const ear = mesh(new T.SphereGeometry(0.08, 8, 6), spots, s * 0.27, 0.12, -0.04, head);
        ear.scale.set(1.6, 0.6, 0.5);
        eye(head, s * 0.11, 0.08, 0.2, 0.07);
        mesh(new T.SphereGeometry(0.022, 6, 6), std('#7a4a1e'), s * 0.06, -0.06, 0.34, head, false);
      }
      smile(head, -0.14, 0.33, 0.08);
      H = 2.35;
    } else if (kind === 'hippo') {
      leg(-0.22, null, 0.32, 0.15); leg(0.22, null, 0.32, 0.15);
      mesh(new T.SphereGeometry(0.5, 18, 14), fur, 0, 0.7, 0, body).scale.set(1.12, 0.95, 1);
      mesh(new T.SphereGeometry(0.38, 16, 12), belly, 0, 0.65, 0.2, body).scale.set(1, 1, 0.6);
      arm(-0.5, 0.92, null, 0.3); arm(0.5, 0.92, null, 0.3);
      head.position.set(0, 1.25, 0.08);
      mesh(new T.SphereGeometry(0.36, 18, 14), fur, 0, 0.04, -0.04, head).scale.set(1.05, 0.9, 1);
      mesh(new T.SphereGeometry(0.3, 16, 12), std(C.nose), 0, -0.1, 0.24, head).scale.set(1.25, 0.8, 0.85);
      for (const s of [-1, 1]) {
        mesh(new T.SphereGeometry(0.035, 8, 6), std('#4a3f80'), s * 0.12, 0.0, 0.5, head, false);
        mesh(new T.SphereGeometry(0.08, 8, 6), fur, s * 0.24, 0.34, -0.08, head).scale.set(1, 0.7, 0.6);
        eye(head, s * 0.15, 0.2, 0.22, 0.075);
        mesh(new T.BoxGeometry(0.06, 0.08, 0.04), std('#ffffff'), s * 0.12, -0.24, 0.42, head, false);
      }
      smile(head, -0.16, 0.44, 0.14);
      H = 1.7;
    } else if (kind === 'penguin') {
      for (const s of [-1, 1]) {
        const f = leg(s * 0.15, std(C.beak), 0.12, 0.06);
        mesh(new T.BoxGeometry(0.16, 0.05, 0.24), std(C.beak), 0, -0.1, 0.07, f, false);
      }
      mesh(new T.SphereGeometry(0.42, 18, 14), fur, 0, 0.72, 0, body).scale.set(0.95, 1.35, 0.88);
      mesh(new T.SphereGeometry(0.34, 16, 12), belly, 0, 0.66, 0.13, body).scale.set(0.9, 1.25, 0.7);
      for (const s of [-1, 1]) {
        const g = new T.Group();
        g.position.set(s * 0.38, 0.98, 0.0);
        body.add(g);
        mesh(new T.BoxGeometry(0.08, 0.46, 0.2), fur, 0, -0.22, 0, g);
        g.userData.hand = new T.Vector3(0, -0.44, 0.06);
        arms.push(g);
      }
      head.position.set(0, 1.3, 0.02);
      mesh(new T.SphereGeometry(0.29, 16, 12), fur, 0, 0, 0, head);
      mesh(new T.SphereGeometry(0.21, 14, 10), belly, 0, -0.03, 0.13, head).scale.set(1.1, 0.9, 0.7);
      for (const s of [-1, 1]) {
        eye(head, s * 0.1, 0.05, 0.23, 0.065);
        mesh(new T.SphereGeometry(0.05, 8, 6), std('#ff9fb5'), s * 0.17, -0.07, 0.2, head, false).scale.z = 0.4;
      }
      const beak = mesh(new T.ConeGeometry(0.07, 0.18, 10), std(C.beak), 0, -0.05, 0.34, head, false);
      beak.rotation.x = Math.PI / 2;
      H = 1.75;
    } else if (kind === 'fox') {
      leg(-0.14, std('#2b2b38')); leg(0.14, std('#2b2b38'));
      mesh(new T.SphereGeometry(0.36, 16, 12), fur, 0, 0.7, 0, body).scale.set(1, 1.1, 0.9);
      mesh(new T.SphereGeometry(0.25, 14, 10), belly, 0, 0.72, 0.16, body).scale.set(1, 1.1, 0.6);
      const tail = mesh(new T.SphereGeometry(0.22, 12, 10), fur, 0.25, 0.55, -0.36, body);
      tail.scale.set(0.8, 0.8, 1.8);
      mesh(new T.SphereGeometry(0.12, 10, 8), belly, 0.32, 0.6, -0.68, body);
      arm(-0.33, 0.92); arm(0.33, 0.92);
      head.position.set(0, 1.26, 0.03);
      mesh(new T.SphereGeometry(0.32, 16, 12), fur, 0, 0, 0, head);
      mesh(new T.SphereGeometry(0.18, 12, 10), belly, 0, -0.1, 0.22, head).scale.set(1.3, 0.8, 0.9);
      for (const s of [-1, 1]) {
        const e = mesh(new T.ConeGeometry(0.12, 0.3, 4), fur, s * 0.18, 0.33, 0, head);
        e.rotation.z = -s * 0.25;
        eye(head, s * 0.12, 0.07, 0.26, 0.07);
      }
      mesh(new T.SphereGeometry(0.05, 8, 6), std(C.nose), 0, -0.04, 0.38, head, false);
      smile(head, -0.12, 0.33, 0.07);
      H = 1.95;
    } else if (kind === 'frog') {
      leg(-0.2, null, 0.22, 0.1); leg(0.2, null, 0.22, 0.1);
      mesh(new T.SphereGeometry(0.42, 16, 12), fur, 0, 0.62, 0, body).scale.set(1.1, 0.95, 0.95);
      mesh(new T.SphereGeometry(0.32, 14, 10), belly, 0, 0.58, 0.17, body).scale.set(1, 1, 0.6);
      arm(-0.42, 0.8); arm(0.42, 0.8);
      head.position.set(0, 1.08, 0.04);
      mesh(new T.SphereGeometry(0.36, 16, 12), fur, 0, 0, 0, head).scale.set(1.2, 0.8, 1);
      for (const s of [-1, 1]) {
        mesh(new T.SphereGeometry(0.13, 12, 10), fur, s * 0.2, 0.25, 0.05, head);
        eye(head, s * 0.2, 0.28, 0.13, 0.09);
        mesh(new T.SphereGeometry(0.06, 8, 6), std('#ff9fb5'), s * 0.27, -0.06, 0.24, head, false).scale.z = 0.4;
      }
      smile(head, -0.06, 0.33, 0.17);
      H = 1.6;
    }
    root.userData.kind = kind;
    return { root, body, head, legs, arms, H, kind };
  }

  // ---------------------------------------------------------------- effects
  function SpritePool(scene, n, tex) {
    const items = [];
    for (let k = 0; k < n; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      items.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, g: 0 });
    }
    let next = 0;
    return {
      spawn(x, y, z, o = {}) {
        const p = items[next];
        next = (next + 1) % n;
        p.s.position.set(x, y, z);
        p.life = p.max = o.life || 0.8;
        p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
        p.size = o.size || 1; p.grow = o.grow || 0; p.g = o.g || 0;
        p.s.material.color.set(o.color || '#ffffff');
        p.s.material.rotation = o.rot || 0;
        p.s.scale.setScalar(p.size);
        p.s.material.opacity = 1;
        p.s.visible = true;
        return p;
      },
      update(dt) {
        for (const p of items) {
          if (!p.s.visible) continue;
          p.life -= dt;
          if (p.life <= 0) { p.s.visible = false; continue; }
          p.vy -= p.g * dt;
          p.s.position.x += p.vx * dt;
          p.s.position.y += p.vy * dt;
          p.s.position.z += p.vz * dt;
          p.size += p.grow * dt;
          p.s.scale.setScalar(Math.max(0.01, p.size));
          p.s.material.opacity = Math.min(1, (p.life / p.max) * 2);
        }
      },
      clear() { for (const p of items) p.s.visible = false; },
    };
  }
  function Confetti(scene, n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    const vel = new Float32Array(n * 3), life = new Float32Array(n);
    const C = ['#ff3d7f', '#ffd400', '#18d4ff', '#2fc27a', '#a46bff', '#ff8a3c', '#ffffff'].map((h) => new T.Color(h));
    let next = 0;
    for (let k = 0; k < n; k++) pos[k * 3 + 1] = -999;
    return {
      burst(x, y, z, count = 160, spread = 6) {
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          pos[i * 3] = x + (Math.random() - 0.5) * 0.5;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
          const a = Math.random() * Math.PI * 2, s = Math.random() * spread;
          vel[i * 3] = Math.cos(a) * s;
          vel[i * 3 + 1] = 4 + Math.random() * 7;
          vel[i * 3 + 2] = Math.sin(a) * s * 0.3;
          life[i] = 2 + Math.random() * 1.5;
          const c = C[k % C.length];
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.attributes.color.needsUpdate = true;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          vel[i * 3 + 1] -= 9 * dt;
          vel[i * 3] *= 1 - dt * 1.2;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += Math.max(-2.5, vel[i * 3 + 1]) * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (life[i] <= 0) pos[i * 3 + 1] = -999;
        }
        geo.attributes.position.needsUpdate = true;
      },
      clear() { life.fill(0); for (let k = 0; k < n; k++) pos[k * 3 + 1] = -999; geo.attributes.position.needsUpdate = true; },
    };
  }

  JB.Art = { RY, RZ, XU, TOP, BEHIND, wx, rowY, rowZ, buildBar, signTexture, makeCup, makeCoin, makeBalloon, makeAnimal, word, puffTexture, SpritePool, Confetti };
})();
