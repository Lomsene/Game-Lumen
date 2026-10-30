// Prints the difficulty curves from src/engine/Balance.ts as a table.
// Run with: npm run balance
// Keep these formulas in sync with Balance.ts.
const hp = (m) => 1 + 0.45 * m + 0.1 * m * m + 0.015 * m ** 3;
const dmg = (m) => 1 + 0.05 * m + 0.002 * m * m;
const drain = (m) => Math.min(10, 2.6 + 0.3 * m);
const lightDrop = (m) => 1 / (1 + m * 0.18);
const elite = (m) => (m * 60 < 50 ? 0 : Math.min(0.18, 0.04 + m * 0.015));
const xpToNext = (l) => Math.floor(10 + 10 * l + 1.5 * l * l);
const bossHp = (n) => Math.round(2400 * 2.5 ** (n - 1));

console.log('\nGegner-Skalierung pro Minute');
console.table(
  [0, 2, 5, 8, 10, 15, 20, 25, 30].map((m) => ({
    Minute: m,
    'HP x': hp(m).toFixed(1),
    'Schaden x': dmg(m).toFixed(2),
    'Licht-Verlust/s': drain(m).toFixed(1),
    'Licht-Drop %': Math.round(lightDrop(m) * 100),
    'Elite %': Math.round(elite(m) * 100)
  }))
);

console.log('XP pro Level');
console.table([1, 5, 10, 20, 30, 50, 75].map((l) => ({ Level: l, 'XP bis nächstes': xpToNext(l) })));

console.log('Endlose Boss-Kette (je 2.5x HP)');
console.table([1, 2, 3, 4, 5, 6, 8, 10].map((n) => ({ Boss: n, HP: bossHp(n).toLocaleString('de-DE') })));
