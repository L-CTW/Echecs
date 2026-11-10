import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { searchRoot } from './ai';
import { CathedralAudio } from './audio';
import { animateCathedral, buildCathedral } from './cathedral';
import {
  START_FEN,
  captureSquare,
  fileOf,
  fromFen,
  genLegal,
  inCheck,
  kingSquare,
  make,
  parseSq,
  rankOf,
  repKey,
  result,
  san,
  sq,
  toFen,
  type Color,
  type Move,
  type PType,
  type Result,
} from './chess';
import { createFx } from './effects';
import { SURFACE_Y, xz } from './layout';
import { createMaterials, makeEnvironment, sharpen } from './materials';
import { makePiece } from './pieces';

type LevelId = 'initie' | 'chanoine' | 'eveque';
type ViewName = 'nef' | 'choeur' | 'zenith' | 'transept' | 'crypte';
type Phase = 'splash' | 'intro' | 'player' | 'anim' | 'hold' | 'ai' | 'await-ai' | 'promo' | 'over';

interface Settings {
  sound: boolean;
  level: LevelId;
  side: Color;
}

interface PieceView {
  group: THREE.Group;
  type: PType;
  color: Color;
  square: number;
  lift: number;
  animating: boolean;
}

interface Tween {
  t: number;
  dur: number;
  tick: (k: number) => void;
  done: () => void;
}

interface AiReply {
  id: number;
  from: number;
  to: number;
  promo: PType | null;
}

const LEVELS: Record<LevelId, { maxDepth: number; ms: number; noise: number }> = {
  initie: { maxDepth: 2, ms: 320, noise: 55 },
  chanoine: { maxDepth: 3, ms: 800, noise: 16 },
  eveque: { maxDepth: 4, ms: 1500, noise: 5 },
};

const VIEWS: Record<ViewName, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  nef: { pos: [0.15, 8.55, 12.15], look: [0, 0.7, -1.5], fov: 36 },
  choeur: { pos: [0.1, 8.45, -11.35], look: [0, 0.65, 0.6], fov: 36 },
  zenith: { pos: [0.2, 16.2, 10.4], look: [0, 0.2, -0.35], fov: 38 },
  transept: { pos: [10.55, 4.7, 5.1], look: [0, 1.25, -1.2], fov: 42 },
  crypte: { pos: [0.25, 2.2, 9.7], look: [0, 1.4, -0.2], fov: 43 },
};

const PITCH: Record<PType, number> = { p: 520, n: 340, b: 360, r: 240, q: 180, k: 130 };
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const enterBtn = document.querySelector('#enter') as HTMLButtonElement;
const bootEl = document.querySelector('#boot') as HTMLParagraphElement;
const statusMain = document.querySelector('#statusMain') as HTMLParagraphElement;
const statusSub = document.querySelector('#statusSub') as HTMLParagraphElement;
const hint = document.querySelector('#hint') as HTMLParagraphElement;
const soundBtn = document.querySelector('#soundBtn') as HTMLButtonElement;
const menuBtn = document.querySelector('#menuBtn') as HTMLButtonElement;
const menu = document.querySelector('#menu') as HTMLElement;
const backdrop = document.querySelector('#backdrop') as HTMLElement;
const movesEl = document.querySelector('#moves') as HTMLElement;
const undoBtn = document.querySelector('#undo') as HTMLButtonElement;
const resignBtn = document.querySelector('#resign') as HTMLButtonElement;
const promoEl = document.querySelector('#promo') as HTMLElement;
const endEl = document.querySelector('#end') as HTMLElement;
const endKicker = document.querySelector('#endKicker') as HTMLElement;
const endTitle = document.querySelector('#endTitle') as HTMLElement;
const endDetail = document.querySelector('#endDetail') as HTMLElement;
const flashEl = document.querySelector('#flash') as HTMLElement;

const settings = loadSettings();
const audio = new CathedralAudio();
audio.setMuted(!settings.sound);

