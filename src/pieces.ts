import * as THREE from 'three';
import type { Color, PType } from './chess';
import type { Materials } from './materials';

const lathes = new Map<string, THREE.LatheGeometry>();

function lathe(key: string, pts: [number, number][], seg = 28) {
  let geo = lathes.get(key);
  if (!geo) {
    geo = new THREE.LatheGeometry(
      pts.map(([x, y]) => new THREE.Vector2(x, y)),
      seg,
    );
    lathes.set(key, geo);
  }
  return geo;
}

const giltGeo = new THREE.TorusGeometry(0.33, 0.016, 8, 28);
const pickerMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const merlonGeo = new THREE.BoxGeometry(0.12, 0.18, 0.1);
const PICKER_H: Record<PType, number> = { p: 1.22, n: 1.72, b: 1.72, r: 1.52, q: 1.9, k: 2.2 };
const pickerGeos = new Map<PType, THREE.CylinderGeometry>();

function solid(group: THREE.Group, mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function gilt(group: THREE.Group, gold: THREE.Material, y = 0.055) {
  const ring = new THREE.Mesh(giltGeo, gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  solid(group, ring);
}

const PAWN: [number, number][] = [
  [0, 0], [0.36, 0], [0.39, 0.045], [0.34, 0.09], [0.28, 0.125], [0.32, 0.17], [0.24, 0.23],
  [0.15, 0.38], [0.14, 0.6], [0.18, 0.66], [0.12, 0.72], [0.1, 0.78], [0.16, 0.86],
  [0.205, 0.98], [0.18, 1.06], [0.07, 1.11], [0, 1.13],
];
const ROOK: [number, number][] = [
  [0, 0], [0.38, 0], [0.41, 0.05], [0.34, 0.1], [0.3, 0.145], [0.34, 0.2], [0.26, 0.28],
  [0.24, 0.42], [0.25, 0.98], [0.33, 1.08], [0.33, 1.18], [0.2, 1.22], [0, 1.22],
];
const BISHOP: [number, number][] = [
  [0, 0], [0.36, 0], [0.39, 0.05], [0.32, 0.1], [0.28, 0.14], [0.31, 0.19], [0.17, 0.34],
  [0.115, 0.55], [0.11, 0.82], [0.16, 0.92], [0.11, 0.98], [0.14, 1.12], [0.155, 1.28],
  [0.08, 1.42], [0.02, 1.52], [0, 1.56],
];
const QUEEN: [number, number][] = [
  [0, 0], [0.38, 0], [0.41, 0.05], [0.34, 0.1], [0.3, 0.15], [0.34, 0.21], [0.18, 0.36],
  [0.125, 0.58], [0.12, 1.0], [0.17, 1.12], [0.14, 1.2], [0.2, 1.34], [0.16, 1.46], [0, 1.5],
];
const KING: [number, number][] = [
  [0, 0], [0.4, 0], [0.43, 0.055], [0.36, 0.11], [0.32, 0.16], [0.36, 0.22], [0.2, 0.38],
  [0.145, 0.6], [0.14, 1.08], [0.2, 1.2], [0.17, 1.3], [0.22, 1.46], [0.14, 1.58], [0.08, 1.68], [0, 1.72],
];

function knight(group: THREE.Group, mat: THREE.Material, groove: THREE.Material) {
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat);
  chest.scale.set(0.85, 0.7, 1.05);
  chest.position.set(0, 0.62, 0.02);
  solid(group, chest);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.58, 12), mat);
  neck.position.set(0, 0.92, 0.16);
  neck.rotation.x = 0.7;
  solid(group, neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), mat);
  head.scale.set(0.62, 0.78, 1.15);
  head.position.set(0, 1.22, 0.34);
  solid(group, head);

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.34, 12), mat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 1.12, 0.58);
  solid(group, muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat);
  nose.scale.set(0.7, 0.62, 0.9);
  nose.position.set(0, 1.1, 0.74);
  solid(group, nose);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), mat);
  jaw.position.set(0, 1.02, 0.52);
  solid(group, jaw);

  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.1), mat);
  mane.position.set(0, 1.08, 0.02);
  mane.rotation.x = 0.85;
  solid(group, mane);

  const earGeo = new THREE.ConeGeometry(0.035, 0.16, 6);
  const eyeGeo = new THREE.SphereGeometry(0.02, 8, 6);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, mat);
    ear.position.set(side * 0.05, 1.42, 0.3);
    ear.rotation.x = -0.35;
    ear.rotation.z = side * -0.28;
    solid(group, ear);
    const eye = new THREE.Mesh(eyeGeo, groove);
    eye.position.set(side * 0.09, 1.24, 0.48);
    solid(group, eye);
  }
  const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), groove);
  nostril.position.set(0, 1.08, 0.8);
  solid(group, nostril);
}

export function makePiece(type: PType, color: Color, mats: Materials) {
  const mat = color === 'w' ? mats.marble : mats.obsidian;
  const group = new THREE.Group();
  group.userData = { kind: 'piece', file: -1, rank: -1, type, color };
  const body =
    type === 'p' ? PAWN : type === 'r' ? ROOK : type === 'b' ? BISHOP : type === 'q' ? QUEEN : type === 'k' ? KING : null;
  if (body) solid(group, new THREE.Mesh(lathe(type, body), mat));
  gilt(group, mats.gold);
  if (type === 'r') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const merlon = new THREE.Mesh(merlonGeo, mat);
      merlon.position.set(Math.cos(a) * 0.24, 1.3, Math.sin(a) * 0.24);
      merlon.rotation.y = -a;
      solid(group, merlon);
    }
  } else if (type === 'b') {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.34, 0.16), mats.groove);
    slit.position.set(0, 1.22, 0.06);
    solid(group, slit);
    group.rotation.y = color === 'w' ? Math.PI : 0;
  } else if (type === 'n') {
    const plinth = lathe('plinth', [
      [0, 0], [0.38, 0], [0.4, 0.05], [0.34, 0.1], [0.3, 0.15], [0.32, 0.2], [0.22, 0.32], [0.16, 0.42], [0, 0.48],
    ]);
    solid(group, new THREE.Mesh(plinth, mat));
    knight(group, mat, mats.groove);
    group.rotation.y = color === 'w' ? Math.PI : 0;
  } else if (type === 'q') {
    const spikeGeo = new THREE.ConeGeometry(0.03, 0.2, 5);
    const up = new THREE.Vector3(0, 1, 0);
    const aim = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, mats.gold);
      spike.position.set(Math.cos(a) * 0.12, 1.46, Math.sin(a) * 0.12);
      aim.set(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45).normalize();
      spike.quaternion.setFromUnitVectors(up, aim);
      solid(group, spike);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mats.gold);
    ball.position.y = 1.68;
    solid(group, ball);
  } else if (type === 'k') {
    const collar = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mats.gold);
    collar.position.y = 1.78;
    solid(group, collar);
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), mats.gold);
    upright.position.y = 2.0;
    solid(group, upright);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.055), mats.gold);
    arm.position.y = 2.06;
    solid(group, arm);
  }
  let pickerGeo = pickerGeos.get(type);
  if (!pickerGeo) {
    pickerGeo = new THREE.CylinderGeometry(0.36, 0.42, PICKER_H[type], 8);
    pickerGeos.set(type, pickerGeo);
  }
  const picker = new THREE.Mesh(pickerGeo, pickerMat);
  picker.layers.set(1);
  picker.position.y = PICKER_H[type] / 2;
  picker.userData = group.userData;
  group.add(picker);
  return group;
}
