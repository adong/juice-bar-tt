/* 中文 for TT Juice Bar (果汁吧). Loaded after js/keys.js. The kit translates the page from this dictionary
   (kit/lang.js); 3D words go through Kit.lang.t() where they're drawn. Names stay in English. */
(function () {
  'use strict';
  const L = Kit.lang;
  if (!L) return;
  L.keep(['TEDDY', 'TOMMY', '1P', '2P', 'Claude Code', 'Esc', 'T', 'P', 'M']);
  const BARS = { 'SUNNY BEACH': '阳光海滩', 'JUNGLE HUT': '丛林小屋', 'SNOWY CABIN': '雪地小木屋', 'STARRY NIGHT': '星星之夜' };
  const ANIMALS = { BUNNY: '小兔子', GIRAFFE: '长颈鹿', HIPPO: '河马', PENGUIN: '企鹅' };
  const TREATS = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '盒装果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.add(BARS);
  L.add(ANIMALS);
  L.add({
    [JB.TITLE]: JB.ZH,
    "Teddy & Tommy's super-silly juice bar": 'Teddy 和 Tommy 的超好玩果汁吧',
    '🧃 1 PLAYER': '🧃 单人',
    'serve the thirsty animals': '给口渴的小动物送果汁',
    '👫 2 PLAYERS': '👫 双人',
    'Teddy and Tommy share the bar': 'Teddy 和 Tommy 一起看柜台',
    'slow animals, 5 lives, free splashes': '小动物走得慢，5 条命，洒了也没关系',
    'for big kids': '给大孩子玩',
    'Tommy helps': 'Tommy 来帮忙',
    'Teddy helps': 'Teddy 来帮忙',
    Difficulty: '难度',
    Server: '服务员',
    Wave: '关卡',
    'PLAYER 1': '玩家 1',
    'PLAYER 2': '玩家 2',
    'change counter': '换柜台',
    'walk along it': '沿着柜台走',
    'walk along the counter': '沿着柜台走',
    'hold to pour, let go to slide': '按住倒果汁，松开推杯子',
    'high five (2 players)': '击掌（双人）',
    Space: '空格键',
    Enter: '回车键',
    'Player 1': '玩家 1',
    'Player 2': '玩家 2',
    'In 1 player both sets of keys work. Pour at the tap, catch the empty cups that slide back, and walk out to grab tips.':
      '单人玩时两套按键都能用。在果汁桶那里倒果汁，接住滑回来的空杯子，走过去捡小费。',
    "The round pad changes counter and walks, hold 🧃 to pour, and your brother's face calls him in.":
      '圆形方向盘用来换柜台和走路，按住 🧃 倒果汁，点兄弟的头像叫他来帮忙。',
    "The round pad changes counter (▲ ▼) and walks along it (◀ ▶). Hold 🧃 to pour and let go to slide the cup. Your brother's face calls him in. Two players on one iPad: a pad and a 🧃 each.":
      '圆形方向盘换柜台（▲ ▼），沿着柜台走（◀ ▶）。按住 🧃 倒果汁，松开就把杯子推出去。点兄弟的头像叫他来帮忙。两个人玩一台 iPad：每人一个方向盘和一个 🧃。',
    'hops in quick': '蹦蹦跳跳来得快',
    'a long, long drink': '喝得慢慢的',
    'big and very thirsty': '个子大，特别渴',
    'slides a long way': '一滑滑好远',
    'built with': '制作：',
    '⚡ FAST': '⚡ 快快倒',
    'HOLD TO POUR': '按住倒果汁',
    'Pause (P)': '暂停 (P)',
    'Sound (M)': '声音 (M)',
    'Call your brother (T)': '叫兄弟来帮忙 (T)',
    'High five (T)': '击掌 (T)',
    'P · Esc · Space to carry on · Q for the menu · M sound': 'P · Esc · 空格键 继续 · Q 回菜单 · M 声音',
    'WAVE CLEAR!': '这一关过啦！',
    'GOOD TRY!': '真棒！再试一次！',
    'EVERY ANIMAL HAD A DRINK!': '每个小动物都喝到果汁啦！',
    'READY?': '准备好了吗？',
    'Teddy and Tommy served the same number!': 'Teddy 和 Tommy 送的果汁一样多！',
    'The animals got too thirsty. Have another go!': '小动物们太渴啦，再玩一次吧！',
    SCORE: '分数',
    'HI-SCORE': '最高分',
    'NEW HI-SCORE!': '新的最高分！',
    'ANIMALS SERVED': '喝到果汁的小动物',
    'EMPTY CUPS CAUGHT': '接住的空杯子',
    TIPS: '小费',
    'SERVED THIS WAVE': '这一关送出的果汁',
    'NEXT WAVE ▶': '下一关 ▶',
    '↻ PLAY AGAIN': '↻ 再玩一次',
    'Enter to go on · R to play again · Esc for the menu': '回车键 继续 · R 再玩一次 · Esc 回菜单',
    'Enter or R to play again · Esc for the menu': '回车键或 R 再玩一次 · Esc 回菜单',
    'LOADING…': '加载中…',
    '↻ Turn sideways for a bigger bar!': '↻ 把手机横过来，果汁吧更大！',
    // toasts
    'POUR AT THE TAP →': '到果汁桶那里倒果汁 →',
    'SPLASH! NOBODY CAUGHT IT': '哗啦！没有小动物接住',
    'SPLASH! CATCH THE EMPTY CUPS': '哗啦！要接住空杯子哦',
    'OOPS! A SPLASH': '哎呀！洒了',
    'A TIP! DANCE PARTY!': '有小费！跳舞派对！',
    'HIGH FIVE! QUICK POURING!': '击掌！倒果汁变快啦！',
    // 3D words
    'LET GO!': '松手！',
    'MORE!': '还要！',
    'YUM!': '好喝！',
    'THANKS!': '谢谢！',
    'SLURP!': '咕嘟！',
    'YUMMY!': '真好喝！',
    'WHEEE!': '呜呼！',
    'GLUG GLUG!': '咕嘟咕嘟！',
    'SPLASH!': '哗啦！',
  });
  const name = (s) => s; // TEDDY, TOMMY stay as they are
  L.rule(/^WAVE (\d+) · (.+)$/, (m, n, b) => `第 ${n} 关 · ${BARS[b] || b}`);
  L.rule(/^WAVE (\d+)$/, '第 $1 关');
  L.rule(/^ROUND (\d+): QUICKER ANIMALS!$/, '第 $1 轮：小动物更快啦！');
  L.rule(/^HI-SCORE ([\d,]+)$/, '最高分 $1');
  L.rule(/^(\S+) HELPS$/, (m, w) => `${name(w)} 来帮忙`);
  L.rule(/^(\S+) IS HERE!$/, (m, w) => `${name(w)} 来啦！`);
  L.rule(/^(\S+) WILL COME AGAIN! ×(\d+)$/, (m, w, n) => `${name(w)} 还会再来！×${n}`);
  L.rule(/^(\S+) SAYS: JUICE FOR EVERYONE!$/, (m, w) => `${name(w)} 说：大家都有果汁！`);
  L.rule(/^(\S+) (.+) FROM (\S+)!$/, (m, e, item, w) => `${e} ${name(w)} 送来的${TREATS[item] || item}！`);
  L.rule(/^(BUNNY|GIRAFFE|HIPPO|PENGUIN) WAS TOO THIRSTY!$/, (m, a) => `${ANIMALS[a]}太渴啦，自己去喝啦！`);
  L.rule(/^(\S+) served the most animals!$/, (m, w) => `${name(w)} 送出的果汁最多！`);
  L.rule(/^(\S+) gave every animal a drink!$/, (m, w) => `${name(w)} 让每个小动物都喝到了果汁！`);
  L.rule(/^(TEDDY|TOMMY) (\d+) · (TEDDY|TOMMY) (\d+)$/, '$1 $2 · $3 $4');
})();
