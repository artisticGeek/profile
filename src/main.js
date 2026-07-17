import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#wave-canvas');
const container = document.querySelector('.visual-wrap');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0.05, 11.8);

scene.add(new THREE.HemisphereLight('#fff9ed', '#7f5524', 2.1));
const keyLight = new THREE.DirectionalLight('#fff4da', 5.5);
keyLight.position.set(-3, 6, 8);
scene.add(keyLight);
const rimLight = new THREE.PointLight('#e9a83d', 20, 15, 2);
rimLight.position.set(4, -1, 4);
scene.add(rimLight);

const sculpture = new THREE.Group();
sculpture.rotation.set(-0.04, -0.14, -0.075);
sculpture.position.set(-0.05, 0.08, 0);
sculpture.scale.setScalar(0.88);
scene.add(sculpture);

const palette = ['#75532c', '#8f6837', '#ad8147', '#c79b5e', '#d5b47e', '#9f7746'];
const strands = [];
const circuitRuns = [];
const sparks = [];

function seeded(index, salt = 0) {
  return Math.sin(index * 91.733 + salt * 37.19) * 0.5 + 0.5;
}

function ringPoint(angle, radius, index, t) {
  const texture = Math.sin(angle * (3 + (index % 5)) + index * 1.71) * (0.025 + seeded(index, 4) * 0.09);
  const ripple = Math.sin(angle * 9.2 + index * 0.37) * 0.025;
  const r = radius + texture + ripple;
  return new THREE.Vector3(
    Math.cos(angle) * r,
    Math.sin(angle) * r * 0.94,
    Math.sin(angle * 2.25 + index * 0.48) * (0.12 + seeded(index, 5) * 0.32) + (t - 0.5) * 0.18
  );
}

function makeBrushRibbon(curve, row) {
  const samples = 110;
  const positions = new Float32Array((samples + 1) * 2 * 3);
  const indices = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const endTaper = Math.min(1, t * 8, (1 - t) * 8);
    const dryBrush = 0.48 + Math.abs(Math.sin(t * (17 + row % 7) + row)) * 0.52;
    const width = (0.018 + seeded(row, 41) * 0.025) * endTaper * dryBrush;
    const left = point.clone().addScaledVector(side, width);
    const right = point.clone().addScaledVector(side, -width);
    positions.set([left.x, left.y, left.z, right.x, right.y, right.z], i * 6);
    if (i < samples) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Fine filaments plus occasional flat ribbons create a dry-brush gesture, not a cable bundle.
for (let row = 0; row < 32; row++) {
  const normalized = row / 31;
  const radius = 2.85 + (normalized - 0.5) * 0.72 + (seeded(row, 2) - 0.5) * 0.18;
  const start = 0.47 + seeded(row, 7) * 0.18;
  const end = Math.PI * 2 - 0.53 - seeded(row, 8) * 0.22;
  const points = [];
  const divisions = 82;
  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    points.push(ringPoint(THREE.MathUtils.lerp(start, end, t), radius, row, t));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  let mesh;
  let material;
  if (row % 5 === 0) {
    const geometry = makeBrushRibbon(curve, row);
    material = new THREE.MeshStandardMaterial({
      color: palette[row % palette.length],
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.24 + seeded(row, 10) * 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    mesh = new THREE.Mesh(geometry, material);
  } else {
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(150));
    material = new THREE.LineBasicMaterial({
      color: palette[row % palette.length],
      transparent: true,
      opacity: 0.28 + seeded(row, 10) * 0.47,
      depthWrite: false
    });
    mesh = new THREE.Line(geometry, material);
  }
  sculpture.add(mesh);
  strands.push({ mesh, baseOpacity: material.opacity, phase: seeded(row, 11) * Math.PI * 2 });
}

// Broken flecks around the ring keep the material painterly instead of machined.
for (let i = 0; i < 76; i++) {
  const angle = THREE.MathUtils.lerp(0.45, Math.PI * 2 - 0.48, seeded(i, 20));
  const radius = 2.55 + seeded(i, 21) * 1.15;
  const size = 0.008 + seeded(i, 22) * 0.022;
  const geometry = new THREE.SphereGeometry(size, 5, 4);
  const material = new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: 0.25 + seeded(i, 23) * 0.5 });
  const fleck = new THREE.Mesh(geometry, material);
  fleck.position.copy(ringPoint(angle, radius, i + 70, seeded(i, 24)));
  fleck.position.x += (seeded(i, 25) - 0.5) * 0.28;
  fleck.position.y += (seeded(i, 26) - 0.5) * 0.28;
  sculpture.add(fleck);
}

