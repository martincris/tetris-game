/*
 * script.js – core logic for a simple Tetris implementation.
 *
 * The game follows the classic rules: pieces fall from the top, the player can
 * move and rotate them, complete lines are cleared and score increases with
 * the number of lines removed. The coloured blocks utilise gradient shading to
 * approximate the 3D effect seen on Building Thingz’s website.
 */

const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');

// Grid dimensions
const COLS = 10;
const ROWS = 20;
const BLOCK = canvas.width / COLS; // each cell’s pixel size

// Board state (2D array storing colour strings or null for empty)
let board;

// Active piece and related state
let currentPiece;
let dropTimer = null;
let dropInterval = 1000; // initial piece drop speed in ms
let score = 0;
let linesCleared = 0;
let isGameOver = false;

// Colours for each Tetris piece (approximated from reference)
const PIECES = [
  {
    name: 'I',
    colour: '#00b4d8',
    rotations: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
    ],
  },
  {
    name: 'J',
    colour: '#457b9d',
    rotations: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
  },
  {
    name: 'L',
    colour: '#f4a261',
    rotations: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  {
    name: 'O',
    colour: '#e9c46a',
    rotations: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  {
    name: 'S',
    colour: '#2a9d8f',
    rotations: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    ],
  },
  {
    name: 'T',
    colour: '#a29bfe',
    rotations: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  {
    name: 'Z',
    colour: '#e63946',
    rotations: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
  },
];

/**
 * Convert a hex colour string to its RGB components.
 * @param {string} hex - colour string like '#aabbcc'
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

/**
 * Convert RGB values back into a hex string.
 * @param {number} r - red channel [0,255]
 * @param {number} g - green channel [0,255]
 * @param {number} b - blue channel [0,255]
 * @returns {string} hex colour
 */
function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Lighten a hex colour by a percentage (0.0–1.0). Mixing with white.
 * @param {string} color - base colour
 * @param {number} percent - fraction of white to mix in
 * @returns {string} lightened colour
 */
function lightenColor(color, percent) {
  const { r, g, b } = hexToRgb(color);
  const newR = Math.round(r + (255 - r) * percent);
  const newG = Math.round(g + (255 - g) * percent);
  const newB = Math.round(b + (255 - b) * percent);
  return rgbToHex(newR, newG, newB);
}

/**
 * Darken a hex colour by a percentage (0.0–1.0). Mixing with black.
 * @param {string} color - base colour
 * @param {number} percent - fraction of black to mix in
 * @returns {string} darkened colour
 */
function darkenColor(color, percent) {
  const { r, g, b } = hexToRgb(color);
  const newR = Math.round(r * (1 - percent));
  const newG = Math.round(g * (1 - percent));
  const newB = Math.round(b * (1 - percent));
  return rgbToHex(newR, newG, newB);
}

/**
 * Reset the board and scores to start a new game.
 */
function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  score = 0;
  linesCleared = 0;
  dropInterval = 1000;
  isGameOver = false;
  updateScoreDisplay();
  currentPiece = randomPiece();
  if (dropTimer) clearInterval(dropTimer);
  dropTimer = setInterval(drop, dropInterval);
  draw();
  hideOverlay();
}

/**
 * Generate a random piece at the starting position.
 * @returns {Object} new piece
 */
function randomPiece() {
  const index = Math.floor(Math.random() * PIECES.length);
  const def = PIECES[index];
  return {
    name: def.name,
    rotations: def.rotations,
    colour: def.colour,
    rotationIndex: 0,
    x: Math.floor((COLS - def.rotations[0][0].length) / 2),
    y: -1, // start above the visible board for smoother spawn
  };
}

/**
 * Check for collisions at a given offset and rotation. Returns true if there
 * would be a collision.
 * @param {number} offsetX - horizontal offset to test
 * @param {number} offsetY - vertical offset to test
 * @param {number} rotationIndex - rotation to test
 * @returns {boolean}
 */
function collides(offsetX, offsetY, rotationIndex) {
  const shape = currentPiece.rotations[rotationIndex];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const x = currentPiece.x + c + offsetX;
      const y = currentPiece.y + r + offsetY;
      if (x < 0 || x >= COLS || y >= ROWS) {
        // outside the board (left/right/bottom)
        return true;
      }
      if (y >= 0 && board[y][x]) {
        // collides with existing block
        return true;
      }
    }
  }
  return false;
}

/**
 * Lock the current piece into the board, then spawn a new piece.
 */
function placePiece() {
  const shape = currentPiece.rotations[currentPiece.rotationIndex];
  shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        const x = currentPiece.x + c;
        const y = currentPiece.y + r;
        if (y >= 0) {
          board[y][x] = currentPiece.colour;
        }
      }
    });
  });
  clearLines();
  currentPiece = randomPiece();
  // Game over if immediate collision
  if (collides(0, 0, currentPiece.rotationIndex)) {
    endGame();
  }
}

/**
 * Remove completed lines and update score/lines.
 */
