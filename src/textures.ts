import * as THREE from 'three';

export interface GlassPalette {
  bg: string;
  side: string;
  robe: string;
  halo: string;
  light: number;
}

export const GLASS: GlassPalette[] = [
  { bg: '#8d1d38', side: '#1a457c', robe: '#e6d3a4', halo: '#f0d78c', light: 0xff5a78 },
  { bg: '#163e78', side: '#0e5c4e', robe: '#f2efe6', halo: '#f4e2a8', light: 0x6aa2ff },
  { bg: '#0e5a42', side: '#7a1c34', robe: '#e7c56a', halo: '#f6e7c0', light: 0x3dffe0 },
  { bg: '#4c2a6e', side: '#a15c18', robe: '#efe6d4', halo: '#f0d78c', light: 0xd7a0ff },
];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  return { c, g };
}

function tex(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

export function marbleMap() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(${150 + Math.random() * 40}, ${140 + Math.random() * 30}, ${128 + Math.random() * 20}, ${0.18 + Math.random() * 0.28})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      const nx = x + (Math.random() - 0.5) * 220;
      const ny = y + (Math.random() - 0.5) * 90;
      g.quadraticCurveTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, nx, ny);
      x = nx;
      y = ny;
    }
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function obsidianMap() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#07070c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = `rgba(${40 + i * 4}, ${48 + i * 6}, ${80 + i * 8}, 0.35)`;
    g.lineWidth = 2 + Math.random() * 4;
    g.beginPath();
    g.moveTo(Math.random() * 512, Math.random() * 512);
    g.bezierCurveTo(Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512);
    g.stroke();
  }
  return tex(c);
}

export function roughnessNoise() {
  const { c, g } = canvas(256, 256);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 150 + Math.random() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

export function flameTexture() {
  const { c, g } = canvas(128, 128);
  const grd = g.createRadialGradient(64, 78, 4, 64, 70, 60);
  grd.addColorStop(0, 'rgba(255,255,235,1)');
  grd.addColorStop(0.25, 'rgba(255,196,80,0.95)');
  grd.addColorStop(0.55, 'rgba(255,90,20,0.45)');
  grd.addColorStop(1, 'rgba(80,10,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

export function softCircle() {
  const { c, g } = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function shaftTexture() {
  const { c, g } = canvas(128, 512);
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, 'rgba(255,255,255,0.85)');
  v.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 128, 512);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 128, 512);
  return tex(c);
}

export function lancetTexture(p: GlassPalette) {
  const { c, g } = canvas(512, 1024);
  g.fillStyle = p.bg;
  g.fillRect(0, 0, 512, 1024);
  g.fillStyle = p.side;
  g.fillRect(0, 0, 78, 1024);
  g.fillRect(434, 0, 78, 1024);
  g.fillStyle = '#140c0c';
  g.fillRect(78, 0, 16, 1024);
  g.fillRect(418, 0, 16, 1024);
  g.strokeStyle = 'rgba(10,6,6,0.9)';
  g.lineWidth = 7;
  for (let y = 40; y < 1024; y += 96) {
    for (let x = 100; x < 420; x += 96) {
      g.beginPath();
      g.moveTo(x, y + 48);
      g.lineTo(x + 48, y);
      g.lineTo(x + 96, y + 48);
      g.lineTo(x + 48, y + 96);
      g.closePath();
      g.stroke();
    }
  }
  g.fillStyle = p.halo;
  g.beginPath();
  g.arc(256, 300, 86, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = '#140c0c';
  g.stroke();
  g.fillStyle = '#f3e0c4';
  g.beginPath();
  g.arc(256, 332, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.robe;
  g.beginPath();
  g.moveTo(256, 372);
  g.lineTo(168, 900);
  g.quadraticCurveTo(256, 840, 344, 900);
  g.closePath();
  g.fill();
  g.lineWidth = 14;
  g.stroke();
  g.strokeStyle = '#f0d78c';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(256, 430);
  g.lineTo(256, 560);
  g.moveTo(220, 470);
  g.lineTo(292, 470);
  g.stroke();
  return tex(c);
}

export function roseTexture() {
  const { c, g } = canvas(1024, 1024);
  const cx = 512;
  const cy = 512;
  g.fillStyle = '#10080a';
  g.fillRect(0, 0, 1024, 1024);
  const colors = ['#8e1d3a', '#1d4e8f', '#d4b15a', '#1c6a4c', '#6d3c86', '#b86a28', '#8e1d3a', '#204e86'];
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, 470, a0, a1);
    g.closePath();
    g.fillStyle = colors[i % colors.length];
    g.fill();
  }
  g.strokeStyle = '#140c0c';
  g.lineWidth = 18;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
    g.lineTo(cx + Math.cos(a) * 470, cy + Math.sin(a) * 470);
    g.stroke();
  }
  for (const r of [470, 340, 230, 140]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.lineWidth = r > 400 ? 26 : 16;
    g.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 285, cy + Math.sin(a) * 285, 52, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? '#f0d78c' : '#f4efe4';
    g.fill();
    g.lineWidth = 10;
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, 120, 0, Math.PI * 2);
  g.fillStyle = '#e7c56a';
  g.fill();
  g.lineWidth = 16;
  g.stroke();
  g.strokeStyle = '#6e1830';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(cx, cy - 70);
  g.lineTo(cx, cy + 70);
  g.moveTo(cx - 48, cy - 8);
  g.lineTo(cx + 48, cy - 8);
  g.stroke();
  return tex(c);
}

export function labelTexture(text: string, turn = false) {
  const { c, g } = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.translate(64, 64);
  if (turn) g.rotate(Math.PI);
  g.fillStyle = '#f0ddb0';
  g.font = '600 68px Cinzel, Palatino, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 2);
  return tex(c);
}

export function paintEnvFace(face: string) {
  const { c, g } = canvas(128, 128);
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#141822');
  sky.addColorStop(1, '#07060a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 128, 128);
  if (face === 'py') {
    const moon = g.createRadialGradient(78, 46, 2, 78, 46, 28);
    moon.addColorStop(0, 'rgba(232,236,255,0.95)');
    moon.addColorStop(1, 'rgba(232,236,255,0)');
    g.fillStyle = moon;
    g.fillRect(0, 0, 128, 128);
  } else if (face !== 'ny') {
    const spots: [number, number, string][] = [
      [24, 30, 'rgba(180,40,70,0.9)'],
      [70, 48, 'rgba(40,80,180,0.85)'],
      [100, 24, 'rgba(212,170,70,0.8)'],
      [40, 80, 'rgba(30,140,110,0.55)'],
    ];
    for (const [x, y, color] of spots) {
      const glow = g.createRadialGradient(x, y, 2, x, y, 18);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 128, 128);
    }
  } else {
    g.fillStyle = '#1a1410';
    g.fillRect(0, 0, 128, 128);
  }
  return c;
}
