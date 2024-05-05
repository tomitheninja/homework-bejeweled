// @ts-check

const backgroundSound = new Audio('background.mp3');
backgroundSound.preload = 'auto';
backgroundSound.loop = true;
backgroundSound.volume = 0.1;
backgroundSound.load();

document.body.onmousedown = () => {
  backgroundSound.play();
};

const actionSound = new Audio('breaking.mp3');
actionSound.preload = 'auto';
actionSound.volume = 1;
actionSound.load();

const RED = 'red';
const GREEN = 'green';
const BLUE = 'blue';
const YELLOW = 'yellow';
const PURPLE = 'purple';

const COLORS = [RED, GREEN, BLUE, YELLOW, PURPLE];

class GameState {
  score = 0;
  time = 5;
  cells;
  grabbedCell = null;

  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    const self = this;
    this.cells = GameState.INITIAL_COLORS.map((color, idx) => ({
      x: idx % 8,
      y: Math.floor(idx / 8),
      color,
      div: document.createElement('div'),
    }));
    this.parent = parent;

    let grabbedCell = null;
    let neighborIdx = null;
    let startX, startY;

    /**
     * @param {number} y
     * @param {number} x
     * @param {'LEFT' | 'RIGHT' | 'UP' | 'DOWN'} direction
     * @returns {HTMLDivElement | null}
     */
    function getNeighbor(y, x, direction) {
      const idx = y * 8 + x;
      if (idx !== neighborIdx) {
        const prev = parent.children.item(neighborIdx);
        if (prev) prev.style.transform = '';
      }
      if (idx < 0) return null;
      if (idx > 63) return null;
      if (direction === 'LEFT' && x === 0) return null;
      if (direction === 'RIGHT' && x === 7) return null;
      if (direction === 'UP' && y === 0) return null;
      if (direction === 'DOWN' && y === 7) return null;
      if (direction === 'LEFT') neighborIdx = idx - 1;
      if (direction === 'RIGHT') neighborIdx = idx + 1;
      if (direction === 'UP') neighborIdx = idx - 8;
      if (direction === 'DOWN') neighborIdx = idx + 8;
      return parent.children.item(neighborIdx);
    }

    parent.onmousedown = function setGrabbedCell(e) {
      if (self.time === 0) return;
      /** @type {HTMLDivElement} **/
      const target = e.target;
      const rawY = target?.getAttribute('data-y') ?? null;
      const rawX = target?.getAttribute('data-x') ?? null;
      if (rawY == null || rawX == null || rawY === '' || rawX === '') {
        throw new Error('Unknown cell grabbed');
      }
      [...parent.children].forEach((d) => (d.style.border = ''));
      target.style.border = '2px solid cyan';
      grabbedCell = self.at(
        Number.parseInt(rawY, 10),
        Number.parseInt(rawX, 10)
      );
      if (!grabbedCell) throw new Error('Cell not found');
      startX = e.clientX;
      startY = e.clientY;
    };

    parent.onmousemove = function animate(e) {
      if (self.time === 0) return;
      if (!grabbedCell) return;

      const current = grabbedCell.div;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // reset animation
      current.style.transform = '';
      if (neighborIdx !== null) {
        const other = parent.children.item(neighborIdx);
        if (!other) throw new Error('Neighbor not found');
        other.style.transform = '';
      }

      /** @type {'LEFT' | 'RIGHT' | 'UP' | 'DOWN'} */
      let direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx < 0 ? 'LEFT' : 'RIGHT';
      } else {
        direction = dy < 0 ? 'UP' : 'DOWN';
      }
      const pixels = Math.min(56, Math.max(Math.abs(dx), Math.abs(dy)));

      const neighborDiv = getNeighbor(grabbedCell.y, grabbedCell.x, direction);

      if (neighborDiv === current) throw new Error('Neighbor is self');

      let currentTransform = '';
      let otherTransform = '';

      switch (direction) {
        case 'LEFT':
          currentTransform = `translate(${-pixels}px, 0px)`;
          otherTransform = `translate(${pixels}px, 0px)`;
          break;
        case 'RIGHT':
          currentTransform = `translate(${pixels}px, 0px)`;
          otherTransform = `translate(${-pixels}px, 0px)`;
          break;
        case 'UP':
          currentTransform = `translate(0px, ${-pixels}px)`;
          otherTransform = `translate(0px, ${pixels}px)`;
          break;
        case 'DOWN':
          currentTransform = `translate(0px, ${pixels}px)`;
          otherTransform = `translate(0px, ${-pixels}px)`;
          break;
        default:
          throw new Error('Unknown direction');
      }

