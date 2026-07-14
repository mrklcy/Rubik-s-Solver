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
    if (this.cubeState.isSolved()) return { moves: [] };

    // Map cubeState to cube.js string format dynamically based on face center colors
    const colorToFaceChar = [];
    const usedCenters = new Set();
    for (let f = 0; f < 6; f++) {
      const centerColor = this.cubeState.faces[f][4];
      if (usedCenters.has(centerColor)) {
        return { error: "Duplicate center colors detected. Each face must have a unique center color." };
      }
      usedCenters.add(centerColor);
      colorToFaceChar[centerColor] = ['U', 'R', 'F', 'D', 'L', 'B'][f];
    }

    let str = "";
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 9; i++) {
        const val = this.cubeState.faces[f][i];
        if (colorToFaceChar[val] === undefined) {
          return { error: "Invalid coloring: One or more painted colors do not match any face center color." };
        }
        str += colorToFaceChar[val];
      }
    }

    try {
      if (typeof Cube !== "undefined") {
        Cube.initSolver();
        const kCube = Cube.fromString(str);
        const solutionStr = kCube.solve();
        if (!solutionStr) return { error: "No solution found. Check for paint errors." };

        if (solutionStr.includes("Error")) {
          const errNum = solutionStr.match(/Error (\d+)/);
          if (errNum) {
            const code = parseInt(errNum[1]);
            const messages = {
              1: "There are not exactly 9 facelets of each color.",
              2: "Edge pieces are invalid or duplicate.",
              3: "An edge is flipped (impossible parity).",
              4: "Corner pieces are invalid or duplicate.",
              5: "A corner is twisted (impossible parity).",
              6: "Two corners or two edges are swapped (impossible parity).",
              7: "No solution exists for this configuration.",
              8: "Timeout: No solution found."
            };
            return { error: messages[code] || solutionStr };
          }
          return { error: solutionStr };
        }

        return { moves: solutionStr.trim().split(/\s+/) };
      } else {
        return { error: "Cube solver library not loaded." };
      }
    } catch (e) {
      return { error: "Kociemba solver error: " + e.message };
    }
  }
}
