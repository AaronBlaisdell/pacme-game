diff --git a/pacme/script.js b/pacme/script.js
new file mode 100644
index 0000000000000000000000000000000000000000..533312ad009becc1121d715d175a5b8870fd98be
--- /dev/null
+++ b/pacme/script.js
@@ -0,0 +1,475 @@
+const CELL = 28;
+const HUD_OFFSET = 60;
+const BOARD = [
+  '####################',
+  '#........##........#',
+  '#.####.#.##.#.####.#',
+  '#o####.#.##.#.####o#',
+  '#..................#',
+  '#.####.######.####.#',
+  '#......##..##......#',
+  '######.##GG##.######',
+  '#........P.........#',
+  '#.####.######.####.#',
+  '#o..##........##..o#',
+  '##.#.##########.#.##',
+  '#..................#',
+  '####################'
+];
+
+const COLORS = ['#ff6b6b', '#7ae7ff', '#ff92f8', '#ffa94d'];
+const ROLES = ['Player (Pacme)', 'Ghost 1', 'Ghost 2', 'Ghost 3', 'Ghost 4'];
+
+const canvas = document.getElementById('game');
+const ctx = canvas.getContext('2d');
+const scoreEl = document.getElementById('score');
+const livesEl = document.getElementById('lives');
+const statusEl = document.getElementById('status');
+const uploaderList = document.getElementById('uploader-list');
+
+const cropModal = document.getElementById('crop-modal');
+const cropTitle = document.getElementById('crop-title');
+const cropCanvas = document.getElementById('crop-canvas');
+const cropCtx = cropCanvas.getContext('2d');
+const zoomRange = document.getElementById('zoom-range');
+const xRange = document.getElementById('x-range');
+const yRange = document.getElementById('y-range');
+const saveCropBtn = document.getElementById('save-crop');
+
+const startBtn = document.getElementById('start-game');
+const pauseBtn = document.getElementById('pause-game');
+
+canvas.width = BOARD[0].length * CELL;
+canvas.height = BOARD.length * CELL + HUD_OFFSET;
+
+const uploads = Array.from({ length: 5 }, () => ({
+  image: null,
+  avatar: null
+}));
+
+const defaultAvatar = (label, bg) => {
+  const c = document.createElement('canvas');
+  c.width = 128;
+  c.height = 128;
+  const cx = c.getContext('2d');
+  cx.fillStyle = bg;
+  cx.beginPath();
+  cx.arc(64, 64, 62, 0, Math.PI * 2);
+  cx.fill();
+  cx.fillStyle = 'white';
+  cx.font = 'bold 44px sans-serif';
+  cx.textAlign = 'center';
+  cx.textBaseline = 'middle';
+  cx.fillText(label, 64, 67);
+  return c;
+};
+
+uploads[0].avatar = defaultAvatar('ME', '#ffd93d');
+for (let i = 1; i < 5; i += 1) uploads[i].avatar = defaultAvatar(`G${i}`, COLORS[i - 1]);
+
+let state;
+let loopId;
+let paused = false;
+const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };
+
+function cloneBoard() {
+  return BOARD.map((row) => row.split(''));
+}
+
+function findChar(board, char) {
+  for (let y = 0; y < board.length; y += 1) {
+    for (let x = 0; x < board[y].length; x += 1) {
+      if (board[y][x] === char) return { x, y };
+    }
+  }
+  return { x: 1, y: 1 };
+}
+
+function ghostStarts(board) {
+  const starts = [];
+  board.forEach((row, y) => row.forEach((c, x) => c === 'G' && starts.push({ x, y })));
+  return starts;
+}
+
+function initGame() {
+  const board = cloneBoard();
+  const p = findChar(board, 'P');
+  const gStarts = ghostStarts(board);
+  board[p.y][p.x] = '.';
+  gStarts.forEach(({ x, y }) => {
+    board[y][x] = '.';
+  });
+
+  state = {
+    board,
+    score: 0,
+    lives: 3,
+    pac: { ...p, dir: 'right', next: 'right' },
+    ghosts: gStarts.map((g, idx) => ({ ...g, dir: idx % 2 ? 'left' : 'right', speedTick: 0, avatarIdx: idx + 1 }))
+  };
+
+  paused = false;
+  statusEl.textContent = 'Running';
+  statusEl.className = '';
+  scoreEl.textContent = '0';
+  livesEl.textContent = '3';
+}
+
+function tileAt(x, y) {
+  if (y < 0 || y >= state.board.length || x < 0 || x >= state.board[0].length) return '#';
+  return state.board[y][x];
+}
+
+function isOpen(x, y) {
+  return tileAt(x, y) !== '#';
+}
+
+function dirDelta(dir) {
+  return {
+    up: [0, -1],
+    down: [0, 1],
+    left: [-1, 0],
+    right: [1, 0]
+  }[dir];
+}
+
+function selectedDirection() {
+  if (keys.ArrowUp || keys.w) return 'up';
+  if (keys.ArrowDown || keys.s) return 'down';
+  if (keys.ArrowLeft || keys.a) return 'left';
+  if (keys.ArrowRight || keys.d) return 'right';
+  return null;
+}
+
+function movePac() {
+  const desired = selectedDirection();
+  if (desired) state.pac.next = desired;
+
+  const tryMove = (dir) => {
+    const [dx, dy] = dirDelta(dir);
+    const nx = state.pac.x + dx;
+    const ny = state.pac.y + dy;
+    if (isOpen(nx, ny)) {
+      state.pac.x = nx;
+      state.pac.y = ny;
+      state.pac.dir = dir;
+      return true;
+    }
+    return false;
+  };
+
+  if (!tryMove(state.pac.next)) tryMove(state.pac.dir);
+
+  const tile = tileAt(state.pac.x, state.pac.y);
+  if (tile === '.') {
+    state.score += 10;
+    state.board[state.pac.y][state.pac.x] = ' ';
+  }
+  if (tile === 'o') {
+    state.score += 50;
+    state.board[state.pac.y][state.pac.x] = ' ';
+  }
+}
+
+function moveGhost(ghost) {
+  ghost.speedTick = (ghost.speedTick + 1) % 2;
+  if (ghost.speedTick !== 0) return;
+
+  const options = ['up', 'down', 'left', 'right'].filter((d) => {
+    const [dx, dy] = dirDelta(d);
+    return isOpen(ghost.x + dx, ghost.y + dy);
+  });
+
+  const [pdx, pdy] = [state.pac.x - ghost.x, state.pac.y - ghost.y];
+  if (Math.abs(pdx) + Math.abs(pdy) < 7 && Math.random() < 0.65) {
+    options.sort((a, b) => {
+      const [adx, ady] = dirDelta(a);
+      const [bdx, bdy] = dirDelta(b);
+      const ad = Math.abs(state.pac.x - (ghost.x + adx)) + Math.abs(state.pac.y - (ghost.y + ady));
+      const bd = Math.abs(state.pac.x - (ghost.x + bdx)) + Math.abs(state.pac.y - (ghost.y + bdy));
+      return ad - bd;
+    });
+    ghost.dir = options[0] ?? ghost.dir;
+  } else if (!options.includes(ghost.dir) || Math.random() < 0.35) {
+    ghost.dir = options[Math.floor(Math.random() * options.length)] ?? ghost.dir;
+  }
+
+  const [dx, dy] = dirDelta(ghost.dir);
+  if (isOpen(ghost.x + dx, ghost.y + dy)) {
+    ghost.x += dx;
+    ghost.y += dy;
+  }
+}
+
+function checkCollisions() {
+  const hit = state.ghosts.some((g) => g.x === state.pac.x && g.y === state.pac.y);
+  if (hit) {
+    state.lives -= 1;
+    if (state.lives <= 0) {
+      statusEl.textContent = 'Game Over';
+      statusEl.className = 'lose';
+      cancelAnimationFrame(loopId);
+      return;
+    }
+
+    const p = findChar(BOARD.map((r) => r.split('')), 'P');
+    const gStarts = ghostStarts(BOARD.map((r) => r.split('')));
+    state.pac.x = p.x;
+    state.pac.y = p.y;
+    state.ghosts.forEach((g, i) => {
+      g.x = gStarts[i].x;
+      g.y = gStarts[i].y;
+    });
+  }
+}
+
+function pelletsLeft() {
+  return state.board.some((row) => row.some((c) => c === '.' || c === 'o'));
+}
+
+function drawAvatar(avatarCanvas, x, y, radius) {
+  ctx.save();
+  ctx.beginPath();
+  ctx.arc(x, y, radius, 0, Math.PI * 2);
+  ctx.closePath();
+  ctx.clip();
+  ctx.drawImage(avatarCanvas, x - radius, y - radius, radius * 2, radius * 2);
+  ctx.restore();
+}
+
+function drawBoard() {
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+  ctx.fillStyle = '#090913';
+  ctx.fillRect(0, 0, canvas.width, canvas.height);
+
+  for (let y = 0; y < state.board.length; y += 1) {
+    for (let x = 0; x < state.board[y].length; x += 1) {
+      const tile = state.board[y][x];
+      const px = x * CELL;
+      const py = y * CELL + HUD_OFFSET;
+      if (tile === '#') {
+        ctx.fillStyle = '#1d3be2';
+        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
+      } else if (tile === '.') {
+        ctx.fillStyle = '#ffe9a8';
+        ctx.beginPath();
+        ctx.arc(px + CELL / 2, py + CELL / 2, 3, 0, Math.PI * 2);
+        ctx.fill();
+      } else if (tile === 'o') {
+        ctx.fillStyle = '#ffe9a8';
+        ctx.beginPath();
+        ctx.arc(px + CELL / 2, py + CELL / 2, 6, 0, Math.PI * 2);
+        ctx.fill();
+      }
+    }
+  }
+
+  const pX = state.pac.x * CELL + CELL / 2;
+  const pY = state.pac.y * CELL + CELL / 2 + HUD_OFFSET;
+  drawAvatar(uploads[0].avatar, pX, pY, CELL * 0.45);
+  state.ghosts.forEach((g, idx) => {
+    const gx = g.x * CELL + CELL / 2;
+    const gy = g.y * CELL + CELL / 2 + HUD_OFFSET;
+    drawAvatar(uploads[g.avatarIdx]?.avatar || uploads[idx + 1].avatar, gx, gy, CELL * 0.42);
+    ctx.strokeStyle = 'rgba(255,255,255,.8)';
+    ctx.lineWidth = 1;
+    ctx.beginPath();
+    ctx.arc(gx, gy, CELL * 0.42, 0, Math.PI * 2);
+    ctx.stroke();
+  });
+
+  ctx.fillStyle = '#c7c7e7';
+  ctx.font = 'bold 20px sans-serif';
+  ctx.fillText(`PACME  Score ${state.score}  Lives ${state.lives}`, 16, 36);
+}
+
+function tick() {
+  if (!paused) {
+    movePac();
+    state.ghosts.forEach(moveGhost);
+    checkCollisions();
+
+    if (state.lives > 0 && !pelletsLeft()) {
+      statusEl.textContent = 'You Win!';
+      statusEl.className = 'win';
+      cancelAnimationFrame(loopId);
+    }
+
+    scoreEl.textContent = state.score;
+    livesEl.textContent = state.lives;
+  }
+
+  drawBoard();
+  loopId = requestAnimationFrame(tick);
+}
+
+function buildUploaders() {
+  uploaderList.innerHTML = '';
+  ROLES.forEach((role, idx) => {
+    const wrap = document.createElement('div');
+    wrap.className = 'upload-item';
+    const img = document.createElement('img');
+    img.className = 'avatar-preview';
+    img.alt = `${role} avatar preview`;
+    img.src = uploads[idx].avatar.toDataURL();
+
+    const controls = document.createElement('div');
+    const label = document.createElement('label');
+    label.textContent = `${role}: Upload photo and crop face`;
+    const input = document.createElement('input');
+    input.type = 'file';
+    input.accept = 'image/*';
+
+    input.addEventListener('change', async (event) => {
+      const [file] = event.target.files;
+      if (!file) return;
+      const dataUrl = await fileToDataURL(file);
+      const image = await loadImage(dataUrl);
+      openCropper(image, idx, role, img);
+      input.value = '';
+    });
+
+    controls.append(label, input);
+    wrap.append(img, controls);
+    uploaderList.append(wrap);
+  });
+}
+
+function fileToDataURL(file) {
+  return new Promise((resolve, reject) => {
+    const reader = new FileReader();
+    reader.onload = () => resolve(reader.result);
+    reader.onerror = reject;
+    reader.readAsDataURL(file);
+  });
+}
+
+function loadImage(src) {
+  return new Promise((resolve, reject) => {
+    const img = new Image();
+    img.onload = () => resolve(img);
+    img.onerror = reject;
+    img.src = src;
+  });
+}
+
+let cropSession = null;
+
+function renderCropper() {
+  if (!cropSession) return;
+  const { image } = cropSession;
+  const zoom = Number(zoomRange.value);
+  const xT = Number(xRange.value);
+  const yT = Number(yRange.value);
+
+  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
+  cropCtx.fillStyle = '#111';
+  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
+
+  const base = Math.min(image.width, image.height);
+  const sampleSize = base / zoom;
+  const sx = (image.width - sampleSize) * xT;
+  const sy = (image.height - sampleSize) * yT;
+
+  cropCtx.drawImage(image, sx, sy, sampleSize, sampleSize, 0, 0, cropCanvas.width, cropCanvas.height);
+
+  const r = cropCanvas.width * 0.46;
+  cropCtx.save();
+  cropCtx.fillStyle = 'rgba(0,0,0,0.45)';
+  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
+  cropCtx.globalCompositeOperation = 'destination-out';
+  cropCtx.beginPath();
+  cropCtx.arc(cropCanvas.width / 2, cropCanvas.height / 2, r, 0, Math.PI * 2);
+  cropCtx.fill();
+  cropCtx.restore();
+
+  cropCtx.strokeStyle = '#ffde59';
+  cropCtx.lineWidth = 3;
+  cropCtx.beginPath();
+  cropCtx.arc(cropCanvas.width / 2, cropCanvas.height / 2, r, 0, Math.PI * 2);
+  cropCtx.stroke();
+
+  cropSession.sx = sx;
+  cropSession.sy = sy;
+  cropSession.sampleSize = sampleSize;
+}
+
+function openCropper(image, idx, role, previewEl) {
+  cropSession = { image, idx, previewEl, sx: 0, sy: 0, sampleSize: Math.min(image.width, image.height) };
+  cropTitle.textContent = `Crop face for ${role}`;
+  zoomRange.value = '1.35';
+  xRange.value = '0.5';
+  yRange.value = '0.5';
+  renderCropper();
+  cropModal.showModal();
+}
+
+[zoomRange, xRange, yRange].forEach((input) => {
+  input.addEventListener('input', renderCropper);
+});
+
+saveCropBtn.addEventListener('click', (event) => {
+  event.preventDefault();
+  if (!cropSession) return;
+
+  const avatar = document.createElement('canvas');
+  avatar.width = 128;
+  avatar.height = 128;
+  const avCtx = avatar.getContext('2d');
+  avCtx.beginPath();
+  avCtx.arc(64, 64, 62, 0, Math.PI * 2);
+  avCtx.closePath();
+  avCtx.clip();
+  avCtx.drawImage(
+    cropSession.image,
+    cropSession.sx,
+    cropSession.sy,
+    cropSession.sampleSize,
+    cropSession.sampleSize,
+    0,
+    0,
+    128,
+    128
+  );
+
+  uploads[cropSession.idx].avatar = avatar;
+  cropSession.previewEl.src = avatar.toDataURL();
+  cropModal.close();
+  cropSession = null;
+});
+
+cropModal.addEventListener('close', () => {
+  cropSession = null;
+});
+
+window.addEventListener('keydown', (event) => {
+  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
+  if (key in keys) {
+    keys[key] = true;
+    event.preventDefault();
+  }
+});
+
+window.addEventListener('keyup', (event) => {
+  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
+  if (key in keys) {
+    keys[key] = false;
+    event.preventDefault();
+  }
+});
+
+startBtn.addEventListener('click', () => {
+  cancelAnimationFrame(loopId);
+  initGame();
+  tick();
+});
+
+pauseBtn.addEventListener('click', () => {
+  paused = !paused;
+  statusEl.textContent = paused ? 'Paused' : 'Running';
+  statusEl.className = '';
+});
+
+buildUploaders();
+initGame();
+tick();
