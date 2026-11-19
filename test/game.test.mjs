import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyAction,publicGame,colorsLeft,ranking,cardInfo} from '../public/game.mjs';

const stack=(game,ids)=>{game.deck=[...game.deck.filter(id=>!ids.includes(id)),...[...ids].reverse()];return game;};

test('a correct guess scores and tracks stats', () => {
  const g=stack(createGame(['Léa','Tom'],['Chanter']),[0]); // as de cœur, rouge
  const next=applyAction(g,{type:'guess',choice:'red'});
  assert.equal(next.players[0].score,1);
  assert.equal(next.streak,1);
  assert.deepEqual(next.players[0].stats,{draws:1,hits:1,purples:0,purpleHits:0,cleanTurns:0});
  assert.equal(next.phase,'playing');
});

test('a missed purple gives two challenges', () => {
  const g=stack(createGame(['Léa','Tom'],['Chanter','Danser']),[0,1]); // deux rouges
  const next=applyAction(g,{type:'guess',choice:'purple'});
  assert.equal(next.phase,'penalty');
  assert.equal(next.pending.length,2);
  assert.equal(next.players[0].penalties,2);
  assert.equal(next.players[0].stats.purples,1);
  assert.equal(next.players[0].stats.purpleHits,0);
});

test('three points pass the hand and count a clean turn', () => {
  let g=stack(createGame(['Léa','Tom'],['Chanter']),[0,30,1]); // rouge, puis rouge+noire
  g=applyAction(g,{type:'guess',choice:'red'});
  g=applyAction(g,{type:'guess',choice:'purple'});
  assert.equal(g.phase,'passed');
  assert.equal(g.players[0].stats.cleanTurns,1);
  g=applyAction(g,{type:'next'});
  assert.equal(g.current,1);
  assert.equal(g.streak,0);
});

test('a turn with a challenge is not clean', () => {
  let g=stack(createGame(['Léa','Tom'],['Chanter']),[30,0,1,2]);
  g=applyAction(g,{type:'guess',choice:'red'});
  g=applyAction(g,{type:'ack'});
  for(let i=0;i<3;i++)g=applyAction(g,{type:'guess',choice:'red'});
  assert.equal(g.phase,'passed');
  assert.equal(g.players[0].stats.cleanTurns,0);
});

test('colours left follow the deck and are exposed publicly', () => {
  let g=stack(createGame(['Léa','Tom'],['Chanter']),[0]);
  assert.deepEqual(colorsLeft(g),{red:26,black:26});
  g=applyAction(g,{type:'guess',choice:'red'});
  assert.deepEqual(colorsLeft(g),{red:25,black:26});
  const pub=publicGame(g);
  assert.equal(pub.deck,undefined);
  assert.deepEqual(colorsLeft(pub),{red:25,black:26});
  assert.equal(colorsLeft({phase:'playing',cardsLeft:40}),null);
});

test('older saves without stats keep working', () => {
  const g=stack(createGame(['Léa','Tom'],['Chanter']),[0]);
  g.players.forEach(p=>delete p.stats);
  const next=applyAction(g,{type:'guess',choice:'black'});
  assert.equal(next.players[0].stats.draws,1);
});

test('rematch keeps player ids and resets stats', () => {
  let g=createGame(['Léa','Tom'],['Chanter']);
  g=applyAction(g,{type:'guess',choice:'red'});
  if(g.phase==='penalty')g=applyAction(g,{type:'ack'});
  g=applyAction(g,{type:'end'});
  const r=applyAction(g,{type:'rematch'});
  assert.deepEqual(r.players.map(p=>p.id),g.players.map(p=>p.id));
  assert.equal(r.players[0].stats.draws,0);
  assert.equal(r.deck.length,52);
});

test('ranking orders by fewest challenges', () => {
  const g=createGame(['A','B','C'],['x']);
  g.players[0].penalties=3;g.players[1].penalties=1;g.players[2].penalties=2;
  assert.deepEqual(ranking(g).map(p=>p.name),['B','C','A']);
  assert.equal(cardInfo(26).color,'black');
});