let phase: Phase = 'splash';
let player: Color = settings.side;
let pos = fromFen(START_FEN);
let fens = [START_FEN];
let sans: string[] = [];
let rep = new Map<string, number>([[repKey(pos), 1]]);
let legal: Move[] = [];
let selected = -1;
let lastFrom = -1;
let lastTo = -1;
let turnToken = 0;
let aiId = 0;
let aiStarted = 0;
let aiTimer = 0;
let aiReady = false;
let pending: Move | null = null;
let servedAi = -1;
let promoMoves: Move[] = [];
let selectedView: ViewName = 'nef';
let camLerp = 0.8;
let camToken = 0;
let shakeAmp = 0;
const tweens: Tween[] = [];
const views = new Map<number, PieceView>();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x09080d);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09080d);
scene.fog = new THREE.FogExp2(0x09080d, 0.0155);
scene.environment = makeEnvironment(renderer);
scene.environmentIntensity = 0.78;

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 140);
const camPos = new THREE.Vector3(0, 7.7, 14.5);
const look = new THREE.Vector3(0, 3.1, -6);
const desiredPos = camPos.clone();
const desiredLook = look.clone();
let desiredFov = 48;
camera.position.copy(camPos);
camera.lookAt(look);

const mats = createMaterials();
sharpen(renderer, mats);
const rig = buildCathedral(scene, mats);
const pieceRoot = new THREE.Group();
scene.add(pieceRoot);
const fx = createFx(scene, mats);
const markerRoot = new THREE.Group();
const highlightRoot = new THREE.Group();
scene.add(markerRoot, highlightRoot);

const quietMat = new THREE.MeshBasicMaterial({
  color: 0xe6c98a,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
  toneMapped: false,
});
const capMat = new THREE.MeshBasicMaterial({
  color: 0xd25a4a,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  toneMapped: false,
});
const quietGeo = new THREE.TorusGeometry(0.28, 0.045, 10, 36);
const capGeo = new THREE.TorusGeometry(0.46, 0.03, 8, 32);
quietGeo.rotateX(Math.PI / 2);
capGeo.rotateX(Math.PI / 2);

function makeHighlight(color: number) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  highlightRoot.add(mesh);
  return mesh;
}
const lastA = makeHighlight(0xe6c36a);
const lastB = makeHighlight(0xe6c36a);
const selH = makeHighlight(0xffe6b0);
const checkH = makeHighlight(0xd13a3a);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.48, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const raycaster = new THREE.Raycaster();
raycaster.layers.enableAll();
const pointer = new THREE.Vector2();

let worker: Worker | null = null;
try {
  worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<AiReply>) => onAi(event.data);
} catch (error) {
  console.warn(error);
  worker = null;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('nocturne');
    if (!raw) return { sound: true, level: 'chanoine', side: 'w' };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: parsed.sound !== false,
      level: parsed.level === 'initie' || parsed.level === 'eveque' ? parsed.level : 'chanoine',
      side: parsed.side === 'b' ? 'b' : 'w',
    };
  } catch {
    return { sound: true, level: 'chanoine', side: 'w' };
  }
}

