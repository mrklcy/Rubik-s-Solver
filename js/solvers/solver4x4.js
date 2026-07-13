/**
 * 4x4 Rubik's Cube Solver — Reduction Method
 *
 * Phase 1: Solve centers using commutator algorithms
 * Phase 2: Pair edges using slice-flip-slice algorithms
 * Phase 3: Solve as 3x3 using Kociemba two-phase algorithm
 *
 * Works directly on CubeState objects for correctness.
 */

class Solver4x4 {
  constructor(cubeState) {
    this.cube = cubeState.clone();

    // Lazy static initialization of commutator move lists
    if (!Solver4x4._cachedMoveLists) {
      Solver4x4._cachedMoveLists = {};
      Solver4x4._cachedMoveLists['free'] = this._buildAllCenterMoves();
      Solver4x4._cachedMoveLists['preserveU'] = this._buildPreserveMoves([0]);
      Solver4x4._cachedMoveLists['preserveUD'] = this._buildPreserveMoves([0, 3]);
      Solver4x4._cachedMoveLists['preserveUDF'] = this._buildPreserveMoves([0, 3, 2]);
      Solver4x4._cachedMoveLists['preserveUDFR'] = this._buildPreserveMoves([0, 3, 2, 1]);

      // Pre-parse all cached move lists for BFS use
      Solver4x4._preParsedMoveLists = {};
      for (const key in Solver4x4._cachedMoveLists) {
        Solver4x4._preParsedMoveLists[key] = Solver4x4._cachedMoveLists[key].map(moveSeq => {
          const parts = moveSeq.split(' ');
          const parsedParts = parts.map(m => CubeState.parseMove(m));
          const firstMove = parts[0];
          const lastMove = parts[parts.length - 1];
          return {
            originalString: moveSeq,
            parsedParts,
            firstFace: this._getMoveFace(firstMove),
            lastFace: this._getMoveFace(lastMove)
          };
        });
      }
    }

    this._preParsedMoveLists = Solver4x4._preParsedMoveLists;
  }


  solve() {
    if (this.cube.isSolved()) return [];

    const allMoves = [];

    // Phase 1: Solve all centers
    const centerMoves = this._solveCenters();
    if (!centerMoves) return [];
    allMoves.push(...centerMoves);

    // Phase 2: Pair all edges
    const edgeMoves = this._pairEdges();
    if (!edgeMoves) return [];
    allMoves.push(...edgeMoves);

    // Phase 3: Solve as 3x3
    const finalMoves = this._solve3x3Phase();
    if (!finalMoves) return [];
    allMoves.push(...finalMoves);

    return allMoves;
  }

  // ==================== PHASE 1: CENTER SOLVING ====================

  _getCenterColor(face) {
    return [
      this.cube.get(face, 1, 1),
      this.cube.get(face, 1, 2),
      this.cube.get(face, 2, 1),
      this.cube.get(face, 2, 2)
    ];
  }

  _isFaceCenterSolved(face, targetColor) {
    const c = this._getCenterColor(face);
    return c.every(v => v === targetColor);
  }

  _countCenterColor(face, color) {
    return this._getCenterColor(face).filter(v => v === color).length;
  }

  _applyAndRecord(moves, allMoves) {
    const moveStr = Array.isArray(moves) ? moves.join(' ') : moves;
    this.cube.applyMoves(moveStr);
    const parsed = moveStr.trim().split(/\s+/);
    allMoves.push(...parsed);
  }

  _solveCenters() {
    const allMoves = [];

    // Solve in order: U(0), D(3), F(2), R(1), L(4)
    // B(5) is automatically solved when the other 5 are done
    if (!this._solveFaceCenters(0, 0, allMoves, 'free')) return null;
    if (!this._solveFaceCenters(3, 3, allMoves, 'preserveU')) return null;
    if (!this._solveFaceCenters(2, 2, allMoves, 'preserveUD')) return null;
    if (!this._solveFaceCenters(1, 1, allMoves, 'preserveUDF')) return null;
    if (!this._solveFaceCenters(4, 4, allMoves, 'preserveUDFR')) return null;

    return allMoves;
  }

  _solveFaceCenters(face, color, allMoves, constraint) {
    const maxIter = 200;
    for (let iter = 0; iter < maxIter; iter++) {
      if (this._isFaceCenterSolved(face, color)) return true;
      const placed = this._placeOneCenter(face, color, allMoves, constraint);
      if (!placed) return false;
    }
    return this._isFaceCenterSolved(face, color);
  }

