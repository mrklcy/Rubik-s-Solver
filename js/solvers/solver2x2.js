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
    if (this.cube.isSolved()) return [];

    // 1. Find the orientation where DBL corner is solved.
    // This allows us to search using only U, R, F moves (fixing the DBL corner).
    const orientedResult = this._getOrientedState(this.cube);
    if (!orientedResult) {
      console.error("Could not orient cube!");
      return [];
    }

    const { cube: startState, map } = orientedResult;
    if (startState.isSolved()) return [];

    // 2. Run bidirectional BFS using U, R, F moves
    const allowedMoves = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
    const forwardQueue = [startState];
    const forwardVisited = new Map();
    forwardVisited.set(startState.toFlatString(), []);

    const backwardQueue = [new CubeState(2)];
    const backwardVisited = new Map();
    backwardVisited.set(new CubeState(2).toFlatString(), []);

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
      return [];
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

    return translatedSolution;
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
      
      // Check if DBL corner is solved
      if (cube.get(3, 1, 0) === 3 && cube.get(4, 1, 0) === 4 && cube.get(5, 1, 1) === 5) {
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
}