function saveSettings() {
  try {
    localStorage.setItem('nocturne', JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

function squareVector(s: number) {
  const [x, z] = xz(fileOf(s), rankOf(s));
  return new THREE.Vector3(x, SURFACE_Y + 0.012, z);
}

function spawn(square: number, type: PType, color: Color) {
  const group = makePiece(type, color, mats);
  const at = squareVector(square);
  group.position.copy(at);
  group.userData.file = fileOf(square);
  group.userData.rank = rankOf(square);
  pieceRoot.add(group);
  views.set(square, { group, type, color, square, lift: 0, animating: false });
}

function rebuildPieces() {
  for (const view of views.values()) pieceRoot.remove(view.group);
  views.clear();
  for (let s = 0; s < 64; s++) {
    const piece = pos.board[s];
    if (piece) spawn(s, piece.t, piece.c);
  }
}

function rebuildRep() {
  rep = new Map();
  for (const fen of fens) {
    const key = fen.split(' ').slice(0, 4).join(' ');
    rep.set(key, (rep.get(key) ?? 0) + 1);
  }
}

function refreshLegal() {
  legal = genLegal(pos);
}

function turnOf(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

function materialDelta() {
  const val: Record<PType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const piece of pos.board) if (piece) score += (piece.c === 'w' ? 1 : -1) * val[piece.t];
  return player === 'w' ? score : -score;
}

function levelName() {
  return settings.level === 'initie' ? 'Initié' : settings.level === 'eveque' ? 'Évêque' : 'Chanoine';
}

function updateStatus() {
  const delta = materialDelta();
  statusSub.textContent = `${levelName()}${delta === 0 ? '' : ` · ${delta > 0 ? '+' : ''}${delta}`}`;
  if (phase === 'splash') {
    statusMain.textContent = 'La nef s’ouvre';
    return;
  }
  if (phase === 'intro') {
    statusMain.textContent = 'Entrez';
    return;
  }
  if (phase === 'ai' || phase === 'await-ai') {
    statusMain.textContent = pos.turn === 'b' ? 'L’obsidienne médite…' : 'Le marbre médite…';
    return;
  }
  if (phase === 'over') return;
  const check = inCheck(pos, pos.turn);
  if (phase === 'anim' || phase === 'hold') {
    statusMain.textContent = sans[sans.length - 1] ?? '';
    return;
  }
  if (pos.turn === player) statusMain.textContent = check ? 'À vous — échec' : 'À vous de jouer';
  else statusMain.textContent = pos.turn === 'b' ? 'L’obsidienne joue' : 'Les marbres jouent';
  syncButtons();
}

function syncButtons() {
  const answered = fens.length >= 3 && turnOf(fens[fens.length - 1]) === player && turnOf(fens[fens.length - 2]) !== player;
  const retract = fens.length > 1 && turnOf(fens[fens.length - 1]) !== player;
  const locked = phase === 'anim' || phase === 'hold' || phase === 'splash' || phase === 'intro' || phase === 'promo';
  undoBtn.disabled = locked || (!answered && !retract);
  resignBtn.disabled = phase === 'over' || phase === 'splash' || phase === 'intro';
  soundBtn.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.view === selectedView);
  });
  (document.querySelector('#sideW') as HTMLButtonElement).classList.toggle('on', player === 'w');
  (document.querySelector('#sideB') as HTMLButtonElement).classList.toggle('on', player === 'b');
  (document.querySelector('#lvInitie') as HTMLButtonElement).classList.toggle('on', settings.level === 'initie');
  (document.querySelector('#lvChanoine') as HTMLButtonElement).classList.toggle('on', settings.level === 'chanoine');
  (document.querySelector('#lvEveque') as HTMLButtonElement).classList.toggle('on', settings.level === 'eveque');
}

function renderMoves() {
  movesEl.replaceChildren();
  for (let i = 0; i < sans.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const n = document.createElement('span');
    n.textContent = `${i / 2 + 1}.`;
    const w = document.createElement('span');
    w.textContent = sans[i] ?? '';
    const b = document.createElement('span');
    b.textContent = sans[i + 1] ?? '';
    row.append(n, w, b);
    movesEl.append(row);
  }
}

function placeHighlight(mesh: THREE.Mesh, square: number, y = SURFACE_Y + 0.02) {
  const [x, z] = xz(fileOf(square), rankOf(square));
  mesh.position.set(x, y, z);
  mesh.visible = true;
}

function layoutHighlights() {
  if (lastFrom >= 0) placeHighlight(lastA, lastFrom);
  else lastA.visible = false;
  if (lastTo >= 0) placeHighlight(lastB, lastTo, SURFACE_Y + 0.024);
  else lastB.visible = false;
  if (selected >= 0) placeHighlight(selH, selected, SURFACE_Y + 0.028);
  else selH.visible = false;
  const showCheck = phase !== 'splash' && phase !== 'intro' && inCheck(pos, pos.turn);
  if (showCheck) placeHighlight(checkH, kingSquare(pos, pos.turn), SURFACE_Y + 0.032);
  else checkH.visible = false;
}

function clearMarkers() {
  markerRoot.clear();
}

function showMoves() {
  clearMarkers();
  const seen = new Set<number>();
  for (const move of legal) {
    if (move.from !== selected || seen.has(move.to)) continue;
    seen.add(move.to);
    const capture = captureSquare(pos, move) != null;
    const mesh = new THREE.Mesh(capture ? capGeo : quietGeo, capture ? capMat : quietMat);
    const at = squareVector(move.to);
    mesh.position.set(at.x, SURFACE_Y + 0.06, at.z);
    markerRoot.add(mesh);
  }
}

function clearSelection() {
  selected = -1;
  clearMarkers();
  layoutHighlights();
}

function applyView(name: ViewName, speed: number) {
  const view = VIEWS[name];
  desiredPos.set(view.pos[0], view.pos[1], view.pos[2]);
  desiredLook.set(view.look[0], view.look[1], view.look[2]);
  desiredFov = view.fov;
  camLerp = speed;
}

function setView(name: ViewName, speed = 2.6) {
  selectedView = name;
  camToken++;
  applyView(name, speed);
  syncButtons();
}

