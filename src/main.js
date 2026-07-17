import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#wave-canvas');
const container = document.querySelector('.visual-wrap');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0.1, 12);
scene.add(new THREE.HemisphereLight('#fffaf0', '#71502d', 1.9));

const sculpture = new THREE.Group();
sculpture.position.set(-1.05, 0.12, 0);
sculpture.rotation.set(-0.08, -0.18, -0.055);
sculpture.scale.setScalar(0.84);
scene.add(sculpture);

const palette = ['#7d5b32', '#987044', '#aa814f', '#bd9561', '#cfad79', '#a27a49'];
const animatedLines = [];
const breathingMaterials = [];
const circuitRuns = [];
const sparks = [];

function seeded(index, salt = 0) {
  return Math.sin(index * 91.733 + salt * 37.19) * 0.5 + 0.5;
}

function arcPoint(angle, radius, row, t) {
  const dryVariation = Math.sin(angle * (3.2 + row % 5) + row * 1.41) * (0.025 + seeded(row, 4) * 0.075);
  const r = radius + dryVariation + Math.sin(angle * 10 + row) * 0.018;
  return new THREE.Vector3(
    Math.cos(angle) * r,
    Math.sin(angle) * r * 0.92,
    Math.sin(angle * 2.2 + row * 0.42) * (0.08 + seeded(row, 5) * 0.24) + (t - 0.5) * 0.15
  );
}

function hybridPoints(row, count = 145) {
  const points = [];
  const radius = 2.62 + (row / 25 - 0.5) * 0.66 + (seeded(row, 2) - 0.5) * 0.13;
  const arcEndIndex = 91;
  const startAngle = 0.58 + seeded(row, 7) * 0.12;
  const endAngle = 5.08 - seeded(row, 8) * 0.12;

  for (let i = 0; i < arcEndIndex; i++) {
    const t = i / (arcEndIndex - 1);
    points.push(arcPoint(THREE.MathUtils.lerp(startAngle, endAngle, t), radius, row, t));
  }

  const origin = points.at(-1);
  const tailCount = count - arcEndIndex;
  for (let i = 1; i <= tailCount; i++) {
    const q = i / tailCount;
    const dissolve = 1 - q;
    const x = origin.x + q * (4.35 + seeded(row, 12) * 0.7);
    const wave = Math.sin(q * Math.PI * 2.35 + row * 0.17) * (0.13 + q * 0.34);
    const y = origin.y + q * (1.42 + (row / 25 - 0.5) * 0.45) + wave;
    const z = origin.z + Math.sin(q * Math.PI * 2 + row * 0.35) * 0.18 * dissolve + (row / 25 - 0.5) * 0.18;
    points.push(new THREE.Vector3(x, y, z));
  }
  return { points, arcEndIndex };
}

function makeRibbon(curve, row, widthScale = 1) {
  const samples = 128;
  const positions = new Float32Array((samples + 1) * 6);
  const indices = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const endTaper = Math.min(1, t * 9, (1 - t) * 7);
    const dissolve = t > 0.68 ? Math.max(0.08, 1 - (t - 0.68) * 2.6) : 1;
    const brokenEdge = 0.48 + Math.abs(Math.sin(t * (21 + row % 6) + row * 0.7)) * 0.52;
    const width = (0.014 + seeded(row, 41) * 0.025) * widthScale * endTaper * dissolve * brokenEdge;
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

const curves = [];
for (let row = 0; row < 26; row++) {
  const { points, arcEndIndex } = hybridPoints(row);
  const curve = new THREE.CatmullRomCurve3(points);
  curves.push(curve);

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: palette[row % palette.length],
    transparent: true,
    opacity: 0.21 + seeded(row, 10) * 0.43,
    depthWrite: false
  });
  const line = new THREE.Line(geometry, material);
  sculpture.add(line);
  animatedLines.push({ line, row, arcEndIndex, baseOpacity: material.opacity });

  if (row % 5 === 0) {
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: palette[(row + 2) % palette.length],
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.16 + seeded(row, 30) * 0.14,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ribbon = new THREE.Mesh(makeRibbon(curve, row, 1.15), ribbonMaterial);
    sculpture.add(ribbon);
    breathingMaterials.push({ material: ribbonMaterial, base: ribbonMaterial.opacity, phase: row });
  }
}

