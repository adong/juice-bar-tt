/* Every number the rules use, the four juice bars (one wave each) and the thirsty animals. The rules (js/sim.js),
   the autopilot (js/bot.js) and the look (js/art.js) all read from here. Classic script: adds to window.JB. */
(function () {
  'use strict';
  const JB = window.JB;
  const L = 12; // a counter's length: the animals' door is at 0, the juice tap at L

  JB.TUNE = {
    ROWS: 4,
    L,
    xMin: 0.9, // how far toward the door a server can walk
    walkV: 6.5, // a server's walking speed along the counter
    cupV: 6.5, // a full cup sliding toward the door
    catchR: 0.55, // an animal catches a full cup this close
    grabR: 0.55, // a server catches an empty this close
    tipR: 0.7, // and grabs a tip this close
    tapR: 0.3, // he can pour this close to the tap
    sendX: L - 0.15, // where a poured cup starts sliding (under the jug's spout)
    fall: 0.6, // an empty this far past the tap end falls off: SPLASH
    fallDoor: 0.95, // a full cup this far past the door end falls off: SPLASH
    spacing: 1.45, // animals in a queue keep this far apart
    endX: L - 1.05, // a thirsty animal that gets this close to the tap is TOO THIRSTY (a life on both levels)
    enterV: 1.6, // walking in through the door
    oopsT: 1.3, // everything waits this long after a life is lost
    floatT: 2.2, // a served animal floats away on a balloon for this long
    boostT: 8, // a treat from your brother: quicker pouring for this long
    highFiveT: 6,
    boostFill: 0.5, // pouring takes half as long while boosted
    boostWalk: 1.25,
    rhythm: { walk: 1.1, pause: 0.7 }, // animals walk a bit, stop for a look around, walk a bit
    loopSpeed: 0.15, // each time round all four bars, the animals walk this much quicker
    score: { catch: 50, served: 100, empty: 100, tip: 250, wave: 500, life: 100 },
    diff: {
      easy: {
        lives: 5, lives2: 6, fillT: 0.45, emptyV: 2.3, slideV: 5.5, slide: 4.6, drinkT: 0.7, tipP: 0.4, tipT: 9, danceT: 3,
        splashLife: false, thirsty2: 0, // splashes are free; every animal wants one cup
        speed: [0.42, 0.47, 0.52, 0.57], count: [4, 5, 6, 7], gap: [4.6, 4.2, 3.8, 3.4], perRow: [1, 1, 2, 2],
      },
      normal: {
        lives: 3, lives2: 4, fillT: 0.6, emptyV: 3.0, slideV: 5.5, slide: 3.4, drinkT: 0.8, tipP: 0.28, tipT: 6, danceT: 2,
        splashLife: true, thirsty2: 0.22, // splashes cost a life; some animals want two cups
        speed: [0.7, 0.8, 0.88, 0.96], count: [6, 8, 10, 12], gap: [3.1, 2.8, 2.5, 2.25], perRow: [2, 2, 3, 3],
      },
    },
    buddy: { inT: 0.55, sigT: 1.5, treatT: 0.6, pourT: 0.7, outT: 0.55, queue: 3 },
  };

  // The thirsty animals. speed and slide multiply the level's numbers; thirst adds cups on NORMAL.
  JB.ANIMALS = [
    { kind: 'bunny', name: 'BUNNY', emoji: '🐰', speed: 1.12, slide: 1, thirst: 0, does: 'hops in quick' },
    { kind: 'giraffe', name: 'GIRAFFE', emoji: '🦒', speed: 0.92, slide: 1, thirst: 0, does: 'a long, long drink' },
    { kind: 'hippo', name: 'HIPPO', emoji: '🦛', speed: 0.82, slide: 0.75, thirst: 1, does: 'big and very thirsty' },
    { kind: 'penguin', name: 'PENGUIN', emoji: '🐧', speed: 1, slide: 1.4, thirst: 0, does: 'slides a long way' },
  ];

  // The four juice bars, one wave each, then round 2 goes round them again, quicker.
  // Each counter pours its own juice (a colour for the cups and the jug).
  JB.LEVELS = [
    {
      name: 'SUNNY BEACH', emoji: '🏖️',
      theme: { wall: '#ffe9a8', wall2: '#ffd36b', floor: '#ffb86b', counter: '#25c2c9', top: '#e9fbff', trim: '#ff6f91', sky: '#8fe3ff', deco: 'beach' },
    },
    {
      name: 'JUNGLE HUT', emoji: '🌴',
      theme: { wall: '#c9f2b0', wall2: '#9fdc7c', floor: '#c98b52', counter: '#a0643a', top: '#fff1d6', trim: '#ffcf3f', sky: '#bff5ff', deco: 'jungle' },
    },
    {
      name: 'SNOWY CABIN', emoji: '⛄',
      theme: { wall: '#e8f3ff', wall2: '#cfe3ff', floor: '#9ec7ff', counter: '#ff5a6e', top: '#ffffff', trim: '#4fa3ff', sky: '#dff1ff', deco: 'snow' },
    },
    {
      name: 'STARRY NIGHT', emoji: '🌙',
      theme: { wall: '#5a4fb8', wall2: '#463d99', floor: '#7a6be0', counter: '#ffcf3f', top: '#fff8e0', trim: '#ff6fd8', sky: '#1d1a52', deco: 'night', night: true },
    },
  ];
  // the juice on each counter, from the bottom one up
  JB.JUICES = [
    { name: 'ORANGE', color: '#ff9a1f', fruit: '🍊' },
    { name: 'STRAWBERRY', color: '#ff4f7b', fruit: '🍓' },
    { name: 'APPLE', color: '#7ed957', fruit: '🍏' },
    { name: 'GRAPE', color: '#a46bff', fruit: '🍇' },
  ];
  JB.HEROES = ['teddy', 'tommy'];
  JB.TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
})();