function punchCamera(world: THREE.Vector3) {
  const token = ++camToken;
  const flat = new THREE.Vector3().subVectors(camPos, world);
  flat.y = 0;
  if (flat.lengthSq() < 0.04) flat.set(0, 0, 1);
  flat.normalize().multiplyScalar(2.35);
  desiredPos.copy(world).add(flat);
  desiredPos.y = world.y + 1.7;
  desiredLook.copy(world);
  desiredLook.y += 0.55;
  desiredFov = 24;
  camLerp = 8;
  shakeAmp = 0.34;
  window.setTimeout(() => {
    if (camToken === token) applyView(selectedView, 1.7);
  }, calm ? 180 : 1900);
}

function replacePiece(view: PieceView, type: PType) {
  const at = view.group.position.clone();
  const file = view.group.userData.file as number;
  const rank = view.group.userData.rank as number;
  pieceRoot.remove(view.group);
  const group = makePiece(type, view.color, mats);
  group.position.copy(at);
  group.userData.file = file;
  group.userData.rank = rank;
  pieceRoot.add(group);
  view.group = group;
  view.type = type;
}

function tweenTo(view: PieceView, end: THREE.Vector3, dur: number, arc: number, done: () => void) {
  const start = view.group.position.clone();
  tweens.push({
    t: 0,
    dur,
    tick(k) {
      view.group.position.set(
        THREE.MathUtils.lerp(start.x, end.x, k),
        THREE.MathUtils.lerp(start.y, end.y, k) + Math.sin(k * Math.PI) * arc,
        THREE.MathUtils.lerp(start.z, end.z, k),
      );
    },
    done() {
      view.group.position.copy(end);
      done();
    },
  });
}

function updateTweens(dt: number) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tween = tweens[i];
    tween.t += dt;
    const k = Math.min(1, tween.t / tween.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    tween.tick(e);
    if (k >= 1) {
      tween.done();
      tweens.splice(i, 1);
    }
  }
}

function flash() {
  flashEl.classList.remove('show');
  void flashEl.offsetWidth;
  flashEl.classList.add('show');
}

function showEnd(res: Result, custom?: { kicker: string; title: string; detail: string }) {
  phase = 'over';
  if (!custom && res.type === 'mate') {
    endKicker.textContent = res.winner === player ? 'Victoire' : 'Défaite';
    endTitle.textContent = 'Échec et mat';
    endDetail.textContent = res.winner === 'w' ? 'Les marbres l’emportent.' : 'L’obsidienne l’emporte.';
  } else if (!custom && res.type === 'draw') {
    const detail = {
      stalemate: 'Pat. Personne ne cède.',
      fifty: 'Cinquante coups sans prise ni pion.',
      threefold: 'La même position, trois fois.',
      insufficient: 'Plus assez de pièces pour un mat.',
    }[res.reason];
    endKicker.textContent = 'Partie nulle';
    endTitle.textContent = 'Nul';
    endDetail.textContent = detail;
  } else if (custom) {
    endKicker.textContent = custom.kicker;
    endTitle.textContent = custom.title;
    endDetail.textContent = custom.detail;
  }
  endEl.hidden = false;
  statusMain.textContent = endTitle.textContent;
  if (!calm) {
    camToken++;
    desiredPos.set(0, 9.1, 14.4);
    desiredLook.set(0, 2.4, -4);
    desiredFov = 50;
    camLerp = 0.42;
  }
  syncButtons();
}

