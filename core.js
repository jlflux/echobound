/* ECHOBOUND — deterministic, DOM-free game rules. CommonJS + browser compatible. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EchoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SUITS = [
    { key: 'ember', name: 'Ember', glyph: '✦', color: '#f3b66a' },
    { key: 'tide', name: 'Tide', glyph: '◈', color: '#6cd5e8' },
    { key: 'veil', name: 'Veil', glyph: '✧', color: '#c4a2fd' }
  ];
  const VAULTS = [
    { key: 'ember', name: 'Ember Vault', caption: 'EMBER VAULT', glyph: '✦', color: '#f3b66a' },
    { key: 'tide', name: 'Tide Vault', caption: 'TIDE VAULT', glyph: '◈', color: '#6cd5e8' },
    { key: 'veil', name: 'Veil Vault', caption: 'VEIL VAULT', glyph: '✧', color: '#c4a2fd' }
  ];
  const ROUNDS = 8;
  const STARTING_HAND = 4;
  function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function createDeck(random = Math.random) {
    const cards = [];
    const echoes = [4, 4, 3, 3, 2, 1];
    for (const suit of SUITS) {
      for (let p = 2; p <= 7; p++) {
        for (let copy = 0; copy < 3; copy++) {
          const delta = copy === 0 ? 0 : copy === 1 ? -1 : 1;
          cards.push({
            id: suit.key + '-' + p + '-' + copy,
            suit: suit.key,
            power: p,
            echo: Math.max(1, Math.min(5, echoes[p - 2] + delta)),
            label: ['Wisp', 'Vow', 'Signal', 'Relic', 'Oath', 'Crown'][p - 2]
          });
        }
      }
    }
    return shuffle(cards, random);
  }
  function draw(deck, hand, count = 1) {
    while (hand.length < count && deck.length) hand.push(deck.pop());
  }
  function createGame(opts = {}) {
    const random = opts.random || Math.random;
    const deck = createDeck(random);
    const game = {
      version: 1, round: 1, phase: 'choose',
      mode: opts.mode === 'local' ? 'local' : 'ai',
      difficulty: opts.difficulty === 'casual' ? 'casual' : 'tactician',
      deck, hands: [[], []],
      vaults: VAULTS.map(() => ({ score: [0, 0], plays: [] })),
      pending: null, history: [], winner: null,
      active: 0, secret: null, aiCommitted: null
    };
    draw(deck, game.hands[0], STARTING_HAND);
    draw(deck, game.hands[1], STARTING_HAND);
    if (game.mode === 'ai') game.aiCommitted = chooseAI(game, random);
    return game;
  }
  function cardFace(card, lane, charged) {
    if (!card || !Number.isInteger(lane) || lane < 0 || lane >= VAULTS.length) throw new Error('Invalid card or vault');
    return Math.max(1, card.power - (charged ? 2 : 0)) + (card.suit === VAULTS[lane].key ? 2 : 0);
  }
  function cardEcho(card, charged) { return card.echo + (charged ? 2 : 0); }
  function validateMove(game, owner, move) {
    if (!move || !Number.isInteger(move.lane) || move.lane < 0 || move.lane >= 3) throw new Error('Invalid vault');
    if (!move.cardId || !game.hands[owner].some(c => c.id === move.cardId)) throw new Error('Card not in hand');
  }
  function resolveRound(game, first, second) {
    if (game.phase !== 'choose') throw new Error('Round is not accepting moves');
    if (game.round > ROUNDS) throw new Error('Match is complete');
    validateMove(game, 0, first); validateMove(game, 1, second);
    const moves = [first, second].map((move, owner) => {
      const hand = game.hands[owner];
      const ix = hand.findIndex(c => c.id === move.cardId);
      const card = hand.splice(ix, 1)[0];
      const charged = !!move.charged;
      return { owner, lane: move.lane, card, charged, face: cardFace(card, move.lane, charged), echo: cardEcho(card, charged) };
    });
    const echoEvents = [];
    if (game.pending) {
      for (const old of game.pending) {
        const rival = 1 - old.owner;
        const stolen = moves[rival].lane === old.lane;
        const beneficiary = stolen ? rival : old.owner;
        game.vaults[old.lane].score[beneficiary] += old.echo;
        echoEvents.push({ lane: old.lane, from: old.owner, to: beneficiary, value: old.echo, stolen });
      }
    }
    for (const move of moves) {
      const vault = game.vaults[move.lane];
      vault.score[move.owner] += move.face;
      vault.plays.push({ owner: move.owner, card: move.card, charged: move.charged, face: move.face, round: game.round });
    }
    const finished = game.round === ROUNDS;
    const report = { round: game.round, moves, echoes: echoEvents, faded: finished };
    game.history.push(report);
    game.pending = finished ? null : moves.map(m => ({ owner: m.owner, lane: m.lane, echo: m.echo }));
    if (finished) {
      game.phase = 'finished';
      game.winner = computeWinner(game.vaults);
    } else {
      draw(game.deck, game.hands[0], STARTING_HAND);
      draw(game.deck, game.hands[1], STARTING_HAND);
      game.round++;
      game.phase = 'reveal';
    }
    game.secret = null;
    game.aiCommitted = null;
    game.active = 0;
    return report;
  }
  function computeWinner(vaults) {
    const crowns = [0, 0];
    const power = [0, 0];
    for (const vault of vaults) {
      power[0] += vault.score[0]; power[1] += vault.score[1];
      if (vault.score[0] > vault.score[1]) crowns[0]++;
      if (vault.score[1] > vault.score[0]) crowns[1]++;
    }
    let winner = null;
    if (crowns[0] !== crowns[1]) winner = crowns[0] > crowns[1] ? 0 : 1;
    else if (power[0] !== power[1]) winner = power[0] > power[1] ? 0 : 1;
    return { winner, crowns, power };
  }
  function chooseAI(game, random = Math.random) {
    const hand = game.hands[1];
    if (!hand.length) throw new Error('AI has no cards');
    const options = [];
    const round = game.round;
    const remaining = Math.max(1, ROUNDS - round);
    for (const card of hand) for (let lane = 0; lane < 3; lane++) for (const charged of [false, true]) {
      const face = cardFace(card, lane, charged);
      const echo = cardEcho(card, charged);
      const vault = game.vaults[lane];
      const gap = vault.score[1] - vault.score[0];
      const opponentEcho = game.pending && game.pending[0].lane === lane ? game.pending[0].echo : 0;
      const ownEcho = game.pending ? game.pending[1].echo : 0;
      const ownLane = game.pending ? game.pending[1].lane : -1;
      const after = gap + face + opponentEcho;
      const scale = 3.4 + remaining * 1.4;
      const sigmoid = x => 1 / (1 + Math.exp(-x / scale));
      const winSwing = (sigmoid(after) - sigmoid(gap)) * 18;
      const closeContest = Math.max(0, 1 - Math.abs(gap) / (9 + remaining * 3));
      const urgency = round >= 6 ? 1.4 : 1;
      const previousOwnRisk = ownLane === lane ? 0.5 * ownEcho : 0;
      const echoExpectation = round === ROUNDS ? 0 : echo * (gap > 8 ? .12 : .31);
      // AI selects before the human's move and does not see that hidden decision.
      const score = winSwing * urgency + face * .26 + closeContest * 1.0 + opponentEcho * .60 + echoExpectation - previousOwnRisk * .1 + (random() - .5) * (game.difficulty === 'casual' ? 7 : 1.8);
      options.push({ cardId: card.id, lane, charged, score });
    }
    options.sort((a, b) => b.score - a.score);
    if (game.difficulty === 'casual' && options.length > 5) {
      const ix = Math.floor(random() * Math.min(9, options.length));
      const { cardId, lane, charged } = options[ix];
      return { cardId, lane, charged };
    }
    const { cardId, lane, charged } = options[0];
    return { cardId, lane, charged };
  }
  return { SUITS, VAULTS, ROUNDS, STARTING_HAND, shuffle, createDeck, createGame, cardFace, cardEcho, resolveRound, computeWinner, chooseAI };
});
