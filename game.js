'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const skinSwitch = document.getElementById('skin-switch');
const pauseMenu = document.getElementById('pause-menu');

const THEME_KEY = 'tetris-theme';
const GRID_COLORS = { dark: '#22222e', light: '#c7cadb' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme, startLevel, comboCount;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  trackCombo(cleared);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].gridColor || GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (SKINS[currentSkin].boardBg) {
    ctx.fillStyle = SKINS[currentSkin].boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (SKINS[currentSkin].boardBg) {
    nextCtx.fillStyle = SKINS[currentSkin].boardBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  handleGameOverHighscores();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMainView();
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) {
    draw();
    return;
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = getStartLevel();
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  comboCount = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  nameEntryEl.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.target && e.target.tagName === 'SELECT') return;
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(t) {
  theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeSwitch.checked = theme === 'light';
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
}

themeSwitch.addEventListener('change', () => {
  const t = themeSwitch.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
});

initTheme();

/* ==================== Skins visuales ==================== */

const SKIN_KEY = 'tetris-skin';

const PASTEL_COLORS = [
  null,
  '#a8e6ef', // I
  '#fff1b8', // O
  '#e3bfe8', // T
  '#c3ecc5', // S
  '#f4bcbc', // Z
  '#c6dcf7', // J
  '#fcd9ae', // L
];

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.max(0, Math.round(r + (percent < 0 ? r : 255 - r) * percent)));
  g = Math.min(255, Math.max(0, Math.round(g + (percent < 0 ? g : 255 - g) * percent)));
  b = Math.min(255, Math.max(0, Math.round(b + (percent < 0 ? b : 255 - b) * percent)));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawRoundedRect(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  // fallback manual para navegadores sin roundRect
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    gridColor: null, // usa GRID_COLORS[theme]
    boardBg: null, // usa --board-bg del CSS
    drawBlock(context, x, y, colorIndex, size) {
      const color = COLORS[colorIndex];
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    gridColor: '#1a1a2e',
    boardBg: '#05050a',
    drawBlock(context, x, y, colorIndex, size) {
      const color = COLORS[colorIndex];
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 1;
      context.strokeRect(x * size + 2.5, y * size + 2.5, size - 5, size - 5);
    },
  },
  pastel: {
    gridColor: '#e6e0f0',
    boardBg: '#fbf9ff',
    drawBlock(context, x, y, colorIndex, size) {
      const color = PASTEL_COLORS[colorIndex];
      const radius = Math.max(2, size * 0.18);
      drawRoundedRect(context, x * size + 2, y * size + 2, size - 4, size - 4, radius);
      context.fillStyle = color;
      context.fill();
    },
  },
  pixel: {
    gridColor: '#2a2a1e',
    boardBg: '#141410',
    drawBlock(context, x, y, colorIndex, size) {
      const color = COLORS[colorIndex];
      const light = shadeColor(color, 0.25);
      const dark = shadeColor(color, -0.25);
      const bx = x * size + 1;
      const by = y * size + 1;
      const bw = size - 2;
      const bh = size - 2;
      const half = bw / 2;
      const halfH = bh / 2;
      context.fillStyle = color;
      context.fillRect(bx, by, bw, bh);
      context.fillStyle = light;
      context.fillRect(bx, by, half, halfH);
      context.fillRect(bx + half, by + halfH, bw - half, bh - halfH);
      context.fillStyle = dark;
      context.fillRect(bx + half, by, bw - half, halfH);
      context.fillRect(bx, by + halfH, half, bh - halfH);
    },
  },
};

let currentSkin;

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  skinSwitch.value = currentSkin;
  if (typeof board !== 'undefined' && board) {
    draw();
    drawNext();
  }
}

function initSkin() {
  let saved = null;
  try {
    saved = localStorage.getItem(SKIN_KEY);
  } catch (e) {
    saved = null;
  }
  applySkin(saved || 'retro');
}

skinSwitch.addEventListener('change', () => {
  const skin = skinSwitch.value;
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch (e) {
    // localStorage no disponible; se ignora
  }
  applySkin(skin);
});

initSkin();

/* ---- Tabla de records local ---- */
const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const BEST_CLEAR_KEY = 'tetris-best-clear';
const MAX_HIGHSCORES = 5;

const highscoresListEl = document.getElementById('highscores-list');
const overlayHighscoresListEl = document.getElementById('overlay-highscores-list');
const nameEntryEl = document.getElementById('name-entry');
const nameInputEl = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const bestComboEl = document.getElementById('best-combo');
const bestClearEl = document.getElementById('best-clear');

