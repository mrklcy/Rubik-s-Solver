/**
 * 3x3 Rubik's Cube Solver — Herbert Kociemba's Two-Phase Algorithm
 *
 * Finds optimal solutions in 22 moves or fewer.
 */

class Solver3x3 {
  constructor(cubeState) {
    this.cubeState = cubeState;
  }

  solve() {
    if (this.cubeState.isSolved()) return [];

    // Map cubeState to cube.js string format (U1..U9, R1..R9, F1..F9, D1..D9, L1..L9, B1..B9)
    const charMap = ['U', 'R', 'F', 'D', 'L', 'B'];
    let str = "";
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 9; i++) {
        str += charMap[this.cubeState.faces[f][i]];
      }
    }

    try {
      if (typeof Cube !== "undefined") {
        // Initialize solver tables (safe to call multiple times, only runs once internally)
        Cube.initSolver();
        const kCube = Cube.fromString(str);
        const solutionStr = kCube.solve();
        if (!solutionStr) return [];
        return solutionStr.trim().split(/\s+/);
      } else {
        console.error("Cube library not loaded");
        return [];
      }
    } catch (e) {
      console.error("Kociemba solver error:", e);
      return [];
    }
  }
}
