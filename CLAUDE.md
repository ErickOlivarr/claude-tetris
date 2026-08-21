# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris implemented in vanilla JavaScript (HTML5 Canvas + CSS). No dependencies, no build step, no `package.json`.

## Running

Open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no test suite, linter, or build/bundle step — verify changes by loading the page and playing.

## Architecture

Three files, all logic lives in `game.js` (~300 lines, single global scope, no modules):

- `index.html` — DOM shell: `#board` canvas (300×600, the main grid) and `#next-canvas` (120×120, next-piece preview), plus score/lines/level panel and the pause/game-over overlay.
- `style.css` — dark/retro arcade styling for the panel and overlay.
- `game.js` — game state and loop, all top-level functions operating on shared module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.):
  - `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece-color index `1–7`.
  - Pieces (`PIECES`) are square matrices; rotation is done via matrix transpose+reverse (`rotateCW`), not lookup tables.
  - `tryRotate()` implements basic wall kicks: after rotating, tries offsets `[0, -1, 1, -2, 2]` until one doesn't collide.
  - `collide(shape, ox, oy)` is the single collision check used by movement, rotation, and ghost-piece projection.
  - `loop(ts)` is the `requestAnimationFrame` game loop: accumulates elapsed time and advances the piece down once `dropAccum >= dropInterval`.
  - `clearLines()` removes completed rows bottom-up, recomputes score (`LINE_SCORES` table × `level`) and `level`/`dropInterval` (level increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`).
  - Ghost piece (`ghostY()`) projects the current piece straight down and is drawn at `globalAlpha = 0.2`.
  - `spawn()` promotes `next` to `current` and generates a new `next`; if the new `current` immediately collides, `endGame()` fires.

When changing `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
