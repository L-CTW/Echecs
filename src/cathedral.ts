import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACE_Y, xz } from './layout';
import type { Materials } from './materials';
import { GLASS, lancetTexture, labelTexture, roseTexture, type GlassPalette } from './textures';

const COL_X = 8.7;
const COL_Z = [-14, -6, 2, 10];
const SPRING = 5.85;
const RISE = 6.05;
const WALL = 12.25;
const APSE = -19.55;
const DOOR = 16.35;

export interface Torch {
  sprites: THREE.Sprite[];
  light: THREE.PointLight | null;
  phase: number;
  base: number;
}

export interface CathedralRig {
  torches: Torch[];
  shafts: THREE.Mesh[];
  dust: THREE.Points;
  pickRoot: THREE.Group;
}

function archPoint(halfSpan: number, rise: number, t: number) {
  const s = halfSpan;
  const cx = (rise * rise - s * s) / (2 * s);
  const R = Math.hypot(cx, rise);
  if (t <= 0.5) {
    const u = t / 0.5;
    const a0 = Math.atan2(0, -s - cx);
    const a1 = Math.atan2(rise, -cx);
    const a = a0 + (a1 - a0) * u;
    return { x: cx + Math.cos(a) * R, y: Math.sin(a) * R };
  }
  const u = (t - 0.5) / 0.5;
  const a0 = Math.atan2(rise, cx);
  const a1 = Math.atan2(0, s + cx);
  const a = a0 + (a1 - a0) * u;
  return { x: -cx + Math.cos(a) * R, y: Math.sin(a) * R };
}

function archShape(halfSpan: number, rise: number) {
  const shape = new THREE.Shape();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const p = archPoint(halfSpan, rise, i / n);
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  return shape;
}

function shaderWithoutToneMap() {
  const base = (Reflector as unknown as {
    ReflectorShader: { uniforms: object; vertexShader: string; fragmentShader: string };
  }).ReflectorShader;
  return {
    name: 'NightFloor',
    uniforms: base.uniforms,
    vertexShader: base.vertexShader,
    fragmentShader: base.fragmentShader
      .replace('#include <tonemapping_fragment>', '')
      .replace('#include <colorspace_fragment>', ''),
  };
}

