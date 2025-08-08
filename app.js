(function(){
  const state = {
    idx: 0,
    current: null,
    placed: [],
    stats: JSON.parse(localStorage.getItem("lt_stats") || "{}")
  };

  // Elements
  const pool = qs("#word-pool");
  const canvas = qs("#canvas");
  const result = qs("#result");
  const correctSentence = qs("#correct-sentence");
  const explanation = qs("#explanation");
  const scoreChip = qs("#score-chip");
  const btnNext = qs("#btn-next");
  const btnCheck = qs("#btn-check");
  const btnShuffle = qs("#btn-shuffle");
  const btnReset = qs("#btn-reset");
  const progressText = qs("#progress-text");
  const progressBar = qs("#progress-bar");

  // Nav
  const views = {
    game: qs("#view-game"),
    stats: qs("#view-stats"),
    help: qs("#view-help")
  };
  on("#nav-game","click", () => showView("game"));
  on("#nav-stats","click", () => { renderStats(); showView("stats"); });
  on("#nav-help","click", () => showView("help"));

  on(btnCheck,"click", checkAnswer);
  on(btnNext,"click", nextRound);
  on(btnShuffle,"click", () => { shufflePool(); });
  on(btnReset,"click", () => { setupRound(state.idx, true); });

  on("#btn-clear-stats","click", () => {
    localStorage.removeItem("lt_stats");
    state.stats = {};
    renderStats();
  });

  function showView(name){
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    qs("#nav-"+name).classList.add("active");
    Object.entries(views).forEach(([k,el])=> el.classList.toggle("active", k===name));
  }

  function saveStats(){
    localStorage.setItem("lt_stats", JSON.stringify(state.stats));
  }

  function updateProgress(){
    const total = window.EXERCISES.length;
    progressText.textContent = `${state.idx+1}/${total} complete`;
    progressBar.style.width = `${((state.idx)/total)*100}%`;
  }

  function renderStats(){
    const s = state.stats;
    qs("#st-rounds").textContent = s.rounds||0;
    qs("#st-perfect").textContent = s.perfect||0;
    const acc = s.answers && s.answers.count ? Math.round((s.answers.correct / s.answers.count)*100) : 0;
    qs("#st-accuracy").textContent = acc + "%";
    qs("#st-learned").textContent = s.learned||0;
  }

  function nextRound(){
    state.idx = (state.idx + 1) % window.EXERCISES.length;
    setupRound(state.idx, true);
    showView("game");
  }

  function setupRound(index, animate){
    state.current = clone(window.EXERCISES[index]);
    state.placed = [];
    pool.innerHTML = "";
    canvas.innerHTML = "";
    result.classList.add("hidden");
    canvas.classList.toggle("active", false);
    updateProgress();

    // shuffle and render pool
    const shuffled = shuffle(state.current.words.map((w,i)=>({...w, i})));
    shuffled.forEach((obj, idx) => {
      const el = createBlock(obj.w);
      el.dataset.index = obj.i;
      pool.appendChild(el);
      if (animate){
        el.animate([{transform:"scale(0.9)", opacity:0},{transform:"scale(1)", opacity:1}],{duration:220, easing:"ease-out", delay: idx*30});
      }
    });

    // allow dragging within canvas
    initDragAndDrop();
  }

  function createBlock(text){
    const el = document.createElement("div");
    el.className = "block";
    el.textContent = text;
    el.tabIndex = 0;
    el.setAttribute("role","button");
    return el;
  }

  function shufflePool(){
    const children = Array.from(pool.children);
    for (let i = children.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      pool.appendChild(children[j]);
      children.splice(j,1);
    }
  }

  function initDragAndDrop(){
    let dragged = null;
    function handleDragStart(e){
      dragged = this;
      requestAnimationFrame(()=> canvas.classList.add("active"));
    }

    function handleDropTo(target, afterEl=null){
      if (!dragged) return;
      if (target === pool){
        pool.insertBefore(dragged, afterEl);
      }else{
        target.insertBefore(dragged, afterEl);
      }
      dragged.animate([{transform:"scale(0.95)"},{transform:"scale(1)"}],{duration:150});
      dragged = null;
    }

    // pointer-based drag (no HTML5 DnD to keep crisp)
    [pool, canvas].forEach(container => {
      container.addEventListener("pointerdown", (e)=>{
        const target = e.target.closest(".block");
        if (!target) return;
        dragged = target;
        const rect = target.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const ghost = target.cloneNode(true);
        ghost.style.position="fixed";
        ghost.style.left=rect.left+"px";
        ghost.style.top=rect.top+"px";
        ghost.style.width=rect.width+"px";
        ghost.style.pointerEvents="none";
        ghost.style.opacity="0.9";
        ghost.style.zIndex="50";
        ghost.classList.add("dragging-ghost");
        document.body.appendChild(ghost);
        target.style.opacity="0.2";

        const placeholder = document.createElement("div");
        placeholder.className="placeholder";
        target.parentElement.insertBefore(placeholder, target.nextSibling);

        function move(ev){
          ghost.style.left = (ev.clientX - offsetX) + "px";
          ghost.style.top = (ev.clientY - offsetY) + "px";

          const withinCanvas = isInside(ev, canvas);
          const withinPool = isInside(ev, pool);

          if (withinCanvas){
            const after = getAfterElement(canvas, ev.clientX, ev.clientY);
            canvas.insertBefore(placeholder, after);
          }else if (withinPool){
            const after = getAfterElement(pool, ev.clientX, ev.clientY);
            pool.insertBefore(placeholder, after);
          }
        }

        function up(ev){
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          ghost.remove();
          target.style.opacity="1";
          const parent = placeholder.parentElement;
          parent.insertBefore(target, placeholder);
          placeholder.remove();
          dragged = null;
        }

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
    });
  }

  function getAfterElement(container, x, y){
    const els = [...container.querySelectorAll(".block:not(.dragging-ghost)")];
    return els.find(el => {
      const r = el.getBoundingClientRect();
      return x < r.left + r.width/2 && y < r.bottom;
    }) || null;
  }

  function isInside(ev, el){
    const r = el.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  function checkAnswer(){
    const blocks = Array.from(canvas.querySelectorAll(".block"));
    if (blocks.length === 0) return;

    // clear old chips
    blocks.forEach(b => {
      const old = b.querySelector(".chip");
      if (old) old.remove();
    });

    const total = state.current.words.length;
    let correctCount = 0;

    blocks.forEach((b, idx) => {
      const originalIndex = parseInt(b.dataset.index,10);
      const isCorrect = originalIndex === idx;
      const chip = document.createElement("span");
      chip.className = "chip " + (isCorrect ? "success" : "error");
      chip.textContent = isCorrect ? "✓" : "✗";
      b.appendChild(chip);
      if (isCorrect) correctCount++;
    });

    scoreChip.textContent = `${correctCount} / ${total} correct`;

    // show correct sentence with POS tooltips
    correctSentence.innerHTML = "";
    state.current.words.forEach((obj, idx) => {
      const span = document.createElement("span");
      span.className = "correct-word";
      span.innerHTML = `${escapeHtml(obj.w)} <span class="tooltip">${obj.pos}</span>`;
      correctSentence.appendChild(span);
    });

    explanation.textContent = state.current.explanation;
    result.classList.remove("hidden");

    // update stats
    const s = state.stats;
    s.rounds = (s.rounds||0) + 1;
    s.answers = s.answers || {count:0, correct:0};
    s.answers.count += total;
    s.answers.correct += correctCount;
    if (correctCount === total) s.perfect = (s.perfect||0)+1;
    s.learned = (s.learned||0) + Math.max(1, Math.floor((total - correctCount)/2));
    saveStats();
    renderStats();
  }

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    })[s]);
  }

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function qs(s){ return document.querySelector(s); }
  function on(el, ev, fn){
    if (typeof el === "string") el = qs(el);
    el && el.addEventListener(ev, fn);
  }
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  // boot
  setupRound(0, true);
  renderStats();
})();