  _placeOneCenter(face, color, allMoves, constraint) {
    const startCount = this._countCenterColor(face, color);

    // Use pre-parsed move lists from constructor cache
    let preParsedAllowedMoves = this._preParsedMoveLists[constraint] || this._preParsedMoveLists['free'];

    // For 'free' mode, filter to only target-face outer turns + all wide moves
    if (constraint === 'free') {
      const charMap = ['U', 'R', 'F', 'D', 'L', 'B'];
      const targetFaceChar = charMap[face];
      preParsedAllowedMoves = preParsedAllowedMoves.filter(pp => {
        const parts = pp.originalString.split(' ');
        if (parts.length === 1) {
          const m = parts[0];
          if (!m.includes('w')) {
            const fChar = m[0];
            if (fChar !== targetFaceChar) return false;
          }
        }
        return true;
      });
    }

    // Center-only fingerprint using BigInt for speed
    const getFingerprint = (cube) => {
      let fp = 0n;
      for (let f = 0; f < 6; f++) {
        const faceData = cube.faces[f];
        fp = (fp << 12n) | BigInt(faceData[5] | (faceData[6] << 3) | (faceData[9] << 6) | (faceData[10] << 9));
      }
      return fp;
    };

    // Fast clone without constructor overhead
    const fastClone = (srcCube) => {
      const clone = Object.create(CubeState.prototype);
      clone.n = 4;
      clone.faces = [
        srcCube.faces[0].slice(),
        srcCube.faces[1].slice(),
        srcCube.faces[2].slice(),
        srcCube.faces[3].slice(),
        srcCube.faces[4].slice(),
        srcCube.faces[5].slice()
      ];
      return clone;
    };

    // BFS with array-index (O(1) dequeue instead of O(n) shift)
    const queue = [{ cube: this.cube, moves: [], lastFace: '' }];
    let head = 0;
    const visited = new Set();
    visited.add(getFingerprint(this.cube));

    while (head < queue.length) {
      const { cube: curCube, moves, lastFace } = queue[head++];

      // Check if this state improves center count while preserving constraints
      if (moves.length > 0) {
        const newCount = this._countCenterColorOnCube(curCube, face, color);
        if (newCount > startCount && this._constraintSatisfied(curCube, constraint)) {
          this._applyAndRecord(moves, allMoves);
          return true;
        }
      }

      // Limit BFS depth to 4
      if (moves.length >= 4) continue;

      for (const preParsed of preParsedAllowedMoves) {
        // Don't turn the same face group consecutively
        if (preParsed.firstFace === lastFace) continue;

        const nextCube = fastClone(curCube);
        for (const parsedMove of preParsed.parsedParts) {
          const { face: f, layer: l, wide: w, sliceOnly: s, count: c } = parsedMove;
          for (let t = 0; t < c; t++) {
            if (s) {
              nextCube._applyCWOnce(f, l);
            } else {
              const endL = w ? l : 0;
              for (let d = 0; d <= endL; d++) {
                nextCube._applyCWOnce(f, d);
              }
            }
          }
        }

        const fp = getFingerprint(nextCube);
        if (!visited.has(fp)) {
          visited.add(fp);
          queue.push({
            cube: nextCube,
            moves: [...moves, preParsed.originalString],
            lastFace: preParsed.lastFace
          });
        }
      }
    }

    return false;
  }

  _countCenterColorOnCube(cube, face, color) {
    let count = 0;
    const coords = [[1,1],[1,2],[2,1],[2,2]];
    for (const [r,c] of coords) {
      if (cube.get(face, r, c) === color) count++;
    }
    return count;
  }

  _constraintSatisfied(cube, constraint) {
    switch (constraint) {
      case 'free': return true;
      case 'preserveU':
        return this._isFaceCenterSolvedOnCube(cube, 0, 0);
      case 'preserveUD':
        return this._isFaceCenterSolvedOnCube(cube, 0, 0) &&
               this._isFaceCenterSolvedOnCube(cube, 3, 3);
      case 'preserveUDF':
        return this._isFaceCenterSolvedOnCube(cube, 0, 0) &&
               this._isFaceCenterSolvedOnCube(cube, 3, 3) &&
               this._isFaceCenterSolvedOnCube(cube, 2, 2);
      case 'preserveUDFR':
        return this._isFaceCenterSolvedOnCube(cube, 0, 0) &&
               this._isFaceCenterSolvedOnCube(cube, 3, 3) &&
               this._isFaceCenterSolvedOnCube(cube, 2, 2) &&
               this._isFaceCenterSolvedOnCube(cube, 1, 1);
      default: return true;
    }
  }

