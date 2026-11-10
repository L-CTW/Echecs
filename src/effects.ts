import * as THREE from 'three';
import { SURFACE_Y } from './layout';
import type { Materials } from './materials';

interface Part {
  obj: THREE.Object3D;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  max: number;
  grav: number;
  bounced: boolean;
  geo?: THREE.BufferGeometry;
  mat?: THREE.Material;
}

export function createFx(scene: THREE.Scene, mats: Materials) {
  const root = new THREE.Group();
  scene.add(root);
  const parts: Part[] = [];
  const sparkMatGold = mats.spark.clone();
  sparkMatGold.color.set(0xffd18a);
  const sparkMatWhite = mats.spark.clone();
  sparkMatWhite.color.set(0xfff6e8);
  const sparkMatBlue = mats.spark.clone();
  sparkMatBlue.color.set(0xd7e4ff);

  function spawnSprite(mat: THREE.SpriteMaterial, pos: THREE.Vector3, speed: number, life: number, grav: number) {
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.userData.base = 0.08 + Math.random() * 0.14;
    sprite.scale.setScalar(sprite.userData.base as number);
    root.add(sprite);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.4, Math.random() - 0.5).normalize();
    parts.push({
      obj: sprite,
      v: dir.multiplyScalar(speed),
      spin: new THREE.Vector3(),
      life,
      max: life,
      grav,
      bounced: true,
    });
  }

  return {
    update(dt: number) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          root.remove(p.obj);
          p.geo?.dispose();
          p.mat?.dispose();
          parts.splice(i, 1);
          continue;
        }
        p.v.y -= p.grav * dt;
        p.obj.position.addScaledVector(p.v, dt);
        if (!p.bounced && p.obj.position.y < SURFACE_Y + 0.03) {
          p.obj.position.y = SURFACE_Y + 0.03;
          p.v.y = Math.abs(p.v.y) * 0.32;
          p.v.x *= 0.65;
          p.v.z *= 0.65;
          p.bounced = true;
        }
        if (p.obj instanceof THREE.Mesh) {
          p.obj.rotation.x += p.spin.x * dt;
          p.obj.rotation.y += p.spin.y * dt;
          p.obj.rotation.z += p.spin.z * dt;
          if (p.obj.userData.swell) {
            const k = 1 - p.life / p.max;
            p.obj.scale.setScalar(1 + k * 3.8);
          }
          if (p.mat && 'opacity' in p.mat) {
            const k = p.life / p.max;
            const fade = p.obj.userData.swell ? k : k > 0.45 ? 1 : k / 0.45;
            (p.mat as THREE.MeshStandardMaterial).opacity = fade;
          }
        } else {
          const k = Math.max(0, p.life / p.max);
          const base = (p.obj.userData.base as number) || 0.12;
          p.obj.scale.setScalar(base * (0.35 + k));
        }
      }
    },
    burst(pos: THREE.Vector3, glass: boolean, calm: boolean) {
      const count = calm ? 10 : glass ? 48 : 36;
      for (let i = 0; i < count; i++) {
        const size = 0.05 + Math.random() * (glass ? 0.14 : 0.11);
        const geo = Math.random() > 0.35
          ? new THREE.TetrahedronGeometry(size, 0)
          : new THREE.BoxGeometry(size * 1.4, size * 0.35, size * 0.8);
        const mat = new THREE.MeshStandardMaterial({
          color: glass ? 0x1a1c28 : 0xf4eee6,
          roughness: glass ? 0.12 : 0.42,
          metalness: glass ? 0.72 : 0.04,
          emissive: glass ? 0x8aa4ff : 0xffc98a,
          emissiveIntensity: glass ? 1.1 : 0.55,
          transparent: true,
          envMapIntensity: 1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y += 0.35 + Math.random() * 0.8;
        mesh.castShadow = false;
        root.add(mesh);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.85 + 0.35, Math.random() - 0.5).normalize();
        const life = 1.15 + Math.random() * 0.7;
        parts.push({
          obj: mesh,
          v: dir.multiplyScalar(glass ? 3.1 + Math.random() * 4.2 : 2.2 + Math.random() * 3.1),
          spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
          life,
          max: life,
          grav: 8.5,
          bounced: false,
          geo,
          mat,
        });
      }
      const sparks = calm ? 8 : glass ? 56 : 28;
      for (let i = 0; i < sparks; i++) {
        const mat = glass ? (i % 3 === 0 ? sparkMatBlue : sparkMatWhite) : sparkMatGold;
        const origin = pos.clone();
        origin.y += 0.5;
        spawnSprite(mat, origin, 1.5 + Math.random() * 4.5, 0.25 + Math.random() * 0.45, 1.2);
      }
      const ringMat = new THREE.MeshBasicMaterial({
        color: glass ? 0xf4f7ff : 0xffe1b0,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.28, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos);
      ring.position.y = SURFACE_Y + 0.025;
      ring.userData.swell = true;
      root.add(ring);
      parts.push({
        obj: ring,
        v: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0.45,
        max: 0.45,
        grav: 0,
        bounced: true,
        geo: ring.geometry,
        mat: ringMat,
      });
    },
  };
}