function glowTexture() {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const context = glowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,244,199,1)');
  gradient.addColorStop(0.13, 'rgba(237,177,73,.9)');
  gradient.addColorStop(0.42, 'rgba(204,130,31,.28)');
  gradient.addColorStop(1, 'rgba(204,130,31,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(glowCanvas);
}
const glowMap = glowTexture();

function addGlow(position, scale = 0.52, opacity = 0.55) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap,
    color: '#e3a443',
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  sprite.position.copy(position);
  sprite.scale.setScalar(scale);
  sculpture.add(sprite);
  return sprite;
}

// Fine circuit paths rise from the lower brush and branch visibly inside the open ring.
for (let i = 0; i < 11; i++) {
  const angle = 5.04 - i * 0.026;
  const radius = 2.72 + i * 0.052;
  const start = ringPoint(angle, radius, i + 120, 1);
  start.z += 0.18;
  const end = new THREE.Vector3(
    2.28 + (i % 3) * 0.23,
    -1.15 + i * 0.245,
    0.32 + i * 0.018
  );
  const points = [
    start,
    new THREE.Vector3(start.x + 0.34, start.y + 0.16 + i * 0.012, start.z + 0.04),
    new THREE.Vector3(2.02 + (i % 2) * 0.13, -1.55 + i * 0.13, 0.25),
    end
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const glowGeometry = new THREE.TubeGeometry(curve, 56, 0.022, 5, false);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: '#e6ad4f', transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false });
  sculpture.add(new THREE.Mesh(glowGeometry, glowMaterial));

  const geometry = new THREE.TubeGeometry(curve, 56, 0.007, 5, false);
  const material = new THREE.MeshBasicMaterial({ color: i % 3 ? '#c88c34' : '#f1c875' });
  const trace = new THREE.Mesh(geometry, material);
  sculpture.add(trace);

  const node = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.009, 7, 20),
    new THREE.MeshBasicMaterial({ color: '#bd7e25' })
  );
  node.position.copy(end);
  sculpture.add(node);
  const glow = addGlow(end, 0.29, 0.28);
  circuitRuns.push({ curve, trace, node, glow, phase: i * 0.47 });

  if (i % 2 === 0) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.033, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#fff0b3' })
    );
    sculpture.add(spark);
    const movingGlow = addGlow(new THREE.Vector3(), 0.26, 0.5);
    sculpture.remove(movingGlow);
    movingGlow.position.set(0, 0, 0);
    spark.add(movingGlow);
    sparks.push({ mesh: spark, curve, progress: seeded(i, 30), speed: 0.055 + seeded(i, 31) * 0.07, phase: i });
  }
}

const targetPointer = new THREE.Vector2();
const pointer = new THREE.Vector2();
container.addEventListener('pointermove', (event) => {
  const rect = container.getBoundingClientRect();
  targetPointer.set(
    ((event.clientX - rect.left) / rect.width - 0.5) * 2,
    ((event.clientY - rect.top) / rect.height - 0.5) * 2
  );
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
  const time = reducedMotion ? 1.3 : clock.getElapsedTime();
  pointer.lerp(targetPointer, 0.042);

  sculpture.rotation.y += ((-0.14 + pointer.x * 0.17) - sculpture.rotation.y) * 0.035;
  sculpture.rotation.x += ((-0.04 - pointer.y * 0.08) - sculpture.rotation.x) * 0.035;
  sculpture.rotation.z = -0.075 + Math.sin(time * 0.22) * 0.012;
  sculpture.position.y = 0.08 + Math.sin(time * 0.42) * 0.04;

  strands.forEach(({ mesh, baseOpacity, phase }) => {
    mesh.material.opacity = baseOpacity * (0.88 + Math.sin(time * 0.65 + phase) * 0.12);
  });
  circuitRuns.forEach(({ node, glow, phase }) => {
    const pulse = 0.72 + Math.sin(time * 2.1 + phase) * 0.28;
    node.scale.setScalar(pulse);
    glow.material.opacity = 0.22 + pulse * 0.28;
  });
  sparks.forEach((spark) => {
    if (!reducedMotion) spark.progress = (spark.progress + spark.speed * 0.008) % 1;
    spark.mesh.position.copy(spark.curve.getPoint(spark.progress));
    spark.mesh.scale.setScalar(0.75 + Math.sin(time * 5 + spark.phase) * 0.25);
  });

  renderer.render(scene, camera);
  if (!reducedMotion) requestAnimationFrame(render);
}
render();