// Extra partial brush strokes weight the circular origin while leaving the outgoing wave airy.
for (let row = 0; row < 7; row++) {
  const points = [];
  const radius = 2.52 + row * 0.075;
  for (let i = 0; i <= 88; i++) {
    const t = i / 88;
    points.push(arcPoint(THREE.MathUtils.lerp(1.85 + row * 0.02, 5.12 - row * 0.012, t), radius, row + 90, t));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const material = new THREE.MeshStandardMaterial({
    color: palette[(row + 1) % palette.length], roughness: 1, metalness: 0,
    transparent: true, opacity: 0.1 + row * 0.013, side: THREE.DoubleSide, depthWrite: false
  });
  sculpture.add(new THREE.Mesh(makeRibbon(curve, row + 60, 1.25), material));
  breathingMaterials.push({ material, base: material.opacity, phase: row * 0.8 });
}

function createGlowMap() {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const context = glowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,246,205,1)');
  gradient.addColorStop(0.15, 'rgba(230,168,65,.75)');
  gradient.addColorStop(0.48, 'rgba(196,121,28,.18)');
  gradient.addColorStop(1, 'rgba(196,121,28,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(glowCanvas);
}
const glowMap = createGlowMap();

function glowSprite(scale = 0.26, opacity = 0.38) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color: '#dda044', transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sprite.scale.setScalar(scale);
  return sprite;
}

// Circuit traces ride selected brush waves; small branches make their engineered nature explicit.
for (let i = 0; i < 7; i++) {
  const curve = curves[2 + i * 3];
  const startT = 0.67 + i * 0.006;
  const endT = 0.91 + (i % 2) * 0.045;
  const points = [];
  for (let p = 0; p <= 46; p++) points.push(curve.getPoint(THREE.MathUtils.lerp(startT, endT, p / 46)));
  const traceCurve = new THREE.CatmullRomCurve3(points);
  const trace = new THREE.Mesh(
    new THREE.TubeGeometry(traceCurve, 60, 0.007, 5, false),
    new THREE.MeshBasicMaterial({ color: i % 2 ? '#b98130' : '#d4a14b' })
  );
  sculpture.add(trace);

  const end = traceCurve.getPoint(1);
  const node = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.009, 7, 20),
    new THREE.MeshBasicMaterial({ color: '#b97a27' })
  );
  node.position.copy(end);
  sculpture.add(node);
  const glow = glowSprite(0.28, 0.28);
  glow.position.copy(end);
  sculpture.add(glow);
  circuitRuns.push({ node, glow, phase: i * 0.72 });

  const branchAt = traceCurve.getPoint(0.48 + (i % 3) * 0.08);
  const branchEnd = branchAt.clone().add(new THREE.Vector3(0.16 + (i % 2) * 0.08, 0.24 + i * 0.035, 0.015));
  const branchGeometry = new THREE.BufferGeometry().setFromPoints([
    branchAt,
    new THREE.Vector3(branchAt.x + 0.13, branchAt.y, branchAt.z),
    branchEnd
  ]);
  sculpture.add(new THREE.Line(branchGeometry, new THREE.LineBasicMaterial({ color: '#b98130', transparent: true, opacity: 0.72 })));
  const branchNode = new THREE.Mesh(new THREE.RingGeometry(0.027, 0.041, 16), new THREE.MeshBasicMaterial({ color: '#b97a27', side: THREE.DoubleSide }));
  branchNode.position.copy(branchEnd);
  sculpture.add(branchNode);

  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 8), new THREE.MeshBasicMaterial({ color: '#fff0b4' }));
  spark.add(glowSprite(0.2, 0.45));
  sculpture.add(spark);
  sparks.push({ mesh: spark, curve: traceCurve, progress: seeded(i, 50), speed: 0.045 + seeded(i, 51) * 0.055, phase: i });
}