export function buildCathedral(scene: THREE.Scene, mats: Materials): CathedralRig {
  const root = new THREE.Group();
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  const sources = new Set<THREE.BufferGeometry>();

  const put = (mesh: THREE.Mesh, bucket: string) => {
    mesh.userData.bucket = bucket;
    sources.add(mesh.geometry);
    root.add(mesh);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, bucket: string, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    put(mesh, bucket);
    return mesh;
  };

  box(70, 0.4, 80, 0, 12.55, -1.5, 'vault', mats.vault);
  box(0.8, 12.6, 36.2, WALL + 0.4, 6.3, -1.6, 'stone', mats.stone);
  box(0.8, 12.6, 36.2, -WALL - 0.4, 6.3, -1.6, 'stone', mats.stone);
  box(WALL * 2 + 1.6, 12.6, 0.7, 0, 6.3, APSE - 0.35, 'stone', mats.stone);
  box(WALL * 2 + 1.6, 12.6, 0.7, 0, 6.3, DOOR + 0.35, 'stone', mats.stone);

  box(46, 0.24, 56, 0, -0.08, -2, 'stone', mats.stone);
  const slabTop = SURFACE_Y - 0.095;
  box(10.6, 0.38, 10.6, 0, slabTop - 0.19, 0, 'stone', mats.stone);
  box(12.3, 0.36, 12.3, 0, slabTop - 0.38 - 0.18, 0, 'stone', mats.stone);
  box(14.1, 0.36, 14.1, 0, 0.2, 0, 'stone', mats.stone);
  const gold = new THREE.Mesh(new THREE.BoxGeometry(8.28, 0.04, 8.28), mats.gold);
  gold.position.y = SURFACE_Y - 0.075;
  put(gold, 'gold');

  for (const file of [-1, 1]) {
    for (const rank of [-1, 1]) {
      const finial = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.14, 8), mats.gold);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mats.gold);
      ball.position.y = 0.16;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), mats.gold);
      tip.position.y = 0.28;
      finial.add(base, ball, tip);
      finial.position.set(file * 4.95, slabTop, rank * 4.95);
      finial.updateMatrixWorld(true);
      finial.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const g = mesh.geometry.clone();
        g.applyMatrix4(mesh.matrixWorld);
        const list = buckets.get('gold') ?? [];
        list.push(g);
        buckets.set('gold', list);
      });
    }
  }

  const columnGeo = new THREE.CylinderGeometry(0.34, 0.4, SPRING, 14);
  const shaftGeo = new THREE.CylinderGeometry(0.09, 0.11, SPRING * 0.94, 8);
  const capGeo = new THREE.CylinderGeometry(0.72, 0.5, 0.32, 12);
  for (const z of COL_Z) {
    for (const side of [-1, 1]) {
      const x = side * COL_X;
      const main = new THREE.Mesh(columnGeo, mats.stone);
      main.position.set(x, SPRING / 2, z);
      put(main, 'stone');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const shaft = new THREE.Mesh(shaftGeo, mats.stone);
        shaft.position.set(x + Math.cos(a) * 0.38, SPRING * 0.47, z + Math.sin(a) * 0.38);
        put(shaft, 'stone');
      }
      const cap = new THREE.Mesh(capGeo, mats.stone);
      cap.position.set(x, SPRING + 0.1, z);
      put(cap, 'stone');
    }
  }

  const archZs = [-18, ...COL_Z, 14.5];
  for (const z of archZs) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 18; i++) {
      const p = archPoint(COL_X, RISE, i / 18);
      pts.push(new THREE.Vector3(p.x, p.y + SPRING, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.09, 7, false), mats.rib);
    put(tube, 'rib');
  }
  const bays: [number, number][] = [[-18, -14], [-14, -6], [-6, 2], [2, 10], [10, 14.5]];
  for (const [z0, z1] of bays) {
    const segs = 16;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const p = archPoint(COL_X, RISE + 0.18, i / segs);
      positions.push(p.x, p.y + SPRING, z0, p.x, p.y + SPRING, z1);
      uvs.push(i / segs, 0, i / segs, 1);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    put(new THREE.Mesh(geo, mats.vault), 'vault');

    const mid = (z0 + z1) / 2;
    const apex = SPRING + RISE - 0.05;
    const diagonals = [
      [new THREE.Vector3(-COL_X, SPRING, z0), new THREE.Vector3(0, apex, mid), new THREE.Vector3(COL_X, SPRING, z1)],
      [new THREE.Vector3(COL_X, SPRING, z0), new THREE.Vector3(0, apex, mid), new THREE.Vector3(-COL_X, SPRING, z1)],
    ];
    for (const points of diagonals) {
      const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.055, 6, false), mats.rib);
      put(rib, 'rib');
    }
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 33, 8), mats.rib);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, SPRING + RISE, -1.5);
  put(ridge, 'rib');

  const altarZ = -15.7;
  box(3.5, 1.05, 1.2, 0, 0.62, altarZ, 'stone', mats.stone);
  box(2.7, 0.72, 0.08, 0, 0.62, altarZ + 0.64, 'cloth', mats.cloth);
  box(4.2, 0.18, 2.1, 0, 0.1, altarZ + 0.7, 'stone', mats.stone);
  box(3.4, 0.16, 1.6, 0, 0.26, altarZ + 0.45, 'stone', mats.stone);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), mats.gold);
  crossV.position.set(0, 1.75, altarZ);
  put(crossV, 'gold');
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.1), mats.gold);
  crossH.position.set(0, 2.05, altarZ);
  put(crossH, 'gold');

  for (let i = 0; i < 7; i++) {
    const h = 1.7 + (i % 4) * 0.38;
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, h, 8), mats.iron);
      pipe.position.set(side * (2.15 + i * 0.26), h / 2, altarZ - 0.85);
      put(pipe, 'iron');
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12), mats.gold);
      lip.rotation.x = Math.PI / 2;
      lip.position.set(side * (2.15 + i * 0.26), h - 0.02, altarZ - 0.85);
      put(lip, 'gold');
    }
  }

  const doorShape = archShape(1.15, 3.3);
  const door = new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape, { depth: 0.18, bevelEnabled: false }), mats.wood);
  door.position.set(0, 0.05, DOOR - 0.2);
  put(door, 'wood');
  box(0.08, 2.4, 0.22, -0.85, 1.5, DOOR - 0.16, 'iron', mats.iron);
  box(0.08, 2.4, 0.22, 0.85, 1.5, DOOR - 0.16, 'iron', mats.iron);

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.bucket) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    const key = mesh.userData.bucket as string;
    const list = buckets.get(key) ?? [];
    list.push(g);
    buckets.set(key, list);
  });
  const matOf: Record<string, THREE.Material> = {
    stone: mats.stone,
    vault: mats.vault,
    rib: mats.rib,
    wood: mats.wood,
    iron: mats.iron,
    cloth: mats.cloth,
    gold: mats.gold,
  };
  for (const [key, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) {
      console.warn('merge failed', key);
      continue;
    }
    const mesh = new THREE.Mesh(merged, matOf[key]);
    mesh.castShadow = false;
    mesh.receiveShadow = key === 'stone' || key === 'gold';
    scene.add(mesh);
  }
  for (const g of sources) g.dispose();

  const lightGeo = new THREE.BoxGeometry(0.93, 0.055, 0.93);
  const darkGeo = lightGeo.clone();
  const lightParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];
  const pickRoot = new THREE.Group();
  const pickGeo = new THREE.PlaneGeometry(0.98, 0.98);
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const [x, z] = xz(file, rank);
      const g = ((file + rank) & 1 ? lightGeo : darkGeo).clone();
      g.translate(x, SURFACE_Y - 0.0275, z);
      ((file + rank) & 1 ? lightParts : darkParts).push(g);
      const pick = new THREE.Mesh(pickGeo, pickMat);
      pick.rotation.x = -Math.PI / 2;
      pick.position.set(x, SURFACE_Y + 0.03, z);
      pick.layers.set(1);
      pick.userData = { kind: 'square', file, rank };
      pickRoot.add(pick);
    }
  }
  const lightBoard = new THREE.Mesh(mergeGeometries(lightParts)!, mats.boardLight);
  const darkBoard = new THREE.Mesh(mergeGeometries(darkParts)!, mats.boardDark);
  lightBoard.receiveShadow = darkBoard.receiveShadow = true;
  scene.add(lightBoard, darkBoard, pickRoot);
  lightParts.forEach((g) => g.dispose());
  darkParts.forEach((g) => g.dispose());

  const files = 'abcdefgh';
  for (let i = 0; i < 8; i++) {
    const [x, z] = xz(i, 0);
    const near = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({
      map: labelTexture(files[i]),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }));
    near.rotation.x = -Math.PI / 2;
    near.position.set(x, slabTop + 0.05, z + 1.62);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({
      map: labelTexture(files[i], true),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }));
    far.rotation.x = -Math.PI / 2;
    far.position.set(x, slabTop + 0.05, -(z + 1.62));
    scene.add(near, far);
    const [lx] = xz(0, i);
    const rankNear = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({
      map: labelTexture(String(i + 1)),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }));
    rankNear.rotation.x = -Math.PI / 2;
    rankNear.position.set(lx - 1.62, slabTop + 0.05, xz(0, i)[1]);
    scene.add(rankNear);
  }

  const torches: Torch[] = [];
  const shafts: THREE.Mesh[] = [];
  const addFlame = (x: number, y: number, z: number, light: boolean, phase: number) => {
    const a = new THREE.Sprite(mats.flame);
    const b = new THREE.Sprite(mats.flame);
    a.position.set(x, y, z);
    b.position.set(x, y + 0.16, z);
    a.scale.set(0.42, 0.62, 1);
    b.scale.set(0.2, 0.32, 1);
    scene.add(a, b);
    let point: THREE.PointLight | null = null;
    if (light) {
      point = new THREE.PointLight(0xff8a3c, 16, 9.5, 2);
      point.position.set(x, y, z);
      scene.add(point);
    }
    torches.push({ sprites: [a, b], light: point, phase, base: 16 });
  };

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 5.55;
      const z = sz * 5.55;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.16, 8), mats.iron);
      cup.position.set(x, slabTop - 0.38 + 0.55, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 6), mats.iron);
      stem.position.set(x, slabTop - 0.38 + 0.2, z);
      cup.castShadow = stem.castShadow = false;
      scene.add(cup, stem);
      addFlame(x, slabTop - 0.38 + 0.72, z, true, Math.random() * 10);
    }
  }
  for (const z of [-6, 2]) {
    for (const side of [-1, 1]) {
      const x = side * (COL_X - 0.2);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mats.iron);
      bracket.position.set(x - side * 0.25, 2.15, z);
      scene.add(bracket);
      addFlame(x - side * 0.48, 2.28, z, false, Math.random() * 10);
    }
  }

  const makeLancet = (palette: GlassPalette, withLight: boolean) => {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(archShape(1.02, 2.55), { depth: 0.28, bevelEnabled: false }),
      mats.stone,
    );
    const glassTex = lancetTexture(palette);
    const glassMat = new THREE.MeshStandardMaterial({
      map: glassTex,
      color: 0x111111,
      emissive: 0xffffff,
      emissiveMap: glassTex,
      emissiveIntensity: 1.8,
      roughness: 0.42,
      side: THREE.DoubleSide,
    });
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.86, 2.28)), glassMat);
    glass.position.set(0, 0.08, 0.3);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.06), mats.stone);
    mullion.position.set(0, 1.05, 0.34);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.06), mats.stone);
    bar.position.set(0, 1.35, 0.34);
    group.add(frame, glass, mullion, bar);
    const shaftMat = new THREE.MeshBasicMaterial({
      map: mats.shaft,
      color: palette.light,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 8.5), shaftMat);
    shaft.position.set(0, -2.4, 3.6);
    shaft.rotation.x = -0.42;
    group.add(shaft);
    shafts.push(shaft);
    if (withLight) {
      const light = new THREE.PointLight(palette.light, 7, 14, 2);
      light.position.set(0, 1.4, 1.4);
      group.add(light);
    }
    return group;
  };

  const windowZ = [-10, -2, 6, 13];
  windowZ.forEach((z, i) => {
    for (const side of [-1, 1] as const) {
      const win = makeLancet(GLASS[(i + (side === 1 ? 1 : 0)) % GLASS.length], i === 1);
      win.position.set(side * WALL, 2.15, z);
      win.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(win);
    }
  });

  const roseMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: roseTexture(),
    emissiveIntensity: 1.65,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const rose = new THREE.Group();
  const roseGlass = new THREE.Mesh(new THREE.CircleGeometry(3.15, 64), roseMat);
  const roseFrame = new THREE.Mesh(new THREE.RingGeometry(3.12, 3.55, 64), mats.stone);
  const roseGold = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.045, 8, 48), mats.gold);
  const roseGold2 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 8, 32), mats.gold);
  roseGold.position.z = 0.04;
  roseGold2.position.z = 0.05;
  rose.add(roseGlass, roseFrame, roseGold, roseGold2);
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 6.2, 0.05), mats.stone);
    bar.position.z = 0.06;
    bar.rotation.z = (i / 4) * Math.PI;
    rose.add(bar);
  }
  rose.position.set(0, 7.15, APSE + 0.2);
  const roseLight = new THREE.PointLight(0xffc48a, 12, 20, 2);
  roseLight.position.set(0, 6.4, APSE + 2.4);
  scene.add(rose, roseLight);

  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.42;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.32, 8), mats.wax);
    candle.position.set(x, 1.3, altarZ + 0.15);
    scene.add(candle);
    addFlame(x, 1.52, altarZ + 0.15, i === 2, 3 + i);
    if (torches[torches.length - 1].light) torches[torches.length - 1].base = 10;
  }

  const moon = new THREE.DirectionalLight(0xc9d6ff, 2.35);
  moon.position.set(-7, 18, 10);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 6;
  moon.shadow.camera.far = 42;
  moon.shadow.camera.left = -9;
  moon.shadow.camera.right = 9;
  moon.shadow.camera.top = 9;
  moon.shadow.camera.bottom = -9;
  moon.shadow.bias = -0.00045;
  moon.shadow.normalBias = 0.035;
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x24304a, 0x3a2a22, 0.46));
  const fill = new THREE.DirectionalLight(0xffc9a0, 0.55);
  fill.position.set(6, 7, -14);
  scene.add(fill);

  const reflector = new Reflector(new THREE.PlaneGeometry(9.7, 9.7), {
    color: 0x8d847a,
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.004,
    multisample: 0,
    shader: shaderWithoutToneMap(),
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = SURFACE_Y - 0.09;
  const renderMirror = reflector.onBeforeRender.bind(reflector);
  let mirrorFrame = 0;
  reflector.onBeforeRender = (renderer, sceneObj, camera, geometry, material, group) => {
    if ((mirrorFrame++ & 1) === 1) return;
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderMirror(renderer, sceneObj, camera, geometry, material, group);
    renderer.shadowMap.enabled = shadows;
  };
  scene.add(reflector);

  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = 1.2 + Math.random() * 8;
    dustPos[i * 3 + 2] = -16 + Math.random() * 30;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, mats.dust);
  scene.add(dust);

  return { torches, shafts, dust, pickRoot };
}

export function animateCathedral(rig: CathedralRig, t: number, dt: number) {
  for (const torch of rig.torches) {
    const n = Math.sin(t * 13 + torch.phase) * 0.5 + Math.sin(t * 23 + torch.phase * 1.7) * 0.3 + Math.sin(t * 41 + torch.phase) * 0.2;
    const k = 0.86 + n * 0.16;
    torch.sprites[0].scale.y = 0.62 * (0.85 + n * 0.22);
    torch.sprites[1].scale.y = 0.32 * (0.8 + n * 0.3);
    if (torch.light) torch.light.intensity = torch.base * k;
  }
  for (let i = 0; i < rig.shafts.length; i++) {
    const mat = rig.shafts[i].material as THREE.MeshBasicMaterial;
    mat.opacity = 0.055 + Math.sin(t * 0.7 + i) * 0.02;
  }
  const attr = rig.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) {
    let y = attr.getY(i) + dt * 0.08;
    if (y > 9.2) y = 1.3;
    attr.setY(i, y);
  }
  attr.needsUpdate = true;
}