  _isFaceCenterSolvedOnCube(cube, face, color) {
    const coords = [[1,1],[1,2],[2,1],[2,2]];
    return coords.every(([r,c]) => cube.get(face, r, c) === color);
  }

  // ==================== MOVE LIST BUILDERS ====================

  _getMoveFace(moveStr) {
    const m = moveStr.match(/[URFDLB]/);
    return m ? m[0] : '';
  }

  _invertMoveStr(move) {
    if (move.endsWith("2")) return move;
    if (move.endsWith("'")) return move.slice(0, -1);
    return move + "'";
  }

  _buildAllCenterMoves() {
    return [
      "U", "U'", "U2", "D", "D'", "D2",
      "R", "R'", "R2", "L", "L'", "L2",
      "F", "F'", "F2", "B", "B'", "B2",
      "Rw", "Rw'", "Rw2", "Lw", "Lw'", "Lw2",
      "Fw", "Fw'", "Fw2", "Bw", "Bw'", "Bw2",
      "Uw", "Uw'", "Uw2", "Dw", "Dw'", "Dw2"
    ];
  }

  /**
   * Build a list of face turns + commutators that preserve all specified face centers.
   * @param {number[]} preserveFaces - Array of face indices whose centers must stay solved
   */
  _buildPreserveMoves(preserveFaces) {
    const moves = [
      "U", "U'", "U2", "D", "D'", "D2",
      "R", "R'", "R2", "L", "L'", "L2",
      "F", "F'", "F2", "B", "B'", "B2"
    ];
    const slices = [
      "Rw", "Rw'", "Rw2", "Lw", "Lw'", "Lw2",
      "Fw", "Fw'", "Fw2", "Bw", "Bw'", "Bw2",
      "Uw", "Uw'", "Uw2", "Dw", "Dw'", "Dw2"
    ];
    const turns = [
      "U", "U'", "U2", "D", "D'", "D2",
      "R", "R'", "R2", "L", "L'", "L2",
      "F", "F'", "F2", "B", "B'", "B2"
    ];

    for (const s of slices) {
      const sInv = this._invertMoveStr(s);
      for (const t of turns) {
        const testCube = new CubeState(4);
        testCube.applyMoves(s + " " + t + " " + sInv);
        const ok = preserveFaces.every(f => this._isFaceCenterSolvedOnCube(testCube, f, f));
        if (ok) {
          moves.push(s + " " + t + " " + sInv);
        }
      }
    }
    return moves;
  }

  // ==================== PHASE 2: EDGE PAIRING ====================

  _getEdgeDefs() {
    return [
      { name:"UF", s:[[0,3,1],[2,0,1]], t:[[0,3,2],[2,0,2]] },
      { name:"UL", s:[[0,1,0],[4,0,1]], t:[[0,2,0],[4,0,2]] },
      { name:"UB", s:[[0,0,1],[5,0,2]], t:[[0,0,2],[5,0,1]] },
      { name:"UR", s:[[0,1,3],[1,0,2]], t:[[0,2,3],[1,0,1]] },
      { name:"FL", s:[[2,1,0],[4,1,3]], t:[[2,2,0],[4,2,3]] },
      { name:"FR", s:[[2,1,3],[1,1,0]], t:[[2,2,3],[1,2,0]] },
      { name:"BL", s:[[5,1,3],[4,1,0]], t:[[5,2,3],[4,2,0]] },
      { name:"BR", s:[[5,1,0],[1,1,3]], t:[[5,2,0],[1,2,3]] },
      { name:"DF", s:[[3,0,1],[2,3,2]], t:[[3,0,2],[2,3,1]] },
      { name:"DL", s:[[3,1,0],[4,3,2]], t:[[3,2,0],[4,3,1]] },
      { name:"DB", s:[[3,3,1],[5,3,1]], t:[[3,3,2],[5,3,2]] },
      { name:"DR", s:[[3,1,3],[1,3,1]], t:[[3,2,3],[1,3,2]] }
    ];
  }

  _isEdgePaired(cube, edge) {
    const [f1,r1,c1] = edge.s[0];
    const [f2,r2,c2] = edge.s[1];
    const [f3,r3,c3] = edge.t[0];
    const [f4,r4,c4] = edge.t[1];
    return cube.get(f1,r1,c1) === cube.get(f3,r3,c3) &&
           cube.get(f2,r2,c2) === cube.get(f4,r4,c4);
  }

  _getPairedCount(cube) {
    return this._getEdgeDefs().filter(e => this._isEdgePaired(cube, e)).length;
  }

