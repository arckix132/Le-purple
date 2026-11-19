// End-of-game titles and the small records kept on this device.
const KEY = 'purple-records-v1';
const blank = () => ({games: 0, cards: 0, purpleHits: 0, cleanTurns: 0, bestPurples: 0, bestClean: 0, counted: []});

export function loadRecords(storage = globalThis.localStorage) {
  try { return {...blank(), ...JSON.parse(storage.getItem(KEY))}; } catch { return blank(); }
}

// Adds a finished game once. `players` are the players this device speaks for.
export function recordGame(key, game, players, storage = globalThis.localStorage) {
  const rec = loadRecords(storage);
  if (!key || rec.counted.includes(key) || !game.history?.length) return {rec, fresh: []};
  const sum = f => players.reduce((n, p) => n + (p.stats?.[f] || 0), 0);
  const fresh = [];
  const topPurples = Math.max(0, ...players.map(p => p.stats?.purpleHits || 0));
  const topClean = Math.max(0, ...players.map(p => p.stats?.cleanTurns || 0));
  if (rec.games > 0 && topPurples > rec.bestPurples && topPurples >= 2) fresh.push(`${topPurples} Purples réussis dans une partie`);
  if (rec.games > 0 && topClean > rec.bestClean && topClean >= 2) fresh.push(`${topClean} tours sans défi dans une partie`);
  rec.games++;
  rec.cards += 52 - (game.cardsLeft ?? game.deck?.length ?? 0);
  rec.purpleHits += sum('purpleHits');
  rec.cleanTurns += sum('cleanTurns');
  rec.bestPurples = Math.max(rec.bestPurples, topPurples);
  rec.bestClean = Math.max(rec.bestClean, topClean);
  rec.counted = [key, ...rec.counted].slice(0, 30);
  try { storage.setItem(KEY, JSON.stringify(rec)); } catch { /* private mode */ }
  return {rec, fresh};
}

const best = (players, score, min = 1) => {
  const top = Math.max(...players.map(score));
  if (!(top >= min)) return null;
  const who = players.filter(p => score(p) === top);
  return who.length === players.length && players.length > 1 ? null : {who, value: top};
};
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function awards(game) {
  const players = game.players.filter(p => p.stats);
  if (players.length < 2) return [];
  const list = [];
  const add = (key, title, found, detail) => { if (found) list.push({key, title, names: found.who.map(p => p.name), detail: detail(found.value)}); };
  add('clean', 'Main de velours', best(players, p => p.stats.cleanTurns), v => plural(v, 'tour sans aucun défi', 'tours sans aucun défi'));
  add('purple', 'As du Purple', best(players, p => p.stats.purpleHits), v => plural(v, 'Purple réussi', 'Purples réussis'));
  add('flair', 'Le flair', best(players.filter(p => p.stats.draws >= 4), p => Math.round(p.stats.hits / p.stats.draws * 100), 60), v => `${v} % de bonnes réponses`);
  add('daring', 'Tête brûlée', best(players, p => p.stats.purples - p.stats.purpleHits, 2), v => plural(v, 'Purple raté', 'Purples ratés'));
  add('busy', 'Lanterne rouge', best(players, p => p.penalties, 3), v => plural(v, 'défi', 'défis'));
  return list;
}
