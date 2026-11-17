(function () {
  'use strict';
  const C = window.EchoCore;
  const $ = id => document.getElementById(id);
  const SUIT_COLOR = { ember: '#e5a34b', tide: '#298fa7', veil: '#8c5cc6' };
  const SUIT_GLOW = { ember: '#ffba5429', tide: '#5ee4fc1f', veil: '#bc81ff22' };
  const KEY_STATS = 'echobound_stats_v1';
  const KEY_INTRO = 'echobound_intro_v1';
  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode: game still playable */ } };
  let stats = Object.assign({ wins: 0, losses: 0, draws: 0, xp: 0, streak: 0, bestStreak: 0 }, load(KEY_STATS, {}));
  let game = C.createGame();
  let selectedCard = null;
  let selectedLane = null;
  let charged = false;
  let overlay = load(KEY_INTRO, false) ? null : 'intro';
  let overlayPrevious = null;
  let lastReport = null;
  let recordedResult = false;
  let toastTimer = null;

  function rank() {
    const xp = stats.xp;
    return xp >= 1800 ? 'SOVEREIGN' : xp >= 1000 ? 'WARDEN' : xp >= 500 ? 'ECHO KNIGHT' : xp >= 200 ? 'SEEKER' : 'INITIATE';
  }
  function resetSelection() { selectedCard = null; selectedLane = null; charged = false; }
  function playerName(owner) { return owner === 0 ? (game.mode === 'local' ? 'PLAYER ONE' : 'YOU') : (game.mode === 'local' ? 'PLAYER TWO' : 'THE RIVAL'); }
  function opponentName(owner) { return owner === 0 ? playerName(1) : playerName(0); }
  function activeHand() { return game.hands[game.active]; }
  function liveScore() { return C.computeWinner(game.vaults); }
  function makeMove() {
    return { cardId: selectedCard, lane: selectedLane, charged };
  }
  function playSelected() {
    if (overlay || game.phase !== 'choose') return;
    if (selectedCard === null || selectedLane === null) { toast('Pick a card and choose a vault first.'); return; }
    const move = makeMove();
    if (game.mode === 'local' && game.active === 0) {
      game.secret = move;
      game.active = 1;
      resetSelection();
      overlay = 'pass';
      render();
      return;
    }
    const move0 = game.mode === 'ai' ? move : game.secret;
    const move1 = game.mode === 'ai' ? game.aiCommitted : move;
    try {
      lastReport = C.resolveRound(game, move0, move1);
      resetSelection();
      if (game.phase === 'finished') {
        recordEnd();
        overlay = 'finished';
      } else overlay = 'reveal';
      render();
    } catch (err) { toast('Could not play that move: ' + err.message); }
  }
  function recordEnd() {
    if (recordedResult || game.mode !== 'ai') return;
    recordedResult = true;
    const w = game.winner.winner;
    if (w === 0) { stats.wins++; stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); stats.xp += 100; }
    else if (w === 1) { stats.losses++; stats.streak = 0; stats.xp += 35; }
    else { stats.draws++; stats.streak = 0; stats.xp += 60; }
    save(KEY_STATS, stats);
  }
  function newGame(force = false) {
    if (!force && game.round > 1 && game.phase !== 'finished' && !window.confirm('Leave this match and start a new one?')) {
      $('modeSelect').value = game.mode; $('difficultySelect').value = game.difficulty;
      return;
    }
    const mode = $('modeSelect').value;
    const difficulty = $('difficultySelect').value;
    game = C.createGame({ mode, difficulty });
    recordedResult = false;
    resetSelection(); lastReport = null; overlay = null; overlayPrevious = null;
    render();
  }
  function advance() {
    if (game.phase !== 'reveal') return;
    game.phase = 'choose';
    if (game.mode === 'ai') game.aiCommitted = C.chooseAI(game);
    overlay = null;
    render();
  }
  function render() {
    const live = liveScore();
    $('roundLabel').textContent = String(Math.min(game.round, C.ROUNDS)).padStart(2, '0');
    $('roundDots').innerHTML = Array.from({ length: C.ROUNDS }, (_, i) => `<span class="round-dot ${i < game.round - 1 ? 'filled' : ''} ${i === game.round - 1 ? 'current' : ''}"></span>`).join('');
    $('modeSelect').value = game.mode; $('difficultySelect').value = game.difficulty;
    $('difficultySelect').disabled = game.mode === 'local';
    $('firstPlayerName').innerHTML = `${playerName(0)} <span class="combatant-level">${game.mode === 'ai' ? rank() : 'LOCAL'}</span>`;
    $('secondPlayerName').innerHTML = `${playerName(1)} <span class="combatant-level">${game.mode === 'ai' ? game.difficulty.toUpperCase() : 'LOCAL'}</span>`;
    $('firstCrowns').textContent = live.crowns[0]; $('secondCrowns').textContent = live.crowns[1];
    $('firstPower').innerHTML = `${live.power[0]}<span>POWER</span>`;
    $('secondPower').innerHTML = `${live.power[1]}<span>POWER</span>`;
    if (game.phase === 'finished') {
      $('hintPrimary').textContent = 'THE GAME IS OVER';
      $('hintSecondary').textContent = 'Whoever won more of the 3 vaults wins the game.';
    } else if (game.phase === 'reveal') {
      $('hintPrimary').textContent = `ROUND ${String(lastReport.round).padStart(2, '0')} REVEALED`;
      $('hintSecondary').textContent = 'Power scored now. New Echo bonuses wait until next round.';
    } else if (game.mode === 'local') {
      $('hintPrimary').textContent = `${playerName(game.active)} · CHOOSE YOUR MOVE`;
      $('hintSecondary').textContent = 'Pick one card and one vault, then press Reveal.';
    } else {
      $('hintPrimary').textContent = !selectedCard ? 'STEP 1: PICK A CARD' : selectedLane === null ? 'STEP 2: PICK A VAULT' : 'STEP 3: REVEAL THE ROUND';
      $('hintSecondary').textContent = !selectedCard ? 'The large card number scores now; Echo is decided next round.' : selectedLane === null ? 'Matching a card symbol to a vault adds +2 Power immediately.' : 'Both players reveal together. See exactly where points go.';
    }
    renderVaults(); renderHand(); renderLastEvent(); renderModal();
    $('footerStats').textContent = `${stats.wins} WINS · ${stats.wins + stats.losses + stats.draws} MATCHES · ${stats.xp} XP`;
  }
  function renderVaults() {
    const locked = game.phase !== 'choose' || overlay !== null;
    $('vaultGrid').classList.toggle('locked', locked);
    $('vaultGrid').innerHTML = C.VAULTS.map((def, idx) => {
      const vault = game.vaults[idx];
      const [me, rival] = vault.score;
      const total = me + rival;
      const ratio = total === 0 ? 50 : 100 * me / total;
      const pending = (game.pending || []).filter(p => p.lane === idx);
      const selected = selectedLane === idx;
      const status = me === rival ? 'TIED' : me > rival ? (game.mode === 'ai' ? 'YOU LEAD' : 'PLAYER ONE LEADS') : (game.mode === 'ai' ? 'RIVAL LEADS' : 'PLAYER TWO LEADS');
      const cardList = vault.plays.slice(-7).map(p => {
        const suit = C.SUITS.find(s => s.key === p.card.suit);
        return `<div class="mini-play owner-${p.owner}" title="${playerName(p.owner)}: ${suit.name} ${p.card.label}, +${p.face} power" style="--mini-color:${SUIT_COLOR[p.card.suit]}">${p.face}<span>${suit.glyph}</span></div>`;
      }).join('');
      return `<button class="vault ${selected ? 'selected' : ''} ${vault.plays.length ? 'has-plays' : ''}" data-lane="${idx}" type="button" style="--vault-color:${def.color};--vault-glow:${SUIT_GLOW[def.key]}" aria-pressed="${selected}" aria-label="${def.name}, player one ${me}, player two ${rival}${selected?', selected':''}">
        <div class="vault-top"><div><div class="vault-caption">${def.caption}</div><div class="vault-name">${def.name}</div></div><div class="vault-bonus"><strong>+2</strong> IF SYMBOL MATCHES</div></div>
        <div class="vault-center"><div class="vault-symbol" aria-hidden="true">${def.glyph}</div><div class="vault-streak">${cardList}</div><div class="vault-echoes">${pending.length ? pending.map(p => `<span class="echo-chip ${p.owner === 0 ? 'mine' : 'theirs'}">${p.owner === 0 ? (game.mode === 'ai' ? 'YOUR' : 'P1') : (game.mode === 'ai' ? 'RIVAL' : 'P2')} ECHO <b>+${p.echo}</b></span>`).join('') : `<span class="echo-chip">${vault.plays.length ? 'NO ACTIVE ECHO' : 'AWAITING CARDS'}</span>`}</div></div>
        <div class="vault-score"><div class="score-side"><span>PLAYER 01</span>${me}</div><div class="score-divider">VS</div><div class="score-side right"><span>PLAYER 02</span>${rival}</div></div>
        <div class="score-bar"><div style="width:${ratio}%"></div><div style="width:${100-ratio}%"></div></div>
        <div class="vault-bottom"><span class="vault-leading">${status}</span><span class="vault-selected-tag">${selected ? '✓ TARGETED' : game.phase === 'choose' ? 'SELECT VAULT →' : 'VAULT'}</span></div>
      </button>`;
    }).join('');
    for (const node of $('vaultGrid').querySelectorAll('[data-lane]')) node.addEventListener('click', () => {
      if (game.phase !== 'choose' || overlay) return;
      selectedLane = Number(node.dataset.lane); render();
    });
  }
  function renderHand() {
    const hand = activeHand();
    $('handEyebrow').textContent = `${game.mode === 'local' ? playerName(game.active) : 'YOUR HAND'} · ${hand.length} CARDS`;
    $('handDescription').innerHTML = '<strong>POWER</strong> scores now · <strong>ECHO</strong> is a bonus decided next round · matching symbol gives +2 Power';
    $('handCount').innerHTML = `${String(game.round).padStart(2, '0')} <span>/ 08 ROUNDS</span>`;
    $('handCards').innerHTML = hand.map((card, index) => {
      const suit = C.SUITS.find(s => s.key === card.suit);
      const isChosen = selectedCard === card.id;
      return `<button type="button" class="hand-card ${isChosen ? 'chosen' : ''}" data-card="${card.id}" aria-pressed="${isChosen}" style="--card-color:${suit.color};--card-deep:${SUIT_COLOR[card.suit]}" title="${suit.name} ${card.label}: ${card.power} base power, ${card.echo} echo">
        <div class="hand-card-top"><div class="card-number">${card.power}</div><div class="card-suit"><i>${suit.glyph}</i>${suit.name.toUpperCase()}</div></div>
        <div class="card-art" aria-hidden="true">${suit.glyph}</div>${isChosen ? '<div class="card-picked">SELECTED</div>' : ''}
        <div class="hand-card-foot"><div class="card-label">${card.label}</div><div class="card-echo"><span class="card-echo-icon">↺</span> <b>${card.echo}</b> NEXT</div></div>
      </button>`;
    }).join('');
    for (const node of $('handCards').querySelectorAll('[data-card]')) node.addEventListener('click', () => {
      if (overlay || game.phase !== 'choose') return;
      selectedCard = node.dataset.card; render();
    });
    $('castBtn').classList.toggle('active', !charged); $('chargeBtn').classList.toggle('active', charged);
    $('castBtn').setAttribute('aria-pressed', String(!charged)); $('chargeBtn').setAttribute('aria-pressed', String(charged));
    const selected = hand.find(c => c.id === selectedCard);
    if (!selected) $('selectionPreview').innerHTML = '1. Choose a card. 2. Choose a vault. 3. Reveal.';
    else if (selectedLane === null) $('selectionPreview').innerHTML = `<strong>${selected.power} base power now</strong> · ${selected.echo} possible Echo later. Choose a vault.`;
    else {
      const name = C.VAULTS[selectedLane].name;
      const rivalPending = (game.pending || []).find(p => p.owner !== game.active && p.lane === selectedLane);
      const extra = rivalPending ? ' You also steal your rival\'s +' + rivalPending.echo + ' previous Echo here this round.' : '';
      const later = game.round === C.ROUNDS ? 'Final round: your new Echo fades without scoring.' : 'NEXT ROUND: +' + C.cardEcho(selected, charged) + ' Echo is yours unless your rival plays ' + name + ' and steals it.';
      $('selectionPreview').innerHTML = '<strong>NOW: +' + C.cardFace(selected, selectedLane, charged) + ' Power in ' + name + '</strong><br>' + later + extra;
    }
    $('commitBtn').disabled = overlay !== null || game.phase !== 'choose' || selectedCard === null || selectedLane === null;
    $('commitBtn').querySelector('span').textContent = game.mode === 'local' && game.active === 0 ? 'LOCK IN MOVE' : 'PLAY CARD';
  }
  function renderLastEvent() {
    if (!lastReport) { $('lastEvent').innerHTML = '<span class="event-glyph">✧</span><span>Each round: POWER scores right away; ECHO scores on the next turn unless your rival plays in that vault.</span>'; return; }
    const steal = lastReport.echoes.filter(e => e.stolen);
    let msg = `Round ${lastReport.round}: ${playerName(0)} played ${C.VAULTS[lastReport.moves[0].lane].name}; ${playerName(1)} played ${C.VAULTS[lastReport.moves[1].lane].name}.`;
    if (steal.length) msg += ` ${steal.length} Echo${steal.length > 1 ? 'es were' : ' was'} stolen.`;
    else if (lastReport.echoes.length) msg += ' Previous Echo points were kept by their owners.';
    else msg += lastReport.faded ? ' New echoes fade on the last round.' : ' New Echo points wait until next round.';
    $('lastEvent').innerHTML = `<span class="event-glyph">✧</span><span>${msg}</span>`;
  }
  function showRules() { overlayPrevious = overlay; overlay = 'rules'; render(); }
  function dismissRules() { overlay = overlayPrevious; overlayPrevious = null; if (overlay === 'intro') { overlay = null; save(KEY_INTRO, true); } render(); }
  function closeIntro() { overlay = null; save(KEY_INTRO, true); render(); }
  function renderModal() {
    const layer = $('modalLayer');
    layer.classList.toggle('hidden', !overlay);
    if (!overlay) { $('modal').innerHTML = ''; return; }
    const modal = $('modal');
    if (overlay === 'intro' || overlay === 'rules') {
      modal.innerHTML = `<div class="modal-eyebrow">ECHOBOUND IN 30 SECONDS</div><h2>Win <em>two of three</em> vaults.</h2>
        <p>Each player secretly plays one card into one vault per round. Scores build up for eight rounds. Win more vaults than your opponent.</p>
        <div class="worked-example"><div class="example-title">EXAMPLE — YOU PLAY A CARD WITH 5 POWER + 3 ECHO</div><p><strong>RIGHT NOW:</strong> You get <b>+5 points</b> in the vault you chose.</p><p><strong>NEXT ROUND:</strong> If your rival plays in that same vault, <b>they steal your +3 Echo.</b> If they play elsewhere, <b>you keep the +3.</b></p></div>
        <div class="simple-steps"><p><b>1.</b> Click a card in your hand (big number = Power, small number = Echo).</p><p><b>2.</b> Click one of the three vaults. A matching symbol gives +2 Power immediately.</p><p><b>3.</b> Click Play Card. Both players' moves and points are revealed.</p><p class="advanced-note"><b>Optional:</b> Charge gives up 2 Power now to add 2 Echo later. The Echo from the final round does not score.</p></div>
        <button id="modalPrimary" class="modal-action" type="button">${overlay === 'intro' ? 'ENTER THE CONTEST' : 'BACK TO THE GAME'}</button>`;
      $('modalPrimary').addEventListener('click', overlay === 'intro' ? closeIntro : dismissRules);
    } else if (overlay === 'pass') {
      modal.innerHTML = `<div class="modal-eyebrow">LOCAL TWO PLAYER MODE</div><h2>Pass the <em>table.</em></h2><p>Player One's move is locked and hidden. Pass the device to Player Two, then continue. No peeking at each other's cards.</p>
      <div class="modal-hero"><span class="hero-symbol">Ⅰ</span><span class="hero-arrows">↝</span><span class="hero-symbol" style="color:#e6afb9">Ⅱ</span></div><button id="modalPrimary" class="modal-action" type="button">PLAYER TWO IS READY</button>`;
      $('modalPrimary').addEventListener('click', () => { overlay = null; render(); });
    } else if (overlay === 'reveal' && lastReport) {
      const report = lastReport;
      modal.innerHTML = `<div class="modal-eyebrow">ROUND ${String(report.round).padStart(2, '0')} · CARDS REVEALED</div><h2>Where did the <em>points go?</em></h2><p>Power from the two cards scores <b>now</b>. Echo bonuses from the <b>previous round</b> are also awarded now. New Echoes wait until the following round.</p>
        <div class="reveal-row">${report.moves.map(m => `<div class="reveal-card ${m.owner === 1 ? 'rival' : ''}"><div class="reveal-owner">${playerName(m.owner)}</div><div class="reveal-card-name">${C.SUITS.find(s=>s.key===m.card.suit).glyph} ${m.card.label}</div><div class="reveal-target">${C.VAULTS[m.lane].name}${m.charged ? ' · CHARGED' : ' · CAST'}</div><div class="reveal-numbers">+${m.face} <span>POWER NOW</span> &nbsp; +${m.echo} <span>ECHO LATER</span></div></div>`).join('')}</div>
        <div class="echo-report">${report.echoes.length ? report.echoes.map(e => `<div class="echo-report-item"><span>${e.stolen ? 'STOLEN — rival entered the vault' : 'KEPT — rival went elsewhere'} · ${C.VAULTS[e.lane].name}</span><strong>+${e.value} to ${playerName(e.to)}</strong></div>`).join('') : '<div class="echo-report-item"><span>FIRST ROUND</span><strong>No previous Echo yet; the two new Echoes can score next round</strong></div>'}</div>
        <div class="after-round-tip">NEXT TURN: Play in your rival's Echo vault to steal their bonus. They can do the same to yours. If either player goes elsewhere, that Echo stays with its owner.</div>
        <button class="modal-action" id="modalPrimary" type="button">CONTINUE TO ROUND ${String(game.round).padStart(2, '0')} ↗</button>`;
      $('modalPrimary').addEventListener('click', advance);
    } else if (overlay === 'finished') {
      const result = game.winner;
      const won = result.winner === null ? 'STALEMATE' : result.winner === 0 ? (game.mode === 'ai' ? 'VICTORY' : 'PLAYER ONE WINS') : (game.mode === 'ai' ? 'DEFEAT' : 'PLAYER TWO WINS');
      const desc = result.winner === null ? 'You tied on vaults controlled and total Power.' : result.winner === 0 ? 'You controlled more vaults at the end of eight rounds.' : 'The rival controlled more vaults at the end of eight rounds.';
      const gained = result.winner === 0 ? 100 : result.winner === 1 ? 35 : 60;
      modal.innerHTML = `<div class="modal-eyebrow">FINAL SCORES · 08 / 08 ROUNDS</div><div class="result-display"><div class="result-symbol">${result.winner === 0 ? '✦' : result.winner === 1 ? '◈' : '✧'}</div><h2>${won}</h2><p>${game.mode === 'local' ? 'The last Echo has faded. The vaults have made their choice.' : desc}</p></div>
        <div class="final-tallies">${C.VAULTS.map((v,i) => { const s=game.vaults[i].score; const leader=s[0]===s[1] ? 'TIED' : s[0]>s[1] ? 'P1 CLAIMS' : 'P2 CLAIMS'; return `<div class="final-tally"><div class="final-title">${v.name.toUpperCase()}</div><div class="final-score">${s[0]} <span style="font-size:12px;color:#8b9db5">:</span> ${s[1]}</div><div class="final-winner">${leader}</div></div>`; }).join('')}</div>
        <div class="reward-line">${game.mode === 'ai' ? `<strong>+${gained} XP</strong> · ${stats.wins} career victories · ${rank()} rank` : `${result.crowns[0]} VAULTS TO PLAYER ONE · ${result.crowns[1]} TO PLAYER TWO`}</div><button id="modalPrimary" class="modal-action" type="button">PLAY ANOTHER MATCH ↗</button><button id="modalSecondary" class="modal-secondary" type="button">VIEW THE FINAL BOARD</button>`;
      $('modalPrimary').addEventListener('click', () => newGame(true));
      $('modalSecondary').addEventListener('click', () => { overlay = null; render(); });
    }
  }
  function toast(message) {
    const t = $('toast'); t.textContent = message; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  $('castBtn').addEventListener('click', () => { if (overlay || game.phase !== 'choose') return; charged = false; render(); });
  $('chargeBtn').addEventListener('click', () => { if (overlay || game.phase !== 'choose') return; charged = true; render(); });
  $('commitBtn').addEventListener('click', playSelected);
  $('rulesBtn').addEventListener('click', showRules);
  $('exampleBtn').addEventListener('click', showRules);
  $('newGameBtn').addEventListener('click', () => newGame(false));
  $('modeSelect').addEventListener('change', () => newGame(false));
  $('difficultySelect').addEventListener('change', () => newGame(false));
  document.addEventListener('keydown', event => {
    if (overlay === 'rules' && event.key === 'Escape') { dismissRules(); return; }
    if (overlay || game.phase !== 'choose') return;
    if (event.key >= '1' && event.key <= '4') {
      const card = activeHand()[Number(event.key) - 1]; if (card) { selectedCard = card.id; render(); }
    } else if ('qwe'.includes(event.key.toLowerCase()) && event.key.length === 1) {
      selectedLane = 'qwe'.indexOf(event.key.toLowerCase()); render();
    } else if (event.key.toLowerCase() === 'c') { charged = !charged; render(); }
    else if (event.key === 'Enter') { if (selectedCard !== null && selectedLane !== null) playSelected(); }
  });
  render();
})();