let bestComboEver = 0;
let bestClearEver = 0;

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage no disponible (ej. modo privado)
  }
}

function loadStat(key) {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function saveStat(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    // ignorar, modo privado u otro fallo de localStorage
  }
}

function qualifiesForHighscore(s) {
  const list = loadHighscores();
  if (list.length < MAX_HIGHSCORES) return true;
  const minScore = Math.min(...list.map(entry => entry.score));
  return s > minScore;
}

function renderHighscoresList(targetEl, highlightEntry) {
  if (!targetEl) return;
  const list = loadHighscores();
  targetEl.textContent = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin records todavía';
    targetEl.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-entry';
    if (
      highlightEntry &&
      entry.name === highlightEntry.name &&
      entry.score === highlightEntry.score &&
      entry.date === highlightEntry.date
    ) {
      li.classList.add('highscore-new');
    }
    const rank = document.createElement('span');
    rank.className = 'highscore-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'highscore-name';
    name.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'highscore-score';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(scoreSpan);
    targetEl.appendChild(li);
  });
}

function renderAllHighscores(highlightEntry) {
  renderHighscoresList(highscoresListEl, highlightEntry);
  renderHighscoresList(overlayHighscoresListEl, highlightEntry);
}

function updateStatsHUD() {
  if (bestComboEl) bestComboEl.textContent = bestComboEver;
  if (bestClearEl) bestClearEl.textContent = bestClearEver;
}

function trackCombo(cleared) {
  if (cleared > 0) {
    comboCount++;
    if (cleared > bestClearEver) {
      bestClearEver = cleared;
      saveStat(BEST_CLEAR_KEY, bestClearEver);
    }
  } else {
    comboCount = 0;
  }
  if (comboCount > bestComboEver) {
    bestComboEver = comboCount;
    saveStat(BEST_COMBO_KEY, bestComboEver);
  }
  updateStatsHUD();
}

function handleGameOverHighscores() {
  if (qualifiesForHighscore(score)) {
    nameEntryEl.classList.remove('hidden');
    nameInputEl.value = '';
    renderAllHighscores(null);
    nameInputEl.focus();
  } else {
    nameEntryEl.classList.add('hidden');
    renderAllHighscores(null);
  }
}

function saveHighscore() {
  const raw = nameInputEl.value.trim().slice(0, 12);
  const name = raw || 'Jugador';
  const entry = {
    name,
    score,
    lines,
    level,
    date: new Date().toISOString(),
  };
  const list = loadHighscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighscores(list);
  nameEntryEl.classList.add('hidden');
  renderAllHighscores(list.includes(entry) ? entry : null);
}

function resetHighscores() {
  if (!confirm('¿Seguro que quieres borrar la tabla de records?')) return;
  saveHighscores([]);
  renderAllHighscores(null);
}

saveScoreBtn.addEventListener('click', saveHighscore);
nameInputEl.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveHighscore();
});
resetScoresBtn.addEventListener('click', resetHighscores);

bestComboEver = loadStat(BEST_COMBO_KEY);
bestClearEver = loadStat(BEST_CLEAR_KEY);
updateStatsHUD();
renderAllHighscores(null);
console.log('Hola mundo');
init();

/* ---- Menú de pausa completo ---- */
const START_LEVEL_KEY = 'tetris-start-level';
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');

function getStartLevel() {
  try {
    const stored = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
    if (Number.isInteger(stored) && stored >= MIN_START_LEVEL && stored <= MAX_START_LEVEL) {
      return stored;
    }
  } catch (err) {
    // localStorage no disponible: usar nivel por defecto
  }
  return 1;
}

function setStartLevel(value) {
  try {
    localStorage.setItem(START_LEVEL_KEY, String(value));
  } catch (err) {
    // localStorage no disponible: ignorar persistencia
  }
}

function populateStartLevelSelect() {
  for (let lvl = MIN_START_LEVEL; lvl <= MAX_START_LEVEL; lvl++) {
    const opt = document.createElement('option');
    opt.value = String(lvl);
    opt.textContent = String(lvl);
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = String(getStartLevel());
}

function showPauseMainView() {
  pauseMainView.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
}

function showPauseControlsView() {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
}

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', () => {
  paused = false;
  init();
});

showControlsBtn.addEventListener('click', showPauseControlsView);
backBtn.addEventListener('click', showPauseMainView);

startLevelSelect.addEventListener('change', () => {
  setStartLevel(parseInt(startLevelSelect.value, 10));
});

populateStartLevelSelect();
