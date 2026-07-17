import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#wave-canvas');
const container = document.querySelector('.visual-wrap');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 1.8, 12.5);

const waveGroup = new THREE.Group();
waveGroup.rotation.set(-0.22, -0.12, -0.08);
scene.add(waveGroup);

const gold = new THREE.Color('#b88035');
const paleGold = new THREE.Color('#e0bd7a');
const rows = [];
const circuits = [];
const particles = [];
const ROW_COUNT = 29;
const POINTS_PER_ROW = 108;

function waveY(x, z, time = 0) {
  const broad = Math.sin(x * 0.68 + z * 0.58 + time) * 0.72;
  const detail = Math.sin(x * 1.65 - z * 0.28 - time * 0.7) * 0.13;
  const lift = Math.exp(-Math.pow((x - 1.1) * 0.3, 2)) * 0.8;
  return broad + detail + lift - 0.15;
}

function makeRow(rowIndex) {
  const z = (rowIndex - (ROW_COUNT - 1) / 2) * 0.19;
  const positions = new Float32Array(POINTS_PER_ROW * 3);
  for (let i = 0; i < POINTS_PER_ROW; i++) {
    const x = (i / (POINTS_PER_ROW - 1) - 0.5) * 12;
    positions[i * 3] = x;
    positions[i * 3 + 1] = waveY(x, z);
    positions[i * 3 + 2] = z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: rowIndex % 4 === 0 ? paleGold : gold,
    transparent: true,
    opacity: 0.16 + (1 - Math.abs(z) / 3) * 0.23,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(geometry, material);
  waveGroup.add(line);
  rows.push({ line, z, offset: rowIndex * 0.11 });
}

for (let i = 0; i < ROW_COUNT; i++) makeRow(i);

// Short right-angled traces and circular terminals make the flowing mesh feel engineered.
for (let i = 0; i < 25; i++) {
  const z = THREE.MathUtils.randFloatSpread(4.5);
  const x = THREE.MathUtils.randFloat(-4.8, 4.9);
  const length = THREE.MathUtils.randFloat(.3, 1.0);
  const y = waveY(x, z) + .025;
  const points = [
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(x + length * .68, waveY(x + length * .68, z) + .025, z),
    new THREE.Vector3(x + length, waveY(x + length, z + length * .32) + .025, z + length * .32)
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: paleGold, transparent: true, opacity: .48, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(geometry, material);
  waveGroup.add(line);

  const terminalGeometry = new THREE.RingGeometry(.035, .065, 18);
  const terminalMaterial = new THREE.MeshBasicMaterial({ color: '#c28c42', transparent: true, opacity: .75, side: THREE.DoubleSide });
  const terminal = new THREE.Mesh(terminalGeometry, terminalMaterial);
  const end = points[2];
  terminal.position.copy(end);
  terminal.rotation.x = Math.PI / 2;
  waveGroup.add(terminal);
  circuits.push({ line, terminal, seed: Math.random() * Math.PI * 2 });
}

const particleGeometry = new THREE.SphereGeometry(.028, 8, 8);
for (let i = 0; i < 38; i++) {
  const material = new THREE.MeshBasicMaterial({ color: i % 5 ? gold : '#fff2c7', transparent: true, opacity: .75 });
  const particle = new THREE.Mesh(particleGeometry, material);
  const state = { mesh: particle, progress: Math.random(), speed: THREE.MathUtils.randFloat(.025, .055), z: THREE.MathUtils.randFloatSpread(4.8), phase: Math.random() * 8 };
  particles.push(state);
  waveGroup.add(particle);
}

const dustPositions = new Float32Array(300 * 3);
for (let i = 0; i < 300; i++) {
  dustPositions[i * 3] = THREE.MathUtils.randFloatSpread(12);
  dustPositions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(4);
  dustPositions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(5.5);
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#c9a063', size: .022, transparent: true, opacity: .32, depthWrite: false }));
waveGroup.add(dust);

const pointer = new THREE.Vector2();
const targetPointer = new THREE.Vector2();
container.addEventListener('pointermove', (event) => {
  const rect = container.getBoundingClientRect();
  targetPointer.x = ((event.clientX - rect.left) / rect.width - .5) * 2;
  targetPointer.y = ((event.clientY - rect.top) / rect.height - .5) * 2;
});
container.addEventListener('pointerleave', () => targetPointer.set(0, 0));

function resize() {
  const { width, height } = container.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize, { passive: true });
resize();

const clock = new THREE.Clock();
function render() {
  const t = reducedMotion ? .8 : clock.getElapsedTime() * .38;
  pointer.lerp(targetPointer, .045);
  waveGroup.rotation.y += ((-.12 + pointer.x * .09) - waveGroup.rotation.y) * .025;
  waveGroup.rotation.x += ((-.22 + pointer.y * .055) - waveGroup.rotation.x) * .025;

  rows.forEach(({ line, z, offset }) => {
    const attr = line.geometry.attributes.position;
    for (let i = 0; i < POINTS_PER_ROW; i++) {
      const x = attr.getX(i);
      attr.setY(i, waveY(x, z, t + offset) + Math.sin(t * 1.25 + offset) * .025);
    }
    attr.needsUpdate = true;
  });

  particles.forEach((state) => {
    if (!reducedMotion) state.progress = (state.progress + state.speed * .014) % 1;
    const x = (state.progress - .5) * 11.4;
    state.mesh.position.set(x, waveY(x, state.z, t + state.phase) + .06, state.z);
    const pulse = .58 + Math.sin(t * 6 + state.phase) * .32;
    state.mesh.material.opacity = pulse;
    state.mesh.scale.setScalar(.72 + pulse * .7);
  });

  circuits.forEach(({ terminal, seed }) => {
    terminal.material.opacity = .42 + Math.sin(t * 3.2 + seed) * .28;
  });
  dust.rotation.y = t * .015;
  renderer.render(scene, camera);
  if (!reducedMotion) requestAnimationFrame(render);
}
render();
