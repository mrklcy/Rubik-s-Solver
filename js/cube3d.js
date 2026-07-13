/**
 * Cube3D — Three.js NxN Rubik's Cube renderer
 * 
 * Renders an interactive 3D Rubik's cube with:
 * - Smooth orbit controls
 * - Animated layer rotations
 * - Color picker interaction
 * - Any NxN cube size support
 */

class Cube3D {
  constructor(container, cubeState) {
    this.container = container;
    this.cubeState = cubeState;
    this.n = cubeState.n;
    this.cubies = [];
    this.animating = false;
    this.animationQueue = [];
    this.animationSpeed = 1;
    this.onAnimationComplete = null;
    this.colorPickerMode = false;
    this.selectedColor = 0;

    this._initScene();
    this._buildCube();
    this._animate();
  }

  _initScene() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    const dist = this.n * 2.5;
    this.camera.position.set(dist, dist * 0.8, dist);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Orbit controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enablePan = false;
    this.controls.minDistance = this.n * 2;
    this.controls.maxDistance = this.n * 5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);

    const directional2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directional2.position.set(-5, -3, -5);
    this.scene.add(directional2);

    // Raycaster for click interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Resize handler
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    // Click handler for color picker
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
  }

  _buildCube() {
    // Remove old cubies
    this.cubies.forEach(c => this.scene.remove(c.mesh));
    this.cubies = [];

    const n = this.n;
    const size = 0.9; // cubie size (slightly less than 1 for gaps)
    const gap = 0.05;
    const total = size + gap * 2;
    const offset = (n - 1) / 2;

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          // Only create cubies on the surface
          if (x > 0 && x < n - 1 && y > 0 && y < n - 1 && z > 0 && z < n - 1) continue;

          const cubie = this._createCubie(x, y, z, size);
          cubie.mesh.position.set(
            (x - offset) * total,
            (y - offset) * total,
            (z - offset) * total
          );
          cubie.gridPos = { x, y, z };
          this.scene.add(cubie.mesh);
          this.cubies.push(cubie);
        }
      }
    }

    this.updateColors();
  }

  _createCubie(x, y, z, size) {
    const n = this.n;
    const geometry = new THREE.BoxGeometry(size, size, size);

    // 6 face materials: +x(R), -x(L), +y(U), -y(D), +z(F), -z(B)
    const darkColor = 0x1a1a2e;
    const materials = [
      new THREE.MeshPhongMaterial({ color: darkColor }), // +x (right)
      new THREE.MeshPhongMaterial({ color: darkColor }), // -x (left)
      new THREE.MeshPhongMaterial({ color: darkColor }), // +y (up)
      new THREE.MeshPhongMaterial({ color: darkColor }), // -y (down)
      new THREE.MeshPhongMaterial({ color: darkColor }), // +z (front)
      new THREE.MeshPhongMaterial({ color: darkColor }), // -z (back)
    ];

    const mesh = new THREE.Mesh(geometry, materials);

    // Add thin black border/outline
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    mesh.add(edges);

    return { mesh, materials, x, y, z };
  }

  /**
   * Update cubie face colors from the cubeState
   */
  updateColors() {
    const n = this.n;
    const colors = [
      0xffffff, // 0: White (U)
      0xb71234, // 1: Red (R)
      0x009b48, // 2: Green (F)
      0xffd500, // 3: Yellow (D)
      0xff5800, // 4: Orange (L)
      0x0046ad, // 5: Blue (B)
    ];
    const darkColor = 0x1a1a2e;

    for (const cubie of this.cubies) {
      const { x, y, z } = cubie.gridPos;

      // +x face (right, x = n-1) → R face
      if (x === n - 1) {
        // Map to R face: R viewed from +x
        // R face row: (n-1-y), col depends on z
        // From +x looking -x: top=+y, right=-z
        // So row = n-1-y, col = n-1-z
        const r = n - 1 - y;
        const c = n - 1 - z;
        const color = this.cubeState.get(FACE.R, r, c);
        cubie.materials[0].color.setHex(colors[color]);
      } else {
        cubie.materials[0].color.setHex(darkColor);
      }

      // -x face (left, x = 0) → L face
      if (x === 0) {
        const r = n - 1 - y;
        const c = z;
        const color = this.cubeState.get(FACE.L, r, c);
        cubie.materials[1].color.setHex(colors[color]);
      } else {
        cubie.materials[1].color.setHex(darkColor);
      }

      // +y face (up, y = n-1) → U face
      if (y === n - 1) {
        const r = z;
        const c = x;
        const color = this.cubeState.get(FACE.U, r, c);
        cubie.materials[2].color.setHex(colors[color]);
      } else {
        cubie.materials[2].color.setHex(darkColor);
      }

      // -y face (down, y = 0) → D face
      if (y === 0) {
        const r = n - 1 - z;
        const c = x;
        const color = this.cubeState.get(FACE.D, r, c);
        cubie.materials[3].color.setHex(colors[color]);
      } else {
        cubie.materials[3].color.setHex(darkColor);
      }

      // +z face (front, z = n-1) → F face
      if (z === n - 1) {
        const r = n - 1 - y;
        const c = x;
        const color = this.cubeState.get(FACE.F, r, c);
        cubie.materials[4].color.setHex(colors[color]);
      } else {
        cubie.materials[4].color.setHex(darkColor);
      }

      // -z face (back, z = 0) → B face
      if (z === 0) {
        const r = n - 1 - y;
        const c = n - 1 - x;
        const color = this.cubeState.get(FACE.B, r, c);
        cubie.materials[5].color.setHex(colors[color]);
      } else {
        cubie.materials[5].color.setHex(darkColor);
      }
    }
  }

  /**
   * Animate a single move
   */
  animateMove(move, callback) {
    if (this.animating) {
      if (callback) callback();
      return;
    }
    this.animating = true;

    const parsed = CubeState.parseMove(move);
    if (!parsed) {
      this.animating = false;
      if (callback) callback();
      return;
    }

    const { face, layer, wide, sliceOnly, count } = parsed;
    const endLayer = wide ? layer : 0;

    // Determine axis and angle
    let axis;
    let direction;

    switch (face) {
      case FACE.U: axis = 'y'; direction = -1; break;
      case FACE.D: axis = 'y'; direction = 1; break;
      case FACE.R: axis = 'x'; direction = -1; break;
      case FACE.L: axis = 'x'; direction = 1; break;
      case FACE.F: axis = 'z'; direction = -1; break;
      case FACE.B: axis = 'z'; direction = 1; break;
    }

    const angle = direction * (Math.PI / 2) * (count === 3 ? -1 : count);
    const n = this.n;

    // Find cubies in the affected layer(s)
    const affectedCubies = this.cubies.filter(cubie => {
      const pos = cubie.gridPos;
      const startD = sliceOnly ? layer : 0;
      const endD = sliceOnly ? layer : endLayer;
      for (let d = startD; d <= endD; d++) {
        switch (face) {
          case FACE.U: if (pos.y === n - 1 - d) return true; break;
          case FACE.D: if (pos.y === d) return true; break;
          case FACE.R: if (pos.x === n - 1 - d) return true; break;
          case FACE.L: if (pos.x === d) return true; break;
          case FACE.F: if (pos.z === n - 1 - d) return true; break;
          case FACE.B: if (pos.z === d) return true; break;
        }
      }
      return false;
    });

    // Create a group for animation
    const group = new THREE.Group();
    this.scene.add(group);

    affectedCubies.forEach(cubie => {
      this.scene.remove(cubie.mesh);
      group.add(cubie.mesh);
    });

    // Animate
    const duration = 300 / this.animationSpeed;
    const startTime = performance.now();
    const startRotation = 0;

    const animateStep = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentAngle = startRotation + angle * eased;

      group.rotation.set(0, 0, 0);
      if (axis === 'x') group.rotation.x = currentAngle;
      if (axis === 'y') group.rotation.y = currentAngle;
      if (axis === 'z') group.rotation.z = currentAngle;

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      } else {
        // Animation complete - update state and clean up
        affectedCubies.forEach(cubie => {
          group.remove(cubie.mesh);
          this.scene.add(cubie.mesh);
        });
        this.scene.remove(group);

        // Apply the move to the state
        this.cubeState.applyMove(move);

        // Rebuild cubie grid positions
        this._rebuildGridPositions();
        this.updateColors();

        this.animating = false;
        if (callback) callback();
      }
    };

    requestAnimationFrame(animateStep);
  }

  _rebuildGridPositions() {
    const n = this.n;
    const gap = 0.05;
    const size = 0.9;
    const total = size + gap * 2;
    const offset = (n - 1) / 2;

    // Reset all cubie positions based on grid
    for (const cubie of this.cubies) {
      const { x, y, z } = cubie.gridPos;
      cubie.mesh.position.set(
        (x - offset) * total,
        (y - offset) * total,
        (z - offset) * total
      );
      cubie.mesh.rotation.set(0, 0, 0);
    }
  }

  /**
   * Animate a sequence of moves
   */
  animateMoves(moves, callback) {
    if (!moves || moves.length === 0) {
      if (callback) callback();
      return;
    }

    const moveList = typeof moves === 'string' ? moves.trim().split(/\s+/) : moves;
    let index = 0;

    const next = () => {
      if (index >= moveList.length) {
        if (callback) callback();
        return;
      }
      this.animateMove(moveList[index], () => {
        index++;
        next();
      });
    };

    next();
  }

  /**
   * Apply a move instantly (no animation)
   */
  applyMoveInstant(move) {
    this.cubeState.applyMove(move);
    this.updateColors();
  }

  /**
   * Rebuild the cube (e.g., after changing size)
   */
  rebuild(cubeState) {
    this.cubeState = cubeState;
    this.n = cubeState.n;

    const dist = this.n * 2.5;
    this.camera.position.set(dist, dist * 0.8, dist);
    this.controls.minDistance = this.n * 2;
    this.controls.maxDistance = this.n * 5;

    this._buildCube();
  }

  /**
   * Handle click events for color picker
   */
  _onClick(event) {
    if (!this.colorPickerMode) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.cubies.map(c => c.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const faceIndex = hit.face.materialIndex;
      const cubie = this.cubies.find(c => c.mesh === hit.object);

      if (cubie) {
        const facelet = this._getFaceletFromHit(cubie, faceIndex);
        if (facelet) {
          this.cubeState.set(facelet.face, facelet.r, facelet.c, this.selectedColor);
          this.updateColors();
        }
      }
    }
  }

  _getFaceletFromHit(cubie, materialIndex) {
    const n = this.n;
    const { x, y, z } = cubie.gridPos;

    // materialIndex: 0=+x(R), 1=-x(L), 2=+y(U), 3=-y(D), 4=+z(F), 5=-z(B)
    switch (materialIndex) {
      case 0: // R
        if (x === n - 1) return { face: FACE.R, r: n - 1 - y, c: n - 1 - z };
        break;
      case 1: // L
        if (x === 0) return { face: FACE.L, r: n - 1 - y, c: z };
        break;
      case 2: // U
        if (y === n - 1) return { face: FACE.U, r: z, c: x };
        break;
      case 3: // D
        if (y === 0) return { face: FACE.D, r: n - 1 - z, c: x };
        break;
      case 4: // F
        if (z === n - 1) return { face: FACE.F, r: n - 1 - y, c: x };
        break;
      case 5: // B
        if (z === 0) return { face: FACE.B, r: n - 1 - y, c: n - 1 - x };
        break;
    }
    return null;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