function commitMove(move: Move, byPlayer: boolean) {
  const capSq = captureSquare(pos, move);
  const notation = san(pos, move, genLegal(pos));
  const mover = views.get(move.from);
  if (!mover) return;
  const victim = capSq != null ? views.get(capSq) ?? null : null;
  const castle = mover.type === 'k' && Math.abs(fileOf(move.to) - fileOf(move.from)) === 2;
  let rook: PieceView | null = null;
  let rookTo = -1;
  if (castle) {
    const rank = rankOf(move.from);
    const rookFrom = fileOf(move.to) === 6 ? sq(7, rank) : sq(0, rank);
    rookTo = fileOf(move.to) === 6 ? sq(5, rank) : sq(3, rank);
    rook = views.get(rookFrom) ?? null;
  }
  make(pos, move);
  fens.push(toFen(pos));
  sans.push(notation);
  rebuildRep();
  views.delete(move.from);
  if (capSq != null) views.delete(capSq);
  views.set(move.to, mover);
  mover.square = move.to;
  mover.group.userData.file = fileOf(move.to);
  mover.group.userData.rank = rankOf(move.to);
  if (rook && rookTo >= 0) {
    views.delete(rook.square);
    views.set(rookTo, rook);
    rook.square = rookTo;
    rook.group.userData.file = fileOf(rookTo);
    rook.group.userData.rank = rankOf(rookTo);
  }
  lastFrom = move.from;
  lastTo = move.to;
  selected = -1;
  clearMarkers();
  layoutHighlights();
  renderMoves();
  hint.hidden = true;
  phase = 'anim';
  const token = ++turnToken;
  const outcome = result(pos, rep);
  if (byPlayer && pos.turn !== player && outcome.type === 'ongoing') requestAI();
  mover.animating = true;
  if (rook) rook.animating = true;
  const end = squareVector(move.to);
  const dist = mover.group.position.distanceTo(end);
  const dur = (calm ? 0.16 : Math.min(0.62, 0.22 + dist * 0.065)) + (victim && !calm ? 0.08 : 0);
  let arrived = 0;
  const need = rook ? 2 : 1;
  const arrivedAll = () => {
    if (token !== turnToken) return;
    if (++arrived < need) return;
    mover.animating = false;
    mover.lift = 0;
    if (rook) {
      rook.animating = false;
      rook.lift = 0;
    }
    if (move.promo) replacePiece(mover, move.promo);
    if (victim) {
      const at = victim.group.position.clone();
      pieceRoot.remove(victim.group);
      fx.burst(at, victim.color === 'b', calm);
      if (!calm) {
        punchCamera(at);
        flash();
      }
      audio.shatter(victim.color === 'b');
    } else audio.move(PITCH[mover.type]);
    if (outcome.type === 'mate') audio.finale(outcome.winner === player);
    else if (inCheck(pos, pos.turn)) audio.check();
    layoutHighlights();
    updateStatus();
    window.setTimeout(() => {
      if (token !== turnToken) return;
      if (outcome.type !== 'ongoing') {
        showEnd(outcome);
        return;
      }
      if (pos.turn === player) {
        phase = 'player';
        refreshLegal();
        updateStatus();
      } else if (aiReady) playPending();
      else phase = 'await-ai';
      syncButtons();
    }, victim && !calm ? 980 : 70);
  };
  tweenTo(mover, end, dur, victim ? 0.78 : 0.36, arrivedAll);
  if (rook && rookTo >= 0) tweenTo(rook, squareVector(rookTo), dur, 0.22, arrivedAll);
  updateStatus();
}

function requestAI() {
  const id = ++aiId;
  aiReady = false;
  pending = null;
  aiStarted = performance.now();
  const level = LEVELS[settings.level];
  window.clearTimeout(aiTimer);
  phase = phase === 'anim' ? phase : 'ai';
  aiTimer = window.setTimeout(() => deliverAi(id, null), level.ms + 4500);
  if (worker) worker.postMessage({ id, fen: toFen(pos), ...level });
  else window.setTimeout(() => deliverAi(id, searchRoot(fromFen(toFen(pos)), level)), 30);
  updateStatus();
}

function onAi(data: AiReply) {
  if (data.id !== aiId) return;
  window.clearTimeout(aiTimer);
  const wait = Math.max(0, 380 - (performance.now() - aiStarted));
  window.setTimeout(() => {
    if (data.id !== aiId) return;
    const found = genLegal(pos).find((move) => move.from === data.from && move.to === data.to && (move.promo ?? null) === (data.promo ?? null));
    deliverAi(data.id, found ?? null);
  }, wait);
}

function deliverAi(id: number, move: Move | null) {
  if (id !== aiId || servedAi === id) return;
  servedAi = id;
  window.clearTimeout(aiTimer);
  const options = genLegal(pos);
  pending = move ?? options[Math.floor(Math.random() * options.length)] ?? null;
  aiReady = pending != null;
  if (phase === 'await-ai' || phase === 'ai') playPending();
}

function playPending() {
  if (!pending) {
    phase = 'player';
    return;
  }
  const move = pending;
  pending = null;
  aiReady = false;
  commitMove(move, false);
}

