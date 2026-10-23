(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // Hero: satırlar kendi taban çizgilerinin arkasından yükselir
  const start = () => root.classList.add('loaded');
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(() => requestAnimationFrame(start));
  } else {
    requestAnimationFrame(start);
  }

  // Bölüm girişleri: başlık, metin, görsel sırayla
  const items = [...document.querySelectorAll('[data-r]')];
  const groups = new Map();
  items.forEach(el => {
    const sec = el.closest('section, footer, article') || document.body;
    const list = groups.get(sec) || [];
    el.style.setProperty('--d', `${Math.min(list.length, 6) * 75}ms`);
    list.push(el);
    groups.set(sec, list);
  });
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(el => io.observe(el));
  }

  // Gravür: kaydırdıkça yavaşça yaklaşır
  const band = document.querySelector('.band img');
  if (band && !reduce) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = band.parentElement.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      band.style.transform = `scale(${1.14 - p * 0.14}) translateY(${(p - 0.5) * -3}%)`;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ---------- A-Maze-ing: DFS ile üret, BFS ile çöz ----------
  const canvas = document.getElementById('maze-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const stat = document.getElementById('maze-stat');
  const btnSolve = document.getElementById('maze-solve');
  const btnNew = document.getElementById('maze-new');
  const C = { wall: '#470c35', open: '#1b0e17', seen: '#8a2a5c', front: '#ff488b', path: '#ffffff' };

  let cols, rows, block, grid, anim = 0, solved = false, busy = false;

  function size() {
    const w = canvas.parentElement.clientWidth;
    const phone = w < 520;
    block = phone ? 10 : w < 820 ? 12 : 14;
    cols = Math.floor(w / block); if (cols % 2 === 0) cols--;
    rows = Math.round(cols * (phone ? 0.95 : 0.56)); if (rows % 2 === 0) rows--;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cols * block * dpr;
    canvas.height = rows * block * dpr;
    canvas.style.aspectRatio = `${cols} / ${rows}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const cell = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x * block, y * block, block, block); };

  function generate() {
    grid = Array.from({ length: rows }, () => new Uint8Array(cols)); // 0 duvar, 1 koridor
    const order = [];
    const stack = [[1, 1]];
    grid[1][1] = 1; order.push([1, 1]);
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const next = dirs
        .map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
        .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && !grid[ny][nx]);
      if (!next.length) { stack.pop(); continue; }
      const [nx, ny, mx, my] = next[(Math.random() * next.length) | 0];
      grid[my][mx] = 1; grid[ny][nx] = 1;
      order.push([mx, my], [nx, ny]);
      stack.push([nx, ny]);
    }
    return order;
  }

  function drawBase() {
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, 0, cols * block, rows * block);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x]) cell(x, y, C.open);
    cell(1, 1, C.path); cell(cols - 2, rows - 2, C.front);
  }

  function newMaze() {
    cancelAnimationFrame(anim);
    solved = false; busy = true;
    size();
    const order = generate();
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, 0, cols * block, rows * block);
    stat.textContent = 'DFS koridorları oyuyor…';
    if (reduce) { drawBase(); done(); return; }
    let i = 0;
    const perFrame = Math.max(8, Math.ceil(order.length / 70));
    const step = () => {
      for (let k = 0; k < perFrame && i < order.length; k++, i++) cell(order[i][0], order[i][1], C.open);
      if (i < order.length) anim = requestAnimationFrame(step);
      else { drawBase(); done(); }
    };
    anim = requestAnimationFrame(step);
    function done() { busy = false; stat.textContent = 'Labirent hazır. Çözmek için “BFS ile çöz”e basın.'; }
  }

  function solve() {
    if (busy) return;
    if (solved) drawBase();
    busy = true;
    const sx = 1, sy = 1, ex = cols - 2, ey = rows - 2;
    const prev = new Int32Array(cols * rows).fill(-1);
    const seen = new Uint8Array(cols * rows);
    let frontier = [[sx, sy]]; seen[sy * cols + sx] = 1;
    const layers = [];
    let found = false;
    while (frontier.length && !found) {
      layers.push(frontier);
      const next = [];
      for (const [x, y] of frontier) {
        if (x === ex && y === ey) { found = true; break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, id = ny * cols + nx;
          if (grid[ny][nx] && !seen[id]) { seen[id] = 1; prev[id] = y * cols + x; next.push([nx, ny]); }
        }
      }
      frontier = next;
    }
    const path = [];
    for (let id = ey * cols + ex; id !== -1; id = prev[id]) path.push([id % cols, (id / cols) | 0]);
    path.reverse();
    const visited = layers.reduce((n, l) => n + l.length, 0);
    const corridors = grid.reduce((n, r) => n + r.reduce((a, b) => a + b, 0), 0);

    const finish = () => {
      busy = false; solved = true;
      stat.innerHTML = `BFS <strong>${visited}</strong> hücreyi (koridorların %${Math.round(visited / corridors * 100)}’i) gezdi; en kısa yol <strong>${path.length - 1}</strong> adım.`;
    };
    if (reduce) {
      layers.flat().forEach(([x, y]) => cell(x, y, C.seen));
      path.forEach(([x, y]) => cell(x, y, C.path));
      finish(); return;
    }
    stat.textContent = 'BFS girişten dalga dalga yayılıyor…';
    let li = 0, pi = 0;
    const perFrame = Math.max(1, Math.ceil(layers.length / 90));
    const step = () => {
      if (li < layers.length) {
        if (li > 0) layers[li - 1].forEach(([x, y]) => cell(x, y, C.seen));
        for (let k = 0; k < perFrame && li < layers.length; k++, li++) {
          layers[li].forEach(([x, y]) => cell(x, y, C.front));
          if (k < perFrame - 1) layers[li].forEach(([x, y]) => cell(x, y, C.seen));
        }
        anim = requestAnimationFrame(step);
      } else if (pi < path.length) {
        if (pi === 0) layers[layers.length - 1].forEach(([x, y]) => cell(x, y, C.seen));
        const n = Math.max(2, Math.ceil(path.length / 45));
        for (let k = 0; k < n && pi < path.length; k++, pi++) cell(path[pi][0], path[pi][1], C.path);
        anim = requestAnimationFrame(step);
      } else finish();
    };
    anim = requestAnimationFrame(step);
  }

  btnSolve.addEventListener('click', solve);
  btnNew.addEventListener('click', newMaze);
  canvas.addEventListener('click', () => (solved ? newMaze() : solve()));

  // İlk görünüşte üretimi oynat
  let started = false;
  const go = () => { if (!started) { started = true; newMaze(); } };
  if ('IntersectionObserver' in window) {
    const mo = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { go(); mo.disconnect(); } }, { threshold: 0.25 });
    mo.observe(canvas);
  } else go();

  let lastW = canvas.parentElement.clientWidth;
  window.addEventListener('resize', () => {
    const w = canvas.parentElement.clientWidth;
    if (started && Math.abs(w - lastW) > 40) { lastW = w; newMaze(); }
  });
})();