      current.style.transform = currentTransform;
      if (neighborDiv && pixels > 5) {
        neighborDiv.style.transform = otherTransform;
      }
    };

    document.body.onmouseup = (e) => {
      if (self.time === 0) return;
      const current = grabbedCell;
      grabbedCell = null;
      for (const div of parent.children) {
        div.style.transform = '';
        div.style.border = '';
      }
      if (!current || !neighborIdx) return;
      const neigCell = this.cells.find(
        (c) => c.div === parent.children.item(neighborIdx)
      );
      if (!neigCell) throw new Error('Unreachable path');
      this.swap(current, neigCell);
      if (!this.tryDestroy()) {
        this.swap(current, neigCell);
        return;
      }
      switch (this.level) {
        case 1:
          this.time += 5;
          break;
        case 2:
          this.time += 3;
          break;
        case 3:
          this.time += 1;
          break;
        case 4:
          this.time += 0.5;
          break;
      }
      this.render(false);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const loopBody = async () => {
        await sleep(750);
        while (true) {
          if (self.time === 0) return;
          this.fillBack();
          this.render();
          await sleep(500);
          if (!this.tryDestroy()) return;
          this.time += 5;
        }
      };
      loopBody();
    };
  }

  tryDestroy() {
    if (this.time === 0) return;
    const groups = this.findGroups();
    if (groups.length === 0) return false;
    actionSound.play();
    this.score +=
      groups.length * groups.map((g) => 2 ** g.length).reduce((a, b) => a + b);
    const destroyed = new Set(groups.flat());
    this.cells = this.cells.filter((cell) => !destroyed.has(cell));
    return true;
  }

  fillBack() {
    // gravity
    let isDirty = true;
    while (isDirty) {
      isDirty = false;
      for (const cell of this.cells) {
        if (cell.y === 7) continue; // floor level
        if (!this.cells.some((t) => t.x === cell.x && t.y === cell.y + 1)) {
          isDirty = true;
          cell.y += 1;
        }
      }
    }

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (this.at(y, x) != null) continue;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.cells.push({
          y,
          x,
          color,
          div: document.createElement('div'),
        });
      }
    }
  }

  /**
   * @param {{x: number, y: number}} cellA
   * @param {{x: number, y: number}} cellB
   */
  swap(cellA, cellB) {
    [cellA.x, cellB.x] = [cellB.x, cellA.x];
    [cellA.y, cellB.y] = [cellB.y, cellA.y];
  }

  at(y, x) {
    return this.cells.find((cell) => cell.x === x && cell.y === y) ?? null;
  }

  render(updateRefs = true) {
    this.parent.innerHTML = '';
    this.cells.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const DEFAULT_CELL = { x, y, color: 'gray' };
        const cell =
          this.cells.find((c) => c.x === x && c.y === y) ?? DEFAULT_CELL;
        const div = document.createElement('div');
        div.classList.add(`bg-${cell.color}-500`, 'w-12', 'h-12');
        div.setAttribute('data-x', x.toString());
        div.setAttribute('data-y', y.toString());
        div.title = `y=${y}, x=${x}, ${y * 8 + x}`;
        this.parent.appendChild(div);
        if (updateRefs) cell.div = div;
      }
    }
    document.getElementById('score').innerText = this.score.toString();
    document.getElementById('level').innerText = this.level.toString();
  }

  get level() {
    if (this.score < 100) return 1;
    if (this.score < 250) return 2;
    if (this.score < 500) return 3;
    return 4;
  }

  findGroups() {
    const groups = [];
    // match horizontal
    for (let y = 0; y < 8; y++) {
      let group = [];
      for (let x = 0; x < 8; x++) {
        const self = this.at(y, x);
        if (!self) throw new Error(`Cell ${y} ${x} not found`);
        if (group.length === 0 || group[0].color === self.color) {
          group.push(self);
        } else {
          if (group.length >= 3) {
            groups.push(group);
          }
          group = [self];
        }
      }
      if (group.length >= 3) {
        groups.push(group);
      }
    }
    // match vertical
    for (let x = 0; x < 8; x++) {
      let group = [];
      for (let y = 0; y < 8; y++) {
        const self = this.at(y, x);
        if (!self) throw new Error(`Cell ${y} ${x} not found`);
        if (group.length === 0 || group[0].color === self.color) {
          group.push(self);
        } else {
          if (group.length >= 3) {
            groups.push(group);
          }
          group = [self];
        }
      }
      if (group.length >= 3) {
        groups.push(group);
      }
    }
    return groups;
  }

  static INITIAL_COLORS = [
    PURPLE,
    RED,
    BLUE,
    GREEN,
    GREEN,
    YELLOW,
    GREEN,
    GREEN,
    RED,
    BLUE,
    GREEN,
    YELLOW,
    RED,
    BLUE,
    RED,
    PURPLE,
    YELLOW,
    PURPLE,
    BLUE,
    RED,
    GREEN,
    GREEN,
    PURPLE,
    PURPLE,
    BLUE,
    PURPLE,
    BLUE,
    GREEN,
    RED,
    BLUE,
    GREEN,
    RED,
    PURPLE,
    RED,
    GREEN,
    BLUE,
    GREEN,
    RED,
    RED,
    PURPLE,
    BLUE,
    GREEN,
    PURPLE,
    PURPLE,
    GREEN,
    YELLOW,
    GREEN,
    YELLOW,
    RED,
    GREEN,
    YELLOW,
    PURPLE,
    RED,
    GREEN,
    YELLOW,
    BLUE,
    GREEN,
    YELLOW,
    BLUE,
    BLUE,
    RED,
    BLUE,
    YELLOW,
    YELLOW,
  ];
}

const grid = document.getElementById('game-grid');
if (!grid) throw new Error('Game grid not found');
const state = new GameState(grid);
state.render();
setInterval(() => {
  backgroundSound.volume = Math.min(1, 0.05 + state.score / 500);
  if (state.time === 0) return;
  const mins = Math.floor(state.time / 60);
  let secs = Math.floor(state.time % 60) + '';
  if (secs.length < 2) secs = '0' + secs;
  document.getElementById('time').innerText = `${mins}:${secs}`;
  if (state.score !== 0) state.time -= 0.1;
  if (state.time <= 0) {
    state.time = 0;
    const scores = JSON.parse(localStorage.getItem('scores') || '[]');
    scores.push({ date: new Date(), score: state.score });
    localStorage.setItem('scores', JSON.stringify(scores));
    // alert('Game over! You scored ' + state.score + ' points');
    console.log(localStorage.getItem('scores'));
    window.location.href = 'scoreboard.html';
  }
}, 100);