function handleSquare(file: number, rank: number) {
  const target = sq(file, rank);
  if (selected >= 0) {
    const options = legal.filter((move) => move.from === selected && move.to === target);
    if (options.length > 1 && options.every((move) => move.promo)) {
      promoMoves = options;
      phase = 'promo';
      promoEl.hidden = false;
      return;
    }
    if (options.length === 1) {
      audio.select();
      commitMove(options[0], true);
      return;
    }
  }
  const piece = pos.board[target];
  if (piece && piece.c === player && pos.turn === player) {
    selected = target;
    audio.select();
    showMoves();
    layoutHighlights();
    return;
  }
  if (selected >= 0) audio.reject();
  clearSelection();
}

function hitSquare(hit: THREE.Intersection): number {
  let obj: THREE.Object3D | null = hit.object;
  while (obj) {
    const data = obj.userData as { file?: number; rank?: number };
    if (typeof data.file === 'number' && data.file >= 0 && typeof data.rank === 'number') return sq(data.file, data.rank);
    obj = obj.parent;
  }
  return -1;
}

function pick(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const pieceHits = raycaster.intersectObject(pieceRoot, true);
  const squareHits = raycaster.intersectObject(rig.pickRoot, true);
  const plane = squareHits.map(hitSquare).find((s) => s >= 0) ?? -1;
  if (selected >= 0 && plane >= 0 && legal.some((move) => move.from === selected && move.to === plane)) {
    handleSquare(fileOf(plane), rankOf(plane));
    return;
  }
  const piece = pieceHits.map(hitSquare).find((s) => s >= 0) ?? -1;
  if (piece >= 0) {
    handleSquare(fileOf(piece), rankOf(piece));
    return;
  }
  if (plane >= 0) handleSquare(fileOf(plane), rankOf(plane));
  else clearSelection();
}

function undo() {
  const answered = fens.length >= 3 && turnOf(fens[fens.length - 1]) === player && turnOf(fens[fens.length - 2]) !== player;
  const retract = fens.length > 1 && turnOf(fens[fens.length - 1]) !== player;
  if (phase === 'anim' || phase === 'hold' || phase === 'splash' || phase === 'intro' || phase === 'promo') return;
  if (!answered && !retract) return;
  aiId++;
  turnToken++;
  window.clearTimeout(aiTimer);
  tweens.length = 0;
  pending = null;
  aiReady = false;
  if (retract) {
    fens.pop();
    sans.pop();
  } else {
    fens.pop();
    sans.pop();
    fens.pop();
    sans.pop();
  }
  pos = fromFen(fens[fens.length - 1]);
  rebuildRep();
  rebuildPieces();
  refreshLegal();
  selected = -1;
  clearMarkers();
  lastFrom = fens.length > 1 ? -1 : -1;
  lastTo = -1;
  phase = 'player';
  endEl.hidden = true;
  layoutHighlights();
  renderMoves();
  updateStatus();
}

function newGame(side = player) {
  player = side;
  settings.side = side;
  saveSettings();
  aiId++;
  turnToken++;
  window.clearTimeout(aiTimer);
  tweens.length = 0;
  pending = null;
  aiReady = false;
  pos = fromFen(START_FEN);
  fens = [START_FEN];
  sans = [];
  rebuildRep();
  rebuildPieces();
  refreshLegal();
  selected = -1;
  lastFrom = -1;
  lastTo = -1;
  clearMarkers();
  promoEl.hidden = true;
  endEl.hidden = true;
  hint.hidden = false;
  closeMenu();
  layoutHighlights();
  renderMoves();
  setView(player === 'w' ? 'nef' : 'choeur', 1.4);
  if (pos.turn !== player) requestAI();
  else phase = 'player';
  updateStatus();
}

function finishIntro() {
  if (phase !== 'intro') return;
  camLerp = 2.8;
  if (pos.turn !== player) requestAI();
  else {
    phase = 'player';
    updateStatus();
  }
}

function enter() {
  if (phase !== 'splash') return;
  audio.unlock();
  audio.setMuted(!settings.sound);
  audio.enter();
  document.body.classList.add('playing');
  player = settings.side;
  phase = 'intro';
  setView(player === 'w' ? 'nef' : 'choeur', calm ? 2.4 : 0.58);
  window.setTimeout(() => finishIntro(), calm ? 500 : 4200);
  updateStatus();
}

function openMenu() {
  menu.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => document.body.classList.add('menu-open'));
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  window.setTimeout(() => {
    if (!document.body.classList.contains('menu-open')) {
      menu.hidden = true;
      backdrop.hidden = true;
    }
  }, 360);
}