  _pairEdges() {
    const allMoves = [];
    const maxIter = 100;

    const edgePairAlgs = [
      // Standard edge pairing algorithms
      "Uw R U R' F R' F' R Uw'",
      "Uw' R U R' F R' F' R Uw",
      "Dw R U R' F R' F' R Dw'",
      "Dw' R U R' F R' F' R Dw",
      "Uw L' U' L F' L F L' Uw'",
      "Uw' L' U' L F' L F L' Uw",
      "Dw L' U' L F' L F L' Dw'",
      "Dw' L' U' L F' L F L' Dw",

      // Add L2E algorithms using double slice turns
      "Uw2 R U R' F R' F' R Uw2",
      "Dw2 R U R' F R' F' R Dw2",
      "Uw2 L' U' L F' L F L' Uw2",
      "Dw2 L' U' L F' L F L' Dw2",
    ];

    const setupMoves = [
      "U", "U'", "U2", "D", "D'", "D2",
      "R", "R'", "R2", "L", "L'", "L2",
      "F", "F'", "F2", "B", "B'", "B2"
    ];

    for (let iter = 0; iter < maxIter; iter++) {
      if (this._getPairedCount(this.cube) >= 12) return allMoves;

      const startCount = this._getPairedCount(this.cube);

      // Try each edge pairing algorithm directly
      let found = false;
      for (const alg of edgePairAlgs) {
        const testCube = this.cube.clone();
        testCube.applyMoves(alg);
        if (this._getPairedCount(testCube) > startCount) {
          this._applyAndRecord(alg, allMoves);
          found = true;
          break;
        }
      }
      if (found) continue;

      // Try setup move + algorithm
      for (const setup of setupMoves) {
        for (const alg of edgePairAlgs) {
          const testCube = this.cube.clone();
          testCube.applyMoves(setup + " " + alg);
          if (this._getPairedCount(testCube) > startCount) {
            this._applyAndRecord(setup + " " + alg, allMoves);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) continue;

      // Try setup + algorithm + undo setup (to minimize disruption)
      for (const setup of setupMoves) {
        const setupInv = this._invertMoveStr(setup);
        for (const alg of edgePairAlgs) {
          const testCube = this.cube.clone();
          testCube.applyMoves(setup + " " + alg + " " + setupInv);
          if (this._getPairedCount(testCube) > startCount) {
            this._applyAndRecord(setup + " " + alg + " " + setupInv, allMoves);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) continue;

      // Try 2-setup + algorithm
      for (const s1 of setupMoves) {
        for (const s2 of setupMoves) {
          for (const alg of edgePairAlgs) {
            const testCube = this.cube.clone();
            testCube.applyMoves(s1 + " " + s2 + " " + alg);
            if (this._getPairedCount(testCube) > startCount) {
              this._applyAndRecord(s1 + " " + s2 + " " + alg, allMoves);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) return null; // Couldn't pair any more edges
    }

    return this._getPairedCount(this.cube) >= 12 ? allMoves : null;
  }

  // ==================== PHASE 3: 3x3 REDUCTION ====================

  _getVirtual3x3StateOnCube(cube) {
    const mapping = [0, 1, 3, 4, 5, 7, 12, 13, 15];
    const charMap = ['U', 'R', 'F', 'D', 'L', 'B'];
    let str = "";
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 9; i++) {
        str += charMap[cube.faces[f][mapping[i]]];
      }
    }
    return str;
  }

  _solve3x3Phase() {
    if (typeof Cube === "undefined") return null;

    Cube.initSolver();

    const parityAlgs = [
      { name: "none", moves: "" },
      { name: "OLL", moves: "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2" },
      { name: "PLL", moves: "2R2 U2 2R2 Uw2 2R2 2U2" },
      { name: "OLL+PLL", moves: "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2 2R2 U2 2R2 Uw2 2R2 2U2" }
    ];

    for (const parity of parityAlgs) {
      const testCube = this.cube.clone();
      if (parity.moves) testCube.applyMoves(parity.moves);

      const str3x3 = this._getVirtual3x3StateOnCube(testCube);

      try {
        const kCube = Cube.fromString(str3x3);
        const solutionStr = kCube.solve();

        if (solutionStr && !solutionStr.includes("Error")) {
          // Verify the full 4x4 would be solved
          const verifyCube = testCube.clone();
          verifyCube.applyMoves(solutionStr.trim());

          if (verifyCube.isSolved()) {
            const allMoves = [];
            if (parity.moves) {
              this._applyAndRecord(parity.moves, allMoves);
            }
            this._applyAndRecord(solutionStr.trim(), allMoves);
            return allMoves;
          }
        }
      } catch (e) {
        // Try next parity combination
      }
    }

    return null;
  }
}
