/**
 * 2x2 Rubik's Cube Solver — Optimal Bidirectional BFS
 *
 * Solves any 2x2 Rubik's Cube scramble optimally (in <= 11 moves HTM)
 * in less than 20ms using a bidirectional breadth-first search.
 */

class Solver2x2 {
  constructor(cubeState) {
    this.cube = cubeState.clone();
  }

  solve() {
    this.targetColors = this._detectTargetColors();
    if (!this.targetColors) {
      return { error: "Invalid corner layout: Check if opposite colors are adjacent or corner pieces are duplicate." };
    }

    // Create target solved state based on targetColors
    const solvedState = new CubeState(2);
    for (let f = 0; f < 6; f++) {
      solvedState.faces[f].fill(this.targetColors[f]);
    }

    if (this.cube.toFlatString() === solvedState.toFlatString()) return { moves: [] };

    // 1. Find the orientation where DBL corner is solved.
    // This allows us to search using only U, R, F moves (fixing the DBL corner).
    const orientedResult = this._getOrientedState(this.cube);
    if (!orientedResult) {
      return { error: "Could not orient cube. Make sure opposite colors are not adjacent." };
    }

    const { cube: startState, map } = orientedResult;
    if (startState.toFlatString() === solvedState.toFlatString()) return { moves: [] };

    // 2. Run bidirectional BFS using U, R, F moves
    const allowedMoves = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
    const forwardQueue = [startState];
    const forwardVisited = new Map();
    forwardVisited.set(startState.toFlatString(), []);

    const backwardQueue = [solvedState];
    const backwardVisited = new Map();
    backwardVisited.set(solvedState.toFlatString(), []);

    let foundSolution = null;

    while (forwardQueue.length > 0 && backwardQueue.length > 0) {
      if (forwardQueue.length <= backwardQueue.length) {
        // Expand forward
        const levelSize = forwardQueue.length;
        for (let i = 0; i < levelSize; i++) {
          const curr = forwardQueue.shift();
          const currStr = curr.toFlatString();
          const movesToCurr = forwardVisited.get(currStr);

          for (const m of allowedMoves) {
            const nextState = curr.clone();
            nextState.applyMove(m);
            const nextStr = nextState.toFlatString();

            if (backwardVisited.has(nextStr)) {
              const forwardPath = [...movesToCurr, m];
              const backwardPath = backwardVisited.get(nextStr);
              foundSolution = { forwardPath, backwardPath };
              break;
            }

            if (!forwardVisited.has(nextStr)) {
              forwardVisited.set(nextStr, [...movesToCurr, m]);
              forwardQueue.push(nextState);
            }
          }
          if (foundSolution) break;
        }
      } else {
        // Expand backward
        const levelSize = backwardQueue.length;
        for (let i = 0; i < levelSize; i++) {
          const curr = backwardQueue.shift();
          const currStr = curr.toFlatString();
          const movesToCurr = backwardVisited.get(currStr);

          for (const m of allowedMoves) {
            const nextState = curr.clone();
            nextState.applyMove(m);
            const nextStr = nextState.toFlatString();

            if (forwardVisited.has(nextStr)) {
              const forwardPath = forwardVisited.get(nextStr);
              const backwardPath = [...movesToCurr, m];
              foundSolution = { forwardPath, backwardPath };
              break;
            }

            if (!backwardVisited.has(nextStr)) {
              backwardVisited.set(nextStr, [...movesToCurr, m]);
              backwardQueue.push(nextState);
            }
          }
          if (foundSolution) break;
        }
      }
      if (foundSolution) break;
    }

    if (!foundSolution) {
      return { error: "No solution found. Check for paint errors." };
    }

    // 3. Construct oriented solution
    const { forwardPath, backwardPath } = foundSolution;
    const invertedBackward = [...backwardPath].reverse().map(m => CubeState.invertMove(m));
    const orientedSolution = [...forwardPath, ...invertedBackward];

    // 4. Translate moves back to original cube faces
    const faceNames = ['U', 'R', 'F', 'D', 'L', 'B'];
    const translatedSolution = orientedSolution.map(move => {
      const parsed = CubeState.parseMove(move);
      // Map oriented face back to original face index
      const originalFaceIdx = map[parsed.face];
      const originalFaceName = faceNames[originalFaceIdx];
      
      let modifier = "";
      if (move.endsWith("'")) modifier = "'";
      else if (move.endsWith("2")) modifier = "2";
      
      return originalFaceName + modifier;
    });

    return { moves: translatedSolution };
  }

