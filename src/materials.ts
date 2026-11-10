import * as THREE from 'three';
import { flameTexture, marbleMap, obsidianMap, paintEnvFace, roughnessNoise, softCircle, shaftTexture } from './textures';

export interface Materials {
  marble: THREE.MeshPhysicalMaterial;
  obsidian: THREE.MeshPhysicalMaterial;
  gold: THREE.MeshPhysicalMaterial;
  groove: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  vault: THREE.MeshStandardMaterial;
  rib: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  wax: THREE.MeshStandardMaterial;
  boardLight: THREE.MeshPhysicalMaterial;
  boardDark: THREE.MeshPhysicalMaterial;
  flame: THREE.SpriteMaterial;
  spark: THREE.SpriteMaterial;
  dust: THREE.PointsMaterial;
  shaft: THREE.CanvasTexture;
}

export function createMaterials(): Materials {
  const rough = roughnessNoise();
  const marble = new THREE.MeshPhysicalMaterial({
    map: marbleMap(),
    color: 0xfffaf4,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
    sheen: 0.55,
    sheenColor: new THREE.Color(0xfff1df),
    sheenRoughness: 0.45,
    envMapIntensity: 0.62,
  });
  const obsidian = new THREE.MeshPhysicalMaterial({
    map: obsidianMap(),
    color: 0x14141c,
    roughness: 0.16,
    metalness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    iridescence: 0.55,
    iridescenceIOR: 1.35,
    iridescenceThicknessMinimum: 140,
    iridescenceThicknessMaximum: 520,
    envMapIntensity: 1.55,
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xd4b06a,
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 1.25,
  });
  const groove = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: 0.72, metalness: 0.05 });
  const stone = new THREE.MeshStandardMaterial({
    color: 0x6a645c,
    roughness: 0.92,
    metalness: 0.04,
    roughnessMap: rough,
    envMapIntensity: 0.22,
  });
  const vault = new THREE.MeshStandardMaterial({
    color: 0x3a3840,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide,
    envMapIntensity: 0.12,
  });
  const rib = new THREE.MeshStandardMaterial({
    color: 0x7d776e,
    roughness: 0.58,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x2c1d14, roughness: 0.82, metalness: 0.05 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.38, metalness: 0.86, envMapIntensity: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x7a1830, roughness: 0.8, metalness: 0.02 });
  const wax = new THREE.MeshStandardMaterial({
    color: 0xf4ead4,
    roughness: 0.55,
    emissive: 0x3a2a16,
    emissiveIntensity: 0.25,
  });
  const boardLight = new THREE.MeshPhysicalMaterial({
    map: marbleMap(),
    color: 0xf3ecdf,
    roughness: 0.46,
    metalness: 0.05,
    clearcoat: 0.28,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.45,
  });
  const boardDark = new THREE.MeshPhysicalMaterial({
    color: 0x3c3632,
    roughness: 0.24,
    metalness: 0.22,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.7,
  });
  const flameMap = flameTexture();
  const flame = new THREE.SpriteMaterial({
    map: flameMap,
    color: 0xffb15a,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const spark = new THREE.SpriteMaterial({
    map: softCircle(),
    color: 0xffe1b0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const dust = new THREE.PointsMaterial({
    color: 0xfff4e2,
    size: 0.035,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  return {
    marble,
    obsidian,
    gold,
    groove,
    stone,
    vault,
    rib,
    wood,
    iron,
    cloth,
    wax,
    boardLight,
    boardDark,
    flame,
    spark,
    dust,
    shaft: shaftTexture(),
  };
}

export function makeEnvironment(renderer: THREE.WebGLRenderer) {
  const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((face) => paintEnvFace(face));
  const cube = new THREE.CubeTexture(faces);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(cube).texture;
  pmrem.dispose();
  cube.dispose();
  return env;
}

export function sharpen(renderer: THREE.WebGLRenderer, mats: Materials) {
  const max = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const value of Object.values(mats)) {
    const mat = value as THREE.MeshStandardMaterial;
    if (mat.map) mat.map.anisotropy = max;
    if (mat.roughnessMap) mat.roughnessMap.anisotropy = max;
    if (mat.emissiveMap) mat.emissiveMap.anisotropy = max;
  }
}
