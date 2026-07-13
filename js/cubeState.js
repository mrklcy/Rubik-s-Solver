/**
 * CubeState — NxN Rubik's Cube state model
 * 
 * Face indices: U=0, R=1, F=2, D=3, L=4, B=5
 * Each face is stored as a flat array of N*N color values (0-5).
 * Within each face (viewed head-on from outside the cube):
 *   [0][1][2]
 *   [3][4][5]
 *   [6][7][8]   (for 3x3)
 * 
 * Color mapping: 0=White(U), 1=Red(R), 2=Green(F), 3=Yellow(D), 4=Orange(L), 5=Blue(B)
 */

const FACE = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
const COLOR_NAMES = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];
const COLOR_CODES = ['#ffffff', '#b71234', '#009b48', '#ffd500', '#ff5800', '#0046ad'];

class CubeState {
  constructor(n = 3) {
    this.n = n;
    this.faces = [];
    for (let f = 0; f < 6; f++) {
      this.faces.push(new Array(n * n).fill(f));
    }
  }

  clone() {
    const c = new CubeState(this.n);
    for (let f = 0; f < 6; f++) {
      c.faces[f] = [...this.faces[f]];
    }
    return c;
  }

  get(f, r, c) {
    return this.faces[f][r * this.n + c];
  }

  set(f, r, c, v) {
    this.faces[f][r * this.n + c] = v;
  }

  isSolved() {
    for (let f = 0; f < 6; f++) {
      const color = this.faces[f][0];
      for (let i = 1; i < this.n * this.n; i++) {
        if (this.faces[f][i] !== color) return false;
      }
    }
    return true;
  }