  _getOrientedState(scrambledCube) {
    const queue = [{ cube: scrambledCube.clone(), map: [0, 1, 2, 3, 4, 5] }];
    const visited = new Set();
    visited.add([0, 1, 2, 3, 4, 5].join(','));
    
    const rx = m => [m[2], m[1], m[3], m[5], m[4], m[0]];
    const ry = m => [m[0], m[5], m[1], m[3], m[2], m[4]];
    const rz = m => [m[4], m[0], m[2], m[1], m[3], m[5]];
    
    while (queue.length > 0) {
      const { cube, map } = queue.shift();
      
      // Check if DBL corner is solved (matching target colors for D, L, B)
      if (cube.get(3, 1, 0) === this.targetColors[3] && 
          cube.get(4, 1, 0) === this.targetColors[4] && 
          cube.get(5, 1, 1) === this.targetColors[5]) {
        return { cube, map };
      }
      
      // x rotation (R L')
      const mapX = rx(map);
      const keyX = mapX.join(',');
      if (!visited.has(keyX)) {
        visited.add(keyX);
        const cubeX = cube.clone();
        cubeX.applyMoves("R L'");
        queue.push({ cube: cubeX, map: mapX });
      }
      
      // y rotation (U D')
      const mapY = ry(map);
      const keyY = mapY.join(',');
      if (!visited.has(keyY)) {
        visited.add(keyY);
        const cubeY = cube.clone();
        cubeY.applyMoves("U D'");
        queue.push({ cube: cubeY, map: mapY });
      }
      
      // z rotation (F B')
      const mapZ = rz(map);
      const keyZ = mapZ.join(',');
      if (!visited.has(keyZ)) {
        visited.add(keyZ);
        const cubeZ = cube.clone();
        cubeZ.applyMoves("F B'");
        queue.push({ cube: cubeZ, map: mapZ });
      }
    }
    return null;
  }

  _detectTargetColors() {
    const cube = this.cube;
    const physicalCorners = [];
    for (let j = 0; j < 8; j++) {
      physicalCorners.push(this._getPhysicalCornerCW(j));
    }

    const cornerPositions = [
      [0, 2, 4], // UFL
      [0, 1, 2], // UFR
      [0, 4, 5], // UBL
      [0, 5, 1], // UBR
      [3, 4, 2], // DFL
      [3, 2, 1], // DFR
      [3, 5, 4], // DBL
      [3, 1, 5]  // DBR
    ];

    // Helper to generate permutations
    const permutations = [];
    const permute = (arr, m = []) => {
      if (arr.length === 0) {
        permutations.push(m);
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    };
    permute([0, 1, 2, 3, 4, 5]);

    for (const C of permutations) {
      // Build target corners under color mapping C
      const targetCorners = cornerPositions.map(pos => pos.map(f => C[f]));
      
      // Match physical corners to target corners
      const matchedTargets = new Set();
      let allMatched = true;

      for (let j = 0; j < 8; j++) {
        const [p0, p1, p2] = physicalCorners[j];
        
        let foundMatch = false;
        for (let k = 0; k < 8; k++) {
          if (matchedTargets.has(k)) continue;
          
          const [t0, t1, t2] = targetCorners[k];
          const isCyclic = (p0 === t0 && p1 === t1 && p2 === t2) ||
                           (p0 === t1 && p1 === t2 && p2 === t0) ||
                           (p0 === t2 && p1 === t0 && p2 === t1);
          if (isCyclic) {
            matchedTargets.add(k);
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          allMatched = false;
          break;
        }
      }

      if (allMatched && matchedTargets.size === 8) {
        return C;
      }
    }
    return null;
  }

  _getPhysicalCornerCW(j) {
    const cube = this.cube;
    switch (j) {
      case 0: return [cube.faces[0][2], cube.faces[2][0], cube.faces[4][1]]; // UFL: U(0), F(2), L(4)
      case 1: return [cube.faces[0][3], cube.faces[1][0], cube.faces[2][1]]; // UFR: U(0), R(1), F(2)
      case 2: return [cube.faces[0][0], cube.faces[4][0], cube.faces[5][1]]; // UBL: U(0), L(4), B(5)
      case 3: return [cube.faces[0][1], cube.faces[5][0], cube.faces[1][1]]; // UBR: U(0), B(5), R(1)
      case 4: return [cube.faces[3][0], cube.faces[4][3], cube.faces[2][2]]; // DFL: D(3), L(4), F(2)
      case 5: return [cube.faces[3][1], cube.faces[2][3], cube.faces[1][2]]; // DFR: D(3), F(2), R(1)
      case 6: return [cube.faces[3][2], cube.faces[5][3], cube.faces[4][2]]; // DBL: D(3), B(5), L(4)
      case 7: return [cube.faces[3][3], cube.faces[1][3], cube.faces[5][2]]; // DBR: D(3), R(1), B(5)
    }
  }
}


