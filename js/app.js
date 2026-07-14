/**
 * App Controller — Main application logic
 * 
 * Manages UI interactions, cube state, solver execution, and playback.
 */

class App {
  constructor() {
    this.cubeSize = 3;
    this.cubeState = new CubeState(3);
    this.cube3d = null;
    this.solutionMoves = [];
    this.currentMoveIndex = -1;
    this.isPlaying = false;
    this.playInterval = null;
    this.colorPickerActive = false;
    this.selectedColor = 0;

    this._init();
  }

  _init() {
    // Initialize 3D cube
    const container = document.getElementById('cube-canvas');
    this.cube3d = new Cube3D(container, this.cubeState);

    // Size selector
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => this._changeSize(parseInt(btn.dataset.size)));
    });

    // Control buttons
    document.getElementById('btn-scramble').addEventListener('click', () => this._scramble());
    document.getElementById('btn-solve').addEventListener('click', () => this._solve());
    document.getElementById('btn-reset').addEventListener('click', () => this._reset());
    document.getElementById('btn-picker').addEventListener('click', () => this._toggleColorPicker());

    // Playback controls
    document.getElementById('btn-prev').addEventListener('click', () => this._prevMove());
    document.getElementById('btn-next').addEventListener('click', () => this._nextMove());
    document.getElementById('btn-rewind').addEventListener('click', () => this._rewind());

    // Speed slider
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      this.cube3d.animationSpeed = speed;
      document.getElementById('speed-label').textContent = `${speed.toFixed(1)}x`;
    });

    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.selectedColor = parseInt(swatch.dataset.color);
        this.cube3d.selectedColor = this.selectedColor;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });

    this._updateStatus('Ready');
  }

  _changeSize(size) {
    this.cubeSize = size;
    this.cubeState = new CubeState(size);
    this.solutionMoves = [];
    this.currentMoveIndex = -1;
    this._clearSolution();

    // Update UI
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
    });

    // Rebuild 3D cube
    this.cube3d.rebuild(this.cubeState);
    this._updateStatus('Ready');
    this._showToast(`Switched to ${size}×${size} cube`);
  }

  _scramble() {
    this._stopPlay();
    this._clearSolution();

    const scramble = CubeState.generateScramble(this.cubeSize);
    const moves = scramble.split(/\s+/);

    this._updateStatus('Scrambling...', 'solving');

    // Apply scramble with animation
    this.cube3d.animationSpeed = 3; // fast scramble
    this.cube3d.animateMoves(moves, () => {
      this.cube3d.animationSpeed = parseFloat(document.getElementById('speed-slider').value);
      this._updateStatus('Scrambled — Ready to solve');
      this._showToast(`Scrambled with ${moves.length} moves`);
    });
  }

  _solve() {
    this._stopPlay();

    // Turn off paint mode if active when starting to solve
    if (this.colorPickerActive) {
      this._toggleColorPicker();
    }

    // Don't solve while animation (e.g. scramble) is still running
    if (this.cube3d.animating) {
      this._showToast('Wait for animation to finish', 'info');
      return;
    }

    if (this.cubeState.isSolved()) {
      this._showToast('Already solved!', 'success');
      return;
    }

    // Validate facelet color counts
    const counts = new Array(6).fill(0);
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < this.cubeSize * this.cubeSize; i++) {
        counts[this.cubeState.faces[f][i]]++;
      }
    }
    const expected = this.cubeSize * this.cubeSize;
    const colorNames = ['White', 'Red', 'Green', 'Yellow', 'Orange', 'Blue'];
    const invalidColors = [];
    for (let c = 0; c < 6; c++) {
      if (counts[c] !== expected) {
        invalidColors.push(`${colorNames[c]}: ${counts[c]}/${expected}`);
      }
    }
    if (invalidColors.length > 0) {
      const errStr = `Invalid color counts: ${invalidColors.join(', ')}`;
      this._showToast(errStr, 'error');
      this._updateStatus(errStr, 'error');
      return;
    }

    if (this.cubeSize >= 5) {
      this._showToast(`${this.cubeSize}x${this.cubeSize} solving is not supported offline, but you can scramble and paint it!`, 'info');
      this._updateStatus('Ready');
      return;
    }

    this._updateStatus('Solving...', 'solving');

    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      let solver;
      let moves;

      try {
        let result;
        switch (this.cubeSize) {
          case 2:
            solver = new Solver2x2(this.cubeState);
            result = solver.solve();
            break;
          case 3:
            solver = new Solver3x3(this.cubeState);
            result = solver.solve();
            break;
          case 4:
            solver = new Solver4x4(this.cubeState);
            result = solver.solve();
            break;
          default:
            this._showToast('Unsupported cube size', 'error');
            return;
        }

        if (result && result.error) {
          this._showToast(result.error, 'error');
          this._updateStatus(result.error, 'error');
          return;
        }

        let moves = result ? result.moves : null;
        if (moves) {
          moves = moves.filter(m => m && m.trim() !== "");
        }

        if (!moves || moves.length === 0) {
          this._showToast('Could not find solution', 'error');
          this._updateStatus('No solution found', 'error');
          return;
        }

        this.solutionMoves = moves;
        this.currentMoveIndex = -1;
        this._renderSolution();
        this._updateStatus(`Solution found: ${moves.length} moves`);
        this._updateMoveCount(moves.length);
        this._showToast(`Found solution in ${moves.length} moves!`, 'success');
      } catch (e) {
        console.error('Solver error:', e);
        this._showToast('Solver encountered an error', 'error');
        this._updateStatus('Error');
      }
    }, 50);
  }

  _reset() {
    this._stopPlay();
    this._clearSolution();
    this.cubeState = new CubeState(this.cubeSize);
    this.cube3d.rebuild(this.cubeState);
    this._updateStatus('Reset');
    this._showToast('Cube reset');
  }

  _toggleColorPicker() {
    this.colorPickerActive = !this.colorPickerActive;
    this.cube3d.colorPickerMode = this.colorPickerActive;

    const indicator = document.getElementById('picker-indicator');
    const btn = document.getElementById('btn-picker');

    if (this.colorPickerActive) {
      indicator.classList.add('active');
      btn.classList.add('btn-primary');
      this.cube3d.controls.enableRotate = false; // disable orbit while picking
    } else {
      indicator.classList.remove('active');
      btn.classList.remove('btn-primary');
      this.cube3d.controls.enableRotate = true;
    }
  }

  _stopPlay() {
    this.isPlaying = false;
  }

  _nextMove() {
    if (this.cube3d.animating) return;
    if (this.currentMoveIndex >= this.solutionMoves.length - 1) return;
    this._stopPlay();

    this.currentMoveIndex++;
    const move = this.solutionMoves[this.currentMoveIndex];
    this._updateSolutionHighlight();

    this.cube3d.animateMove(move, () => {
      if (this.currentMoveIndex >= this.solutionMoves.length - 1) {
        this._updateStatus('Solved!', 'solved');
      }
    });
  }

  _prevMove() {
    if (this.cube3d.animating) return;
    if (this.currentMoveIndex < 0) return;
    this._stopPlay();

    const move = this.solutionMoves[this.currentMoveIndex];
    const inverse = CubeState.invertMove(move);
    this.currentMoveIndex--;
    this._updateSolutionHighlight();

    this.cube3d.animateMove(inverse, () => { });
  }

  _rewind() {
    if (this.cube3d.animating) return;
    this._stopPlay();

    // Undo all applied moves
    while (this.currentMoveIndex >= 0) {
      const move = this.solutionMoves[this.currentMoveIndex];
      const inverse = CubeState.invertMove(move);
      this.cube3d.applyMoveInstant(inverse);
      this.currentMoveIndex--;
    }

    this._updateSolutionHighlight();
    this._updateStatus('Rewound to start');
  }

  _renderSolution() {
    const container = document.getElementById('solution-moves');
    container.innerHTML = '';

    this.solutionMoves.forEach((move, idx) => {
      const badge = document.createElement('span');
      badge.className = 'move-badge';
      badge.textContent = move;
      badge.dataset.index = idx;
      badge.addEventListener('click', () => this._jumpToMove(idx));
      container.appendChild(badge);
    });
  }

  _updateSolutionHighlight() {
    const badges = document.querySelectorAll('.move-badge');
    badges.forEach((badge, idx) => {
      badge.classList.remove('current', 'done');
      if (idx === this.currentMoveIndex) badge.classList.add('current');
      else if (idx < this.currentMoveIndex) badge.classList.add('done');
    });

    // Auto-scroll
    const current = document.querySelector('.move-badge.current');
    if (current) current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _jumpToMove(targetIdx) {
    if (this.cube3d.animating) return;
    this._stopPlay();

    // Rewind to start first
    while (this.currentMoveIndex >= 0) {
      const move = this.solutionMoves[this.currentMoveIndex];
      this.cube3d.applyMoveInstant(CubeState.invertMove(move));
      this.currentMoveIndex--;
    }

    // Apply moves up to target
    for (let i = 0; i <= targetIdx; i++) {
      this.cube3d.applyMoveInstant(this.solutionMoves[i]);
      this.currentMoveIndex = i;
    }

    this._updateSolutionHighlight();
  }

  _clearSolution() {
    this.solutionMoves = [];
    this.currentMoveIndex = -1;
    const container = document.getElementById('solution-moves');
    if (container) container.innerHTML = '<span class="status-text">No solution yet</span>';
    this._updateMoveCount(0);
  }

  _updateStatus(text, type = '') {
    const el = document.getElementById('status-text');
    if (el) {
      el.textContent = text;
      el.className = 'status-text' + (type ? ` ${type}` : '');
    }
  }

  _updateMoveCount(count) {
    const el = document.getElementById('move-count');
    if (el) el.textContent = count > 0 ? `${count} moves` : '';
  }

  _showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast' + (type ? ` ${type}` : '');

    // Trigger show
    requestAnimationFrame(() => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    });
  }
}

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
