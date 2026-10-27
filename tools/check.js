#!/usr/bin/env node
/* Runs the headless check in Node (no browser, no npm):
     node tools/check.js            the rules check, the autopilot soak (every wave, Easy and Normal, 1 and 2 players)
                                    and the fail variant (each broken rule must be caught)
     node tools/check.js --soak     also soak 3 seeds of every wave with the companion called
   Loads the game's own rule files into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
ctx.Kit = {};
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/config.js', 'js/sim.js', 'js/bot.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.JB.Check;
const args = process.argv.slice(2);
let bad = 0;

const r = C.checkAll();
console.log(`rules check (${(r.ms / 1000).toFixed(1)} s):`);
console.log(`  1 the same at any fps: ${r.fps} runs at 20, 30, 60, 144 fps and a wobbly frame rate`);
console.log(`  2 catch, drink, slide back: ${r.catches} animals`);
console.log(`  3 empties come back and can be caught: ${r.empties} empties`);
console.log(`  4 splashes cost a life only on NORMAL: ${r.splashes} splashes`);
console.log(`  5 a wave ends when every animal is served: checked by hand and in every soak below`);
console.log(`  random keys: ${r.keys.toLocaleString()} frames, nobody left the counters`);
for (const s of r.soaks) console.log(`  soak wave ${s.n + 1} ${s.name.padEnd(13)} ${s.diff.padEnd(6)} ${s.two ? '2P' : '1P'} ${s.result.padEnd(5)} ${String(s.time).padStart(4)} s  served ${s.done}/${s.total}  lives lost ${s.lost}  splashes ${s.splashes}  tips ${s.tips}  score ${s.score}`);
for (const f of r.fails) console.log('  FAIL', f);
bad += r.fails.length;

if (args.includes('--soak')) {
  for (const diff of ['easy', 'normal']) {
    let clear = 0, total = 0, calls = 0, lost = 0;
    for (let n = 0; n < ctx.JB.LEVELS.length + 1; n++) for (let seed = 1; seed <= 3; seed++) {
      const s = C.soak({ n, diff, seed, buddy: true });
      total++;
      calls += s.calls;
      lost += s.lost;
      if (s.result === 'clear' && !s.early) clear++;
      else { bad++; console.log(`  FAIL soak + companion ${diff} wave ${n + 1} seed ${seed}: ${s.result} after ${s.time} s`); }
    }
    console.log(`soak ${diff} 1P + companion: ${clear}/${total} cleared, ${calls} calls, ${lost} lives lost`);
  }
}

const sab = C.sabotage();
console.log(`fail variant: ${sab.filter((s) => s.caught).length} of ${sab.length} broken rules caught`);
for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.what}${s.caught ? '  (' + s.first + ')' : ''}`);
bad += sab.filter((s) => !s.caught).length;

console.log(bad ? `${bad} problem(s)` : 'all good');
process.exit(bad ? 1 : 0);