// Sparse pigment dust appears only where the brush dissolves into the wave.
const dustPositions = new Float32Array(62 * 3);
for (let i = 0; i < 62; i++) {
  const curve = curves[i % curves.length];
  const t = 0.72 + seeded(i, 60) * 0.25;
  const point = curve.getPoint(t);
  dustPositions.set([
    point.x + (seeded(i, 61) - 0.5) * 0.32,
    point.y + (seeded(i, 62) - 0.5) * 0.32,
    point.z + (seeded(i, 63) - 0.5) * 0.24
  ], i * 3);
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#b98b51', size: 0.025, transparent: true, opacity: 0.34, depthWrite: false }));
sculpture.add(dust);

const targetPointer = new THREE.Vector2();
const pointer = new THREE.Vector2();
container.addEventListener('pointermove', (event) => {
  const rect = container.getBoundingClientRect();
  targetPointer.set(((event.clientX - rect.left) / rect.width - 0.5) * 2, ((event.clientY - rect.top) / rect.height - 0.5) * 2);
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
  const time = reducedMotion ? 1.4 : clock.getElapsedTime();
  pointer.lerp(targetPointer, 0.04);
  sculpture.rotation.y += ((-0.18 + pointer.x * 0.17) - sculpture.rotation.y) * 0.035;
  sculpture.rotation.x += ((-0.08 - pointer.y * 0.08) - sculpture.rotation.x) * 0.035;
  sculpture.rotation.z = -0.055 + Math.sin(time * 0.22) * 0.011;
  sculpture.position.y = 0.12 + Math.sin(time * 0.38) * 0.04;

  animatedLines.forEach(({ line, row, arcEndIndex, baseOpacity }) => {
    line.material.opacity = baseOpacity * (0.9 + Math.sin(time * 0.6 + row) * 0.1);
    if (!reducedMotion) {
      const attr = line.geometry.attributes.position;
      const tailLength = attr.count - arcEndIndex;
      for (let i = arcEndIndex; i < attr.count; i++) {
        const q = (i - arcEndIndex) / Math.max(1, tailLength - 1);
        const base = line.userData.baseY?.[i];
        if (base !== undefined) attr.setY(i, base + Math.sin(time * 0.72 + q * 5.8 + row * 0.16) * q * 0.045);
      }
      attr.needsUpdate = true;
    }
  });

  // Cache immutable Y values on the first frame, after geometry creation.
  animatedLines.forEach(({ line }) => {
    if (!line.userData.baseY) {
      const attr = line.geometry.attributes.position;
      line.userData.baseY = Array.from({ length: attr.count }, (_, i) => attr.getY(i));
    }
  });

  breathingMaterials.forEach(({ material, base, phase }) => {
    material.opacity = base * (0.9 + Math.sin(time * 0.5 + phase) * 0.1);
  });
  circuitRuns.forEach(({ node, glow, phase }) => {
    const pulse = 0.72 + Math.sin(time * 2 + phase) * 0.28;
    node.scale.setScalar(pulse);
    glow.material.opacity = 0.15 + pulse * 0.22;
  });
  sparks.forEach((spark) => {
    if (!reducedMotion) spark.progress = (spark.progress + spark.speed * 0.009) % 1;
    spark.mesh.position.copy(spark.curve.getPoint(spark.progress));
    spark.mesh.scale.setScalar(0.78 + Math.sin(time * 5 + spark.phase) * 0.22);
  });
  dust.rotation.z = Math.sin(time * 0.18) * 0.006;

  renderer.render(scene, camera);
  if (!reducedMotion) requestAnimationFrame(render);
}
render();
