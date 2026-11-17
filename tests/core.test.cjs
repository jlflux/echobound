const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

function fakeRand() { return 0.4242; }
function move(game, owner, lane, charged = false) { return { cardId: game.hands[owner][0].id, lane, charged }; }

test('deck contains 54 uniquely identified cards', () => {
  const deck = C.createDeck(fakeRand);
  assert.equal(deck.length, 54);
  assert.equal(new Set(deck.map(c=>c.id)).size,54);
  assert.equal(deck.every(c=>c.power>=2 && c.power<=7 && c.echo>=1 && c.echo<=5),true);
});
test('both sides have equal starting hand size and valid AI move', () => {
  const g = C.createGame({random:fakeRand});
  assert.equal(g.hands[0].length, 4); assert.equal(g.hands[1].length,4);
  assert.ok(g.hands[1].some(c=>c.id===g.aiCommitted.cardId));
});
test('matching suits grant +2 and charge exchanges face for echo', () => {
  const card = {suit:'ember', power:6, echo:2};
  assert.equal(C.cardFace(card,0,false),8);
  assert.equal(C.cardFace(card,0,true),6);
  assert.equal(C.cardEcho(card,true),4);
});
test('echo is captured if rival follows same vault', () => {
  const g = C.createGame({random:fakeRand});
  const a = move(g,0,0), b=move(g,1,1);
  const r1 = C.resolveRound(g,a,b);
  const e0 = r1.moves[0].echo, e1 = r1.moves[1].echo;
  g.phase='choose';
  const before = g.vaults.map(v=>v.score.slice());
  const r2 = C.resolveRound(g,move(g,0,1),move(g,1,0));
  assert.deepEqual(r2.echoes.map(e=>e.stolen), [true,true]);
  assert.equal(g.vaults[0].score[1] - before[0][1] - r2.moves[1].face,e0);
  assert.equal(g.vaults[1].score[0] - before[1][0] - r2.moves[0].face,e1);
});
test('echo returns to card owner if rival takes another vault', () => {
  const g = C.createGame({random:fakeRand});
  const r1 = C.resolveRound(g,move(g,0,0),move(g,1,1));
  g.phase='choose';
  const r2 = C.resolveRound(g,move(g,0,2),move(g,1,2));
  assert.deepEqual(r2.echoes.map(e=>e.stolen), [false,false]);
  assert.equal(r2.echoes[0].to, 0); assert.equal(r2.echoes[1].to,1);
});
test('8 rounds finishes, last echoes fade, winner is computed', () => {
  const g = C.createGame({random:fakeRand});
  let r;
  for (let i=0;i<8;i++) {
    g.phase='choose';
    r=C.resolveRound(g,move(g,0,i%3,i%2===0),move(g,1,(i+1)%3));
  }
  assert.equal(g.phase,'finished');
  assert.equal(g.history.length,8);
  assert.equal(r.faded,true);
  assert.equal(g.pending,null);
  assert.ok(g.winner);
  assert.equal(g.winner.power.reduce((a,b)=>a+b), g.vaults.reduce((sum,v)=>sum+v.score[0]+v.score[1],0));
});
test('no card can be played twice or illegally', () => {
  const g = C.createGame({random:fakeRand});
  const m = move(g,0,0);
  assert.throws(()=>C.resolveRound(g,{...m,lane:3},move(g,1,1)));
  assert.throws(()=>C.resolveRound(g,{cardId:'not-here',lane:0},move(g,1,1)));
});
test('AI can only play from its own hand even after multiple rounds', () => {
  const g=C.createGame({random:Math.random});
  for(let i=0;i<7;i++) {
    const ai=g.aiCommitted;
    assert.ok(g.hands[1].some(c=>c.id===ai.cardId));
    C.resolveRound(g,move(g,0,i%3),ai);
    g.phase='choose'; g.aiCommitted=C.chooseAI(g);
  }
});
