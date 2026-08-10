
(function(){
  // ---------- challenge bank ----------
  const CHALLENGES = [
    { pattern: "^[a-z]+$",            hint: "Type it the way it would look if you never touched Shift.",                     regex: /^[a-z]+$/ },
    { pattern: "^\\d{3}-\\d{4}$",     hint: "How an office directory might list someone's extension.",                       regex: /^\d{3}-\d{4}$/ },
    { pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", hint: "Where a company might send you a confirmation message.", regex: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/ },
    { pattern: "^(0|[1-9]\\d*)$",     hint: "How you'd write an amount on a receipt — nothing padded at the front.",         regex: /^(0|[1-9]\d*)$/ },
    { pattern: "^#[0-9A-Fa-f]{6}$",   hint: "You'd find this in a design tool's color picker.",                              regex: /^#[0-9A-Fa-f]{6}$/ },
    { pattern: "^\\S+$",              hint: "Something you could send as a single word, no spacebar involved.",              regex: /^\S+$/ },
    { pattern: "^[A-Z][a-z]*$",       hint: "How a name looks at the start of a sentence.",                                  regex: /^[A-Z][a-z]*$/ },
    { pattern: "^(https?:\\/\\/)[^\\s]+$", hint: "Something you'd paste into your browser's address bar.",                   regex: /^(https?:\/\/)[^\s]+$/ },
    { pattern: "^\\d{4}-\\d{2}-\\d{2}$",   hint: "How a spreadsheet or database usually stores a calendar date.",            regex: /^\d{4}-\d{2}-\d{2}$/ },
    { pattern: "^[a-zA-Z]\\w{3,15}$", hint: "Something you'd type when signing up for an account.",                          regex: /^[a-zA-Z]\w{3,15}$/ },
    { pattern: "^(?=.*[A-Z])(?=.*\\d).{6,}$", hint: "Something a website says is \"too weak\" if you don't mix it up enough.", regex: /^(?=.*[A-Z])(?=.*\d).{6,}$/ },
    { pattern: "^\\+?\\d{1,3}[ -]?\\d{7,10}$", hint: "How you'd write a mobile number when calling from abroad.",            regex: /^\+?\d{1,3}[ -]?\d{7,10}$/ }
  ];
  const TOTAL_ROUNDS = 10;
  const TIME_LIMIT_S = 40; // seconds shown on the drain bar before it bottoms out
  const MAX_LIVES = 5;
  const WRONG_ANSWER_TIME_PENALTY_S = 5; // seconds burned off the clock per wrong guess

  // ---------- state ----------
  let queue = [];          // challenges still left to correctly answer (or fail)
  let completedCount = 0;  // how many of the 10 have been resolved (correct or failed)
  let score = 0;
  let correctCount = 0;
  let totalCorrectTime = 0;
  let questionStart = 0;
  let timerInterval = null;
  let locked = false;
  let lives = MAX_LIVES;
  let streak = 0;

  // ---------- elements ----------
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    game: document.getElementById('screen-game'),
    end: document.getElementById('screen-end')
  };
  const scoreDisplay = document.getElementById('score-display');
  const progressText = document.getElementById('progress-text');
  const dotsEl = document.getElementById('dots');
  const regexDisplay = document.getElementById('regex-display');
  const hintDisplay = document.getElementById('hint-display');
  const answerInput = document.getElementById('answer-input');
  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedback-text');
  const feedbackPoints = document.getElementById('feedback-points');
  const timerbar = document.getElementById('timerbar');
  const timerTrack = document.querySelector('.timerbar-track');
  const btnSubmit = document.getElementById('btn-submit');
  const btnSkip = document.getElementById('btn-skip');
  const livesEl = document.getElementById('lives');
  const cardEl = document.querySelector('.card');
  const comboPop = document.getElementById('combo-pop');
  const rankLine = document.getElementById('rank-line');

  function renderLives(){
    livesEl.innerHTML = '';
    for(let i = 0; i < MAX_LIVES; i++){
      const h = document.createElement('span');
      h.className = 'heart' + (i >= lives ? ' lost' : '');
      h.textContent = '♥';
      livesEl.appendChild(h);
    }
  }

  function beep(freq, dur, type, vol){
    try{
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol || 0.05;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.stop(ctx.currentTime + dur);
    }catch(e){}
  }

  function spawnParticles(x, y){
    const colors = ['#ff3d8a', '#e12979', '#ffb8d8'];
    for(let i = 0; i < 14; i++){
      const p = document.createElement('div');
      p.className = 'particle';
      const color = colors[i % colors.length];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = color;
      p.style.boxShadow = '0 0 8px ' + color;
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 80;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.animate([
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }
      ], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' });
      setTimeout(() => p.remove(), 1000);
    }
  }

  function popCombo(text){
    comboPop.textContent = text;
    comboPop.classList.remove('fire');
    void comboPop.offsetWidth;
    comboPop.classList.add('fire');
  }

  function shakeCard(){
    cardEl.classList.remove('shake-card');
    void cardEl.offsetWidth;
    cardEl.classList.add('shake-card');
  }

  function rankFor(finalScore){
    if(finalScore >= 90) return 'Regex Grandmaster';
    if(finalScore >= 65) return 'Pattern Veteran';
    if(finalScore >= 40) return 'String Wrangler';
    if(finalScore >= 15) return 'Backslash Rookie';
    return 'Rookie Parser';
  }

  function resetTimerVisual(){
    timerbar.style.transition = 'none';
    timerbar.style.transform = 'scaleX(1)';
    timerbar.style.background = 'linear-gradient(90deg, var(--pink-primary), var(--pink-primary-dark))';
  }

  function showScreen(name){
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');

    if(name === 'game'){
      timerTrack.style.display = '';
    } else {
      // Not in a round: fully stop and hide the timer so it can't keep
      // animating in the background on the welcome/end screens.
      clearInterval(timerInterval);
      timerTrack.style.display = 'none';
      resetTimerVisual();
    }
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildDots(){
    dotsEl.innerHTML = '';
    for(let i = 0; i < TOTAL_ROUNDS; i++){
      const d = document.createElement('div');
      d.className = 'dot';
      dotsEl.appendChild(d);
    }
  }
  function updateDots(){
    const dots = dotsEl.children;
    for(let i = 0; i < dots.length; i++){
      dots[i].classList.remove('done','current');
      if(i < completedCount) dots[i].classList.add('done');
      else if(i === completedCount) dots[i].classList.add('current');
    }
  }

  function startGame(){
    queue = shuffle(CHALLENGES).slice(0, TOTAL_ROUNDS);
    completedCount = 0;
    score = 0;
    correctCount = 0;
    totalCorrectTime = 0;
    lives = MAX_LIVES;
    streak = 0;
    scoreDisplay.textContent = '0';
    renderLives();
    buildDots();
    showScreen('game');
    loadRound();
  }

  function loadRound(){
    locked = false;
    const c = queue[0];
    progressText.textContent = `Challenge ${completedCount+1} / ${TOTAL_ROUNDS}`;
    updateDots();
    regexDisplay.textContent = '/' + c.pattern + '/';
    hintDisplay.innerHTML = 'Hint: <b>' + c.hint + '</b>';
    answerInput.value = '';
    answerInput.classList.remove('correct','incorrect');
    feedback.classList.remove('show','correct','incorrect');
    answerInput.disabled = false;
    btnSubmit.disabled = false;
    btnSkip.disabled = false;
    answerInput.focus();

    questionStart = Date.now();
    clearInterval(timerInterval);
    resetTimerVisual();
    void timerbar.offsetWidth; // reflow
    timerbar.style.transition = `transform ${TIME_LIMIT_S}s linear, background-color 0.3s`;
    requestAnimationFrame(() => { timerbar.style.transform = 'scaleX(0)'; });

    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - questionStart) / 1000;
      if(elapsed > TIME_LIMIT_S * 0.66){
        timerbar.style.background = 'linear-gradient(90deg, #e0396a, #b8214f)';
      }
      if(elapsed >= TIME_LIMIT_S && !locked){
        failRound("Time's up!");
      }
    }, 200);
  }

  function elapsedSeconds(){
    return (Date.now() - questionStart) / 1000;
  }

  // Instantly burns `penaltySeconds` off the clock and re-syncs the
  // draining animation to continue from the new (smaller) remaining time.
  function applyTimePenalty(penaltySeconds){
    questionStart -= penaltySeconds * 1000;
    const elapsed = Math.min(elapsedSeconds(), TIME_LIMIT_S);
    const scale = Math.max(0, 1 - elapsed / TIME_LIMIT_S);

    timerbar.style.transition = 'none';
    timerbar.style.transform = `scaleX(${scale})`;
    if(elapsed > TIME_LIMIT_S * 0.66){
      timerbar.style.background = 'linear-gradient(90deg, #e0396a, #b8214f)';
    }
    void timerbar.offsetWidth; // reflow so the jump applies instantly, no transition

    const remainingTime = Math.max(0, TIME_LIMIT_S - elapsed);
    timerbar.style.transition = `transform ${remainingTime}s linear, background-color 0.3s`;
    requestAnimationFrame(() => { timerbar.style.transform = 'scaleX(0)'; });

    shakeCard();
  }

  // Called whenever the clock actually runs out — naturally, or because
  // repeated wrong answers drained it to zero. This is the ONLY place
  // a heart gets lost (besides being explicitly out of time on submit).
  function failRound(message){
    if(locked) return;
    locked = true;
    clearInterval(timerInterval);
    streak = 0;

    queue.shift(); // this challenge is resolved (failed) — it does not return
    completedCount += 1;
    lives -= 1;
    renderLives();
    shakeCard();

    feedback.classList.remove('correct');
    feedback.classList.add('show','incorrect');
    feedbackText.textContent = message;
    feedbackPoints.textContent = '';
    answerInput.disabled = true;
    btnSubmit.disabled = true;
    btnSkip.disabled = true;
    beep(160, .35, 'sawtooth', .06);

    setTimeout(() => {
      if(lives <= 0){
        endGame();
      } else if(queue.length === 0){
        endGame();
      } else {
        loadRound();
      }
    }, 900);
  }

  function submitAnswer(){
    if(locked) return;
    const val = answerInput.value;
    const c = queue[0];
    const isMatch = c.regex.test(val);

    if(isMatch){
      locked = true;
      clearInterval(timerInterval);
      const secs = elapsedSeconds();
      const penalty = Math.floor(secs);
      streak += 1;
      const base = Math.max(0, 10 - penalty);
      const comboMult = 1 + Math.min(streak - 1, 4) * 0.25;
      const earned = Math.round(base * comboMult);
      score += earned;
      correctCount += 1;
      totalCorrectTime += secs;
      queue.shift();
      completedCount += 1;
      scoreDisplay.textContent = String(score);

      answerInput.classList.add('correct');
      answerInput.disabled = true;
      btnSubmit.disabled = true;
      btnSkip.disabled = true;
      feedback.classList.add('show','correct');
      feedbackText.textContent = 'Correct!';
      feedbackPoints.textContent = `+${earned} pts (${secs.toFixed(1)}s)`;

      beep(720, .12, 'triangle', .06);
      setTimeout(() => beep(980, .14, 'triangle', .05), 90);
      const rect = answerInput.getBoundingClientRect();
      spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2);
      if(streak >= 2){ popCombo(`Combo x${streak}!`); }

      setTimeout(() => {
        if(queue.length === 0){ endGame(); } else { loadRound(); }
      }, 950);

    } else {
      // WRONG ANSWER: this NEVER touches hearts directly.
      // If there's still time on the clock, it just burns some of it off.
      // Only if the clock is already at zero does this click count as
      // running out of time (which is the only thing that costs a heart).
      const remaining = TIME_LIMIT_S - elapsedSeconds();

      streak = 0;
      answerInput.classList.remove('correct');
      answerInput.classList.add('incorrect');
      beep(180, .18, 'sawtooth', .05);
      setTimeout(() => answerInput.classList.remove('incorrect'), 350);

      if(remaining <= 0){
        failRound('Incorrect! Out of time.');
      } else {
        const penalty = Math.min(remaining, WRONG_ANSWER_TIME_PENALTY_S);
        feedback.classList.remove('correct');
        feedback.classList.add('show','incorrect');
        feedbackText.textContent = 'Incorrect! Try again.';
        feedbackPoints.textContent = `-${penalty.toFixed(1)}s`;
        applyTimePenalty(penalty);
      }
    }
  }

  function skipRound(){
    if(locked) return;
    locked = true;
    clearInterval(timerInterval);
    streak = 0;
    // Send this challenge to the back of the line instead of dropping it —
    // it'll come back around later in this same game.
    queue.push(queue.shift());
    loadRound();
  }

  function endGame(){
    clearInterval(timerInterval);
    renderLives(); // make sure the final heart state (e.g. all lost) is shown
    showScreen('end');
    document.getElementById('final-score').textContent = String(score);
    document.getElementById('stat-correct').textContent = `${correctCount} / ${TOTAL_ROUNDS}`;
    const avg = correctCount > 0 ? (totalCorrectTime / correctCount) : 0;
    document.getElementById('stat-avg').textContent = avg.toFixed(1) + 's';
    rankLine.textContent = 'Rank: ' + rankFor(score) + (lives <= 0 ? ' · Out of lives' : '');
  }

  renderLives();
  timerTrack.style.display = 'none'; // hidden until the game screen is shown

  // ---------- events ----------
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  btnSubmit.addEventListener('click', submitAnswer);
  btnSkip.addEventListener('click', skipRound);
  answerInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); submitAnswer(); }
  });
})();