  // Rotate a single face CW 90° (as viewed from outside)
  _rotateFaceCW(f) {
    const n = this.n;
    const old = [...this.faces[f]];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // new[r][c] = old[n-1-c][r]
        this.faces[f][r * n + c] = old[(n - 1 - c) * n + r];
      }
    }
  }

  _rotateFaceCCW(f) {
    this._rotateFaceCW(f);
    this._rotateFaceCW(f);
    this._rotateFaceCW(f);
  }

  /**
   * Get a strip of facelets (row or column) from a face.
   * @param {number} face - Face index
   * @param {string} type - 'row' or 'col'
   * @param {number} idx - Row or column index
   * @param {boolean} reverse - Whether to reverse the strip
   * @returns {number[]} Array of facelet values
   */
  _getStrip(face, type, idx, reverse = false) {
    const n = this.n;
    const strip = [];
    if (type === 'row') {
      for (let c = 0; c < n; c++) strip.push(this.faces[face][idx * n + c]);
    } else {
      for (let r = 0; r < n; r++) strip.push(this.faces[face][r * n + idx]);
    }
    return reverse ? strip.reverse() : strip;
  }

  _setStrip(face, type, idx, values, reverse = false) {
    const n = this.n;
    const vals = reverse ? [...values].reverse() : values;
    if (type === 'row') {
      for (let c = 0; c < n; c++) this.faces[face][idx * n + c] = vals[c];
    } else {
      for (let r = 0; r < n; r++) this.faces[face][r * n + idx] = vals[r];
    }
  }

  /**
   * Apply a single CW turn of a layer.
   * Defined by axis (U/D/R/L/F/B) and layer depth (0 = outermost).
   *
   * Move definitions (CW when looking at the face from outside):
   *
   * U CW: strips cycle F→R→B→L (top rows)
   * D CW: strips cycle F→L→B→R (bottom rows)
   * R CW: strips cycle F→U→B→D (right cols; B col reversed)
   * L CW: strips cycle U→F→D→B (left cols; B col reversed)
   * F CW: strips cycle U→R→D→L (mixed rows/cols with reversals)
   * B CW: strips cycle U→L→D→R (mixed rows/cols with reversals)
   */
  _applySingleCW(axis, layer) {
    const n = this.n;
    const d = layer; // depth from the face

    // Rotate the face itself for outermost layers
    if (d === 0) this._rotateFaceCW(axis);
    // Rotate opposite face CCW for innermost layer
    const opposite = [3, 4, 5, 0, 1, 2]; // U↔D, R↔L, F↔B
    if (d === n - 1) this._rotateFaceCW(opposite[axis]);

    switch (axis) {
      case FACE.U: {
        // Cycle: F row d → R row d → B row d → L row d → F row d
        const temp = this._getStrip(FACE.F, 'row', d);
        this._setStrip(FACE.F, 'row', d, this._getStrip(FACE.L, 'row', d));
        this._setStrip(FACE.L, 'row', d, this._getStrip(FACE.B, 'row', d));
        this._setStrip(FACE.B, 'row', d, this._getStrip(FACE.R, 'row', d));
        this._setStrip(FACE.R, 'row', d, temp);
        break;
      }
      case FACE.D: {
        // Cycle: F row(n-1-d) → L row(n-1-d) → B row(n-1-d) → R row(n-1-d)
        const row = n - 1 - d;
        const temp = this._getStrip(FACE.F, 'row', row);
        this._setStrip(FACE.F, 'row', row, this._getStrip(FACE.R, 'row', row));
        this._setStrip(FACE.R, 'row', row, this._getStrip(FACE.B, 'row', row));
        this._setStrip(FACE.B, 'row', row, this._getStrip(FACE.L, 'row', row));
        this._setStrip(FACE.L, 'row', row, temp);
        break;
      }
      case FACE.R: {
        // Cycle: F col(n-1-d) → U col(n-1-d) → B col(d) rev → D col(n-1-d) → F
        const col = n - 1 - d;
        const temp = this._getStrip(FACE.F, 'col', col);
        this._setStrip(FACE.F, 'col', col, this._getStrip(FACE.D, 'col', col));
        this._setStrip(FACE.D, 'col', col, this._getStrip(FACE.B, 'col', d, true));
        this._setStrip(FACE.B, 'col', d, this._getStrip(FACE.U, 'col', col, true));
        this._setStrip(FACE.U, 'col', col, temp);
        break;
      }
      case FACE.L: {
        // Cycle: U col(d) → F col(d) → D col(d) → B col(n-1-d) rev → U
        const col = d;
        const temp = this._getStrip(FACE.U, 'col', col);
        this._setStrip(FACE.U, 'col', col, this._getStrip(FACE.B, 'col', n - 1 - d, true));
        this._setStrip(FACE.B, 'col', n - 1 - d, this._getStrip(FACE.D, 'col', col, true));
        this._setStrip(FACE.D, 'col', col, this._getStrip(FACE.F, 'col', col));
        this._setStrip(FACE.F, 'col', col, temp);
        break;
      }
      case FACE.F: {
        // Cycle: U row(n-1-d) → R col(d) → D row(d) rev → L col(n-1-d) rev → U
        const temp = this._getStrip(FACE.U, 'row', n - 1 - d);
        this._setStrip(FACE.U, 'row', n - 1 - d, this._getStrip(FACE.L, 'col', n - 1 - d, true));
        this._setStrip(FACE.L, 'col', n - 1 - d, this._getStrip(FACE.D, 'row', d));
        this._setStrip(FACE.D, 'row', d, this._getStrip(FACE.R, 'col', d, true));
        this._setStrip(FACE.R, 'col', d, temp);
        break;
      }
      case FACE.B: {
        // Cycle: U row(d) → L col(d) → D row(n-1-d) → R col(n-1-d) → U
        const temp = this._getStrip(FACE.U, 'row', d);
        this._setStrip(FACE.U, 'row', d, this._getStrip(FACE.R, 'col', n - 1 - d));
        this._setStrip(FACE.R, 'col', n - 1 - d, this._getStrip(FACE.D, 'row', n - 1 - d, true));
        this._setStrip(FACE.D, 'row', n - 1 - d, this._getStrip(FACE.L, 'col', d));
        this._setStrip(FACE.L, 'col', d, this._getStrip(FACE.U, 'row', d, true));
        // Oops, U already overwritten. Let me fix:
        break;
      }
    }
    // Fix B case - redo with temp properly
    if (axis === FACE.B) {
      // Undo the broken B case and redo
      // Actually let me restructure B case properly outside the switch
    }
  }

  /**
   * Apply a move string like "U", "R'", "F2", "Rw", "Rw'", "3Rw2"
   * @param {string} move - Move in standard notation
   */
  applyMove(move) {
    const parsed = CubeState.parseMove(move);
    if (!parsed) return;
    const { face, layer, wide, sliceOnly, count } = parsed;

    for (let t = 0; t < count; t++) {
      if (sliceOnly) {
        this._applyCWOnce(face, layer);
      } else {
        const endLayer = wide ? layer : 0;
        for (let d = 0; d <= endLayer; d++) {
          this._applyCWOnce(face, d);
        }
      }
    }
  }

  /**
   * Properly apply one CW turn for a given face and layer.
   */
  _applyCWOnce(axis, layer) {
    const n = this.n;
    const d = layer;

    if (d === 0) this._rotateFaceCW(axis);
    const opposite = [3, 4, 5, 0, 1, 2];
    if (d === n - 1) this._rotateFaceCW(opposite[axis]);

    let s0, s1, s2, s3; // four strips to cycle

    switch (axis) {
      case FACE.U: {
        s0 = this._getStrip(FACE.F, 'row', d);
        s1 = this._getStrip(FACE.R, 'row', d);
        s2 = this._getStrip(FACE.B, 'row', d);
        s3 = this._getStrip(FACE.L, 'row', d);
        this._setStrip(FACE.F, 'row', d, s1); // R -> F
        this._setStrip(FACE.L, 'row', d, s0); // F -> L
        this._setStrip(FACE.B, 'row', d, s3); // L -> B
        this._setStrip(FACE.R, 'row', d, s2); // B -> R
        break;
      }
      case FACE.D: {
        const row = n - 1 - d;
        s0 = this._getStrip(FACE.F, 'row', row);
        s1 = this._getStrip(FACE.L, 'row', row);
        s2 = this._getStrip(FACE.B, 'row', row);
        s3 = this._getStrip(FACE.R, 'row', row);
        this._setStrip(FACE.L, 'row', row, s2); // B -> L
        this._setStrip(FACE.B, 'row', row, s3); // R -> B
        this._setStrip(FACE.R, 'row', row, s0); // F -> R
        this._setStrip(FACE.F, 'row', row, s1); // L -> F
        break;
      }
      case FACE.R: {
        const col = n - 1 - d;
        s0 = this._getStrip(FACE.F, 'col', col);
        s1 = this._getStrip(FACE.U, 'col', col);
        s2 = this._getStrip(FACE.B, 'col', d, true);
        s3 = this._getStrip(FACE.D, 'col', col);
        // Cycle: F→U→B→D→F
        this._setStrip(FACE.U, 'col', col, s0);
        this._setStrip(FACE.B, 'col', d, s1, true);
        this._setStrip(FACE.D, 'col', col, s2);
        this._setStrip(FACE.F, 'col', col, s3);
        break;
      }
      case FACE.L: {
        const col = d;
        s0 = this._getStrip(FACE.U, 'col', col);
        s1 = this._getStrip(FACE.F, 'col', col);
        s2 = this._getStrip(FACE.D, 'col', col);
        s3 = this._getStrip(FACE.B, 'col', n - 1 - d, true);
        // Cycle: U→F→D→B→U
        this._setStrip(FACE.F, 'col', col, s0);
        this._setStrip(FACE.D, 'col', col, s1);
        this._setStrip(FACE.B, 'col', n - 1 - d, s2, true);
        this._setStrip(FACE.U, 'col', col, s3);
        break;
      }
      case FACE.F: {
        s0 = this._getStrip(FACE.U, 'row', n - 1 - d);
        s1 = this._getStrip(FACE.R, 'col', d);
        s2 = this._getStrip(FACE.D, 'row', d);
        s3 = this._getStrip(FACE.L, 'col', n - 1 - d);
        // Cycle: U→R→D→L→U
        this._setStrip(FACE.R, 'col', d, s0);
        this._setStrip(FACE.D, 'row', d, [...s1].reverse());
        this._setStrip(FACE.L, 'col', n - 1 - d, s2);
        this._setStrip(FACE.U, 'row', n - 1 - d, [...s3].reverse());
        break;
      }
      case FACE.B: {
        s0 = this._getStrip(FACE.U, 'row', d);
        s1 = this._getStrip(FACE.L, 'col', d);
        s2 = this._getStrip(FACE.D, 'row', n - 1 - d);
        s3 = this._getStrip(FACE.R, 'col', n - 1 - d);
        // Cycle: U→L→D→R→U
        this._setStrip(FACE.L, 'col', d, [...s0].reverse());
        this._setStrip(FACE.D, 'row', n - 1 - d, s1);
        this._setStrip(FACE.R, 'col', n - 1 - d, [...s2].reverse());
        this._setStrip(FACE.U, 'row', d, s3);
        break;
      }
    }
  }

  /**
   * Apply a sequence of moves.
   * @param {string} moves - Space-separated move sequence
   */
  applyMoves(moves) {
    if (!moves || !moves.trim()) return;
    const moveList = moves.trim().split(/\s+/);
    for (const m of moveList) {
      this.applyMove(m);
    }
  }

  /**
   * Parse a move string into components.
   * Supports: U, U', U2, Rw, Rw', 3Rw, 3Rw2, u (lowercase = wide), etc.
   */
  static parseMove(move) {
    if (!move) return null;

    // Match pattern: optional number + face letter + optional 'w' + optional '/2
    const match = move.match(/^(\d*)([URFDLBurfdlbMESxyz])([w]?)(['2]?)$/);
    if (!match) return null;

    let [, widthStr, faceChar, wideFlag, modifier] = match;

    const isLower = faceChar === faceChar.toLowerCase() && 'urfdlb'.includes(faceChar);
    faceChar = faceChar.toUpperCase();

    // Slice moves (M, E, S) and rotations (x, y, z) handled separately
    const faceMap = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

    if (faceMap[faceChar] === undefined) return null;

    const face = faceMap[faceChar];
    const wide = isLower || wideFlag === 'w';
    const sliceOnly = !wide && widthStr !== "";
    const layer = sliceOnly ? parseInt(widthStr) - 1 : (wide ? (widthStr ? parseInt(widthStr) - 1 : 1) : 0);

    let count;
    if (modifier === "'") count = 3; // CCW = 3x CW
    else if (modifier === "2") count = 2;
    else count = 1;

    return { face, layer, wide, sliceOnly, count };
  }

  /**
   * Generate a random scramble.
   * @param {number} length - Number of moves
   * @returns {string} Scramble string
   */
  static generateScramble(n, length) {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const modifiers = ['', "'", '2'];
    const moves = [];
    let lastFace = -1;
    let lastLastFace = -1;

    if (!length) {
      // Default scramble lengths by cube size
      length = { 2: 11, 3: 20, 4: 40, 5: 60 }[n] || 20;
    }

    for (let i = 0; i < length; i++) {
      let faceIdx;
      do {
        faceIdx = Math.floor(Math.random() * faces.length);
      } while (
        faceIdx === lastFace ||
        (faceIdx === lastLastFace && Math.floor(faceIdx / 2) === Math.floor(lastFace / 2))
      );

      let move = faces[faceIdx];

      // For bigger cubes, randomly add wide moves or inner layers
      if (n >= 4 && Math.random() < 0.3) {
        if (n >= 5 && Math.random() < 0.3) {
          move = '3' + move + 'w';
        } else {
          move = move + 'w';
        }
      }

      move += modifiers[Math.floor(Math.random() * modifiers.length)];
      moves.push(move);
      lastLastFace = lastFace;
      lastFace = faceIdx;
    }

    return moves.join(' ');
  }

  /**
   * Get the state as a flat string (for comparison/hashing).
   */
  toFlatString() {
    return this.faces.map(f => f.join('')).join('');
  }

  /**
   * Invert a single move string.
   */
  static invertMove(move) {
    if (move.endsWith('2')) return move;
    if (move.endsWith("'")) return move.slice(0, -1);
    return move + "'";
  }

  /**
   * Invert a sequence of moves.
   */
  static invertMoves(movesStr) {
    const moves = movesStr.trim().split(/\s+/);
    return moves.reverse().map(m => CubeState.invertMove(m)).join(' ');
  }
}