function frameCamera(dt: number, t: number) {
  if (phase === 'splash') {
    const a = t * 0.08;
    desiredPos.set(Math.sin(a) * 1.5, 7.55 + Math.sin(a * 0.6) * 0.22, 14.5);
    desiredLook.set(0, 3.05, -6);
    desiredFov = 48;
    camLerp = 0.65;
  }
  const k = 1 - Math.exp(-camLerp * dt);
  camPos.lerp(desiredPos, k);
  look.lerp(desiredLook, k);
  if (Math.abs(camera.fov - desiredFov) > 0.02) {
    camera.fov += (desiredFov - camera.fov) * k;
    camera.updateProjectionMatrix();
  }
  const sway = phase === 'player' && camPos.distanceTo(desiredPos) < 0.2 && shakeAmp < 0.02;
  camera.position.copy(camPos);
  camera.position.x += (sway ? Math.sin(t * 0.45) * 0.05 : 0) + (Math.random() - 0.5) * shakeAmp;
  camera.position.y += (sway ? Math.sin(t * 0.31) * 0.03 : 0) + (Math.random() - 0.5) * shakeAmp;
  camera.lookAt(look);
  shakeAmp *= Math.exp(-3.2 * dt);
}

function updateLifts(dt: number, t: number) {
  const gain = 1 - Math.exp(-10 * dt);
  for (const view of views.values()) {
    if (view.animating) continue;
    const target = view.square === selected ? 0.16 + Math.sin(t * 3) * 0.02 : 0;
    view.lift += (target - view.lift) * gain;
    const at = squareVector(view.square);
    view.group.position.set(at.x, at.y + view.lift, at.z);
  }
}

function pulse(t: number) {
  quietMat.opacity = 0.78 + Math.sin(t * 3.1) * 0.18;
  capMat.opacity = 0.62 + Math.sin(t * 3.4) * 0.2;
  if (checkH.visible) (checkH.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(t * 5) * 0.16;
}

let downX = 0;
let downY = 0;
canvas.addEventListener('pointerdown', (event) => {
  downX = event.clientX;
  downY = event.clientY;
});
canvas.addEventListener('pointerup', (event) => {
  if (phase === 'intro') {
    finishIntro();
    const view = VIEWS[selectedView];
    camPos.set(view.pos[0], view.pos[1], view.pos[2]);
    look.set(view.look[0], view.look[1], view.look[2]);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    camLerp = 2.8;
    return;
  }
  if (phase !== 'player') return;
  const dx = event.clientX - downX;
  const dy = event.clientY - downY;
  if (dx * dx + dy * dy > 20 * 20) return;
  pick(event.clientX, event.clientY);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || phase !== 'player') {
    canvas.style.cursor = '';
    return;
  }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([pieceRoot, rig.pickRoot], true);
  canvas.style.cursor = hits.length ? 'pointer' : '';
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

enterBtn.addEventListener('click', enter);
soundBtn.addEventListener('click', () => {
  settings.sound = !settings.sound;
  if (settings.sound) audio.unlock();
  audio.setMuted(!settings.sound);
  saveSettings();
  syncButtons();
});
menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
(document.querySelector('#menuClose') as HTMLButtonElement).addEventListener('click', closeMenu);
backdrop.addEventListener('click', closeMenu);
(document.querySelector('#newGame') as HTMLButtonElement).addEventListener('click', () => newGame(player));
(document.querySelector('#sideW') as HTMLButtonElement).addEventListener('click', () => newGame('w'));
(document.querySelector('#sideB') as HTMLButtonElement).addEventListener('click', () => newGame('b'));
(document.querySelector('#lvInitie') as HTMLButtonElement).addEventListener('click', () => {
  settings.level = 'initie';
  saveSettings();
  syncButtons();
  updateStatus();
});
(document.querySelector('#lvChanoine') as HTMLButtonElement).addEventListener('click', () => {
  settings.level = 'chanoine';
  saveSettings();
  syncButtons();
  updateStatus();
});
(document.querySelector('#lvEveque') as HTMLButtonElement).addEventListener('click', () => {
  settings.level = 'eveque';
  saveSettings();
  syncButtons();
  updateStatus();
});
undoBtn.addEventListener('click', undo);
resignBtn.addEventListener('click', () => {
  closeMenu();
  aiId++;
  turnToken++;
  showEnd({ type: 'ongoing' }, { kicker: 'Abandon', title: 'La nef se tait', detail: 'Vous cédez la partie.' });
});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view as ViewName));
});
document.querySelectorAll<HTMLButtonElement>('[data-promo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.promo as PType;
    const move = promoMoves.find((item) => item.promo === type);
    promoEl.hidden = true;
    promoMoves = [];
    if (move) commitMove(move, true);
    else phase = 'player';
  });
});
(document.querySelector('#promoCancel') as HTMLButtonElement).addEventListener('click', () => {
  promoEl.hidden = true;
  promoMoves = [];
  phase = 'player';
});
(document.querySelector('#endAgain') as HTMLButtonElement).addEventListener('click', () => newGame(player));

