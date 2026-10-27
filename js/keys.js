/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: JB.TITLE,
  cols: ['Player 1', 'Player 2'],
  keys: [
    ['change counter', 'W S', '↑ ↓'],
    ['walk along the counter', 'A D', '← →'],
    ['hold to pour, let go to slide', 'Space or F', 'Enter or /'],
    ['call your brother', 'T', ''],
    ['high five (2 players)', 'T', ''],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: 'In 1 player both sets of keys work. Pour at the tap, catch the empty cups that slide back, and walk out to grab tips.',
  touch: "The round pad changes counter and walks, hold 🧃 to pour, and your brother's face calls him in.",
});