function clearLines() {
  let linesThisTurn = 0;
  outer: for (let row = ROWS - 1; row >= 0; row--) {
    // Check if row is full (no null values)
    for (let col = 0; col < COLS; col++) {
      if (!board[row][col]) {
        continue outer;
      }
    }
    // Row is full; remove it
    board.splice(row, 1);
    board.unshift(Array(COLS).fill(null));
    linesThisTurn++;
    row++; // re-evaluate this row index
  }
  if (linesThisTurn > 0) {
    // Increase score based on number of lines cleared at once (Tetris scoring)
    const lineScores = [0, 40, 100, 300, 1200];
    score += lineScores[linesThisTurn];
    linesCleared += linesThisTurn;
    // Speed up slightly every 10 lines cleared
    if (linesCleared % 10 === 0 && dropInterval > 200) {
      dropInterval -= 100;
      clearInterval(dropTimer);
      dropTimer = setInterval(drop, dropInterval);
    }
    updateScoreDisplay();
  }
}

/**
 * Main drop function – moves the piece down each interval, or locks it if
 * blocked.
 */
function drop() {
  if (isGameOver) return;
  if (!collides(0, 1, currentPiece.rotationIndex)) {
    currentPiece.y++;
  } else {
    placePiece();
  }
  draw();
}

/**
 * Draw the entire game: background, board and current piece.
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw fixed blocks
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const colour = board[r][c];
      if (colour) {
        drawCell(c, r, colour);
      }
    }
  }
  // Draw current piece
  const shape = currentPiece.rotations[currentPiece.rotationIndex];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const x = currentPiece.x + c;
        const y = currentPiece.y + r;
        if (y >= 0) {
          drawCell(x, y, currentPiece.colour);
        }
      }
    }
  }
}

/**
 * Draw a single cell with a gradient to emulate 3D shading.
 * @param {number} col - column index
 * @param {number} row - row index
 * @param {string} colour - base colour hex string
 */
function drawCell(col, row, colour) {
  const x = col * BLOCK;
  const y = row * BLOCK;
  const light = lightenColor(colour, 0.25);
  const dark = darkenColor(colour, 0.25);
  const gradient = ctx.createLinearGradient(x, y, x + BLOCK, y + BLOCK);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.4, colour);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, BLOCK, BLOCK);
  // subtle border to separate blocks
  ctx.strokeStyle = darkenColor(colour, 0.4);
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, BLOCK, BLOCK);
}

/**
 * Update the displayed score and line counts.
 */
function updateScoreDisplay() {
  document.getElementById('score').textContent = score;
  document.getElementById('lines').textContent = linesCleared;
}

/**
 * Display the game over overlay.
 */
function endGame() {
  isGameOver = true;
  clearInterval(dropTimer);
  const overlay = document.getElementById('game-over');
  overlay.classList.add('show');
  overlay.innerHTML = 'Game Over<br/>Score: ' + score + '<br/>Lines: ' + linesCleared + '<br/><span style="font-family:\'Patrick Hand\', cursive; font-size:1rem;">Click Start to play again</span>';
}

/**
 * Hide the game over overlay.
 */
function hideOverlay() {
  const overlay = document.getElementById('game-over');
  overlay.classList.remove('show');
}

/**
 * Attempt to rotate the piece. If the rotation collides, do nothing.
 */
function rotate() {
  const nextRotation = (currentPiece.rotationIndex + 1) % currentPiece.rotations.length;
  // Kick behaviour: try to shift left/right when rotating near walls
  const kicks = [0, -1, 1, -2, 2];
  for (const offset of kicks) {
    if (!collides(offset, 0, nextRotation)) {
      currentPiece.x += offset;
      currentPiece.rotationIndex = nextRotation;
      return;
    }
  }
}

/**
 * Attempt to move the piece horizontally. Negative for left, positive for right.
 * @param {number} dir - direction (-1 or 1)
 */
function move(dir) {
  if (!collides(dir, 0, currentPiece.rotationIndex)) {
    currentPiece.x += dir;
  }
}

/**
 * Soft drop the piece (move down by one). If collides then place the piece.
 */
function softDrop() {
  if (!collides(0, 1, currentPiece.rotationIndex)) {
    currentPiece.y++;
  } else {
    placePiece();
  }
  draw();
}

/**
 * Hard drop – instantly drop the piece to the bottom.
 */
function hardDrop() {
  let dy = 0;
  while (!collides(0, dy + 1, currentPiece.rotationIndex)) {
    dy++;
  }
  currentPiece.y += dy;
  placePiece();
  draw();
}

/**
 * Keyboard controls for the game.
 */
document.addEventListener('keydown', (e) => {
  if (isGameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      move(-1);
      break;
    case 'ArrowRight':
    case 'KeyD':
      move(1);
      break;
    case 'ArrowUp':
    case 'KeyW':
      rotate();
      break;
    case 'ArrowDown':
    case 'KeyS':
      softDrop();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  draw();
});

/**
 * Initialise event listeners for the start button.
 */
document.getElementById('start-btn').addEventListener('click', () => {
  resetGame();
});

// Prepare overlay for game over messages
const overlayElement = document.createElement('div');
overlayElement.id = 'game-over';
overlayElement.className = 'overlay';
document.body.appendChild(overlayElement);

// Initialise the game board upon load
resetGame();