window.addEventListener('keydown', (event) => {
  const viewsKeys: Record<string, ViewName> = { '1': 'nef', '2': 'choeur', '3': 'zenith', '4': 'transept', '5': 'crypte' };
  if (viewsKeys[event.key]) setView(viewsKeys[event.key]);
  if (event.key === 'z' || event.key === 'Z') undo();
  if (event.key === 'Escape') {
    closeMenu();
    promoEl.hidden = true;
  }
});

let last = performance.now();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') last = performance.now();
});

rebuildPieces();
refreshLegal();
layoutHighlights();
syncButtons();
updateStatus();
(document.querySelector('#sideW') as HTMLButtonElement).classList.toggle('on', settings.side === 'w');
(document.querySelector('#sideB') as HTMLButtonElement).classList.toggle('on', settings.side === 'b');

let frames = 0;
let acc = 0;
let loggedFps = false;

function loop(now: number) {
  requestAnimationFrame(loop);
  if (document.visibilityState === 'hidden') return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  frames++;
  acc += dt;
  if (!loggedFps && acc > 2.4) {
    console.log('FPS', (frames / acc).toFixed(1));
    loggedFps = true;
  }
  updateTweens(dt);
  updateLifts(dt, t);
  fx.update(dt);
  animateCathedral(rig, t, dt);
  audio.update(dt);
  frameCamera(dt, t);
  pulse(t);
  composer.render();
}

requestAnimationFrame(loop);
canvas.classList.add('ready');
enterBtn.disabled = false;
bootEl.textContent = 'Touchez pour écouter la nef.';

const api = {
  ready: () => !enterBtn.disabled,
  enter,
  fen: () => toFen(pos),
  phase: () => phase,
  status: () => statusMain.textContent,
  camera: (name: ViewName) => setView(name),
  project(square: string, lift = 0) {
    const s = parseSq(square);
    const v = squareVector(s);
    v.y += lift;
    v.project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * rect.width + rect.left, y: (-v.y * 0.5 + 0.5) * rect.height + rect.top };
  },
  probe(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const pieceHits = raycaster.intersectObject(pieceRoot, true);
    const squareHits = raycaster.intersectObject(rig.pickRoot, true);
    const describe = (hit: THREE.Intersection) => {
      let file = -1;
      let rank = -1;
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (typeof obj.userData.file === 'number') {
          file = obj.userData.file as number;
          rank = obj.userData.rank as number;
          break;
        }
        obj = obj.parent;
      }
      return { file, rank, y: +hit.point.y.toFixed(2), layer: hit.object.layers.mask };
    };
    return { pieces: pieceHits.slice(0, 3).map(describe), squares: squareHits.slice(0, 2).map(describe) };
  },
  loadFen(fen: string) {
    aiId++;
    turnToken++;
    pos = fromFen(fen);
    fens = [toFen(pos)];
    sans = [];
    rebuildRep();
    rebuildPieces();
    refreshLegal();
    selected = -1;
    clearMarkers();
    lastFrom = -1;
    lastTo = -1;
    endEl.hidden = true;
    promoEl.hidden = true;
    document.body.classList.add('playing');
    phase = pos.turn === player ? 'player' : 'ai';
    layoutHighlights();
    renderMoves();
    updateStatus();
    if (phase === 'ai') requestAI();
  },
  move(from: string, to: string, promo?: PType) {
    const options = genLegal(pos).filter((move) => move.from === parseSq(from) && move.to === parseSq(to));
    const chosen = options.find((move) => (promo ? move.promo === promo : !move.promo))
      ?? options.find((move) => move.promo === 'q')
      ?? options[0];
    if (!chosen) return false;
    if (phase === 'splash' || phase === 'intro') {
      document.body.classList.add('playing');
      phase = 'player';
    }
    commitMove(chosen, true);
    return true;
  },
};
(window as unknown as { __nocturne: typeof api }).__nocturne = api;
