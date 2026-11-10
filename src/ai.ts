import {
  fileOf,
  genLegal,
  inCheck,
  make,
  rankOf,
  unmake,
  type Move,
  type Piece,
  type Position,
  type PType,
} from './chess';

const VAL: Record<PType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PHASE: Record<PType, number> = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };

// Piece-square tables, index 0 = a1, from the piece's own side.
const P = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, -20, -20, 10, 10, 5,
  5, -5, -10, 0, 0, -10, -5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, 5, 10, 25, 25, 10, 5, 5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  10, 10, 10, 10, 10, 10, 10, 10,
  10, 10, 10, 10, 10, 10, 10, 10,
  20, 20, 20, 20, 20, 20, 20, 20,
  30, 30, 30, 30, 30, 30, 30, 30,
  50, 50, 50, 50, 50, 50, 50, 50,
  80, 80, 80, 80, 80, 80, 80, 80,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const N = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
const B = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
const R = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];
const Q = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
const KM = [
  20, 30, 10, 0, 0, 10, 30, 20,
  20, 20, 0, 0, 0, 0, 20, 20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
];
const KE = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

const MG: Record<PType, number[]> = { p: P, n: N, b: B, r: R, q: Q, k: KM };
const EG: Record<PType, number[]> = { p: PE, n: N, b: B, r: R, q: Q, k: KE };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const rng = mulberry32(0xc0ffee);
const rand64 = () => (BigInt(rng()) << 32n) | BigInt(rng());
const Z: bigint[][] = Array.from({ length: 12 }, () => Array.from({ length: 64 }, rand64));
const ZT = rand64();
const ZC = Array.from({ length: 16 }, rand64);
const ZE = Array.from({ length: 64 }, rand64);

function pIndex(p: Piece): number {
  return (p.c === 'w' ? 0 : 6) + 'pnbrqk'.indexOf(p.t);
}

export function hashPos(pos: Position): bigint {
  let h = 0n;
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (p) h ^= Z[pIndex(p)][s];
  }
  if (pos.turn === 'b') h ^= ZT;
  h ^= ZC[pos.castle & 15];
  if (pos.ep >= 0) h ^= ZE[pos.ep];
  return h;
}

function passed(pos: Position, s: number, color: Piece['c']): boolean {
  const f = fileOf(s);
  const dir = color === 'w' ? 1 : -1;
  for (let r = rankOf(s) + dir; r >= 0 && r < 8; r += dir) {
    for (let df = -1; df <= 1; df++) {
      const ff = f + df;
      if (ff < 0 || ff > 7) continue;
      const q = pos.board[r * 8 + ff];
      if (q && q.t === 'p' && q.c !== color) return false;
    }
  }
  return true;
}

export function evaluate(pos: Position): number {
  let mg = 0;
  let eg = 0;
  let phase = 0;
  let wb = 0;
  let bb = 0;
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (!p) continue;
    phase += PHASE[p.t];
    const idx = p.c === 'w' ? s : s ^ 56;
    const sign = p.c === 'w' ? 1 : -1;
    mg += sign * (VAL[p.t] + MG[p.t][idx]);
    eg += sign * (VAL[p.t] + EG[p.t][idx]);
    if (p.t === 'b') {
      if (p.c === 'w') wb++;
      else bb++;
    }
    if (p.t === 'p' && passed(pos, s, p.c)) {
      const adv = p.c === 'w' ? rankOf(s) : 7 - rankOf(s);
      const bonus = adv * adv * 4;
      mg += sign * bonus;
      eg += sign * bonus;
    }
  }
  if (wb >= 2) {
    mg += 30;
    eg += 40;
  }
  if (bb >= 2) {
    mg -= 30;
    eg -= 40;
  }
  phase = Math.min(phase, 24);
  const white = (mg * phase + eg * (24 - phase)) / 24;
  const side = pos.turn === 'w' ? white : -white;
  return side + 10;
}

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  move: number;
}

const TT = new Map<bigint, TTEntry>();
const killers: number[][] = Array.from({ length: 128 }, () => []);

let nodes = 0;
let stop = false;
let deadline = 0;

function pack(m: Move): number {
  const promo = m.promo ? ' nbrq'.indexOf(m.promo) : 0;
  return m.from | (m.to << 6) | (promo << 12);
}

function mvv(pos: Position, m: Move): number {
  const attacker = pos.board[m.from];
  if (!attacker) return 0;
  let s = 0;
  const victim = pos.board[m.to];
  if (victim) s += 10_000 + VAL[victim.t] * 10 - VAL[attacker.t];
  if (m.promo) s += 9_000 + VAL[m.promo];
  if (attacker.t === 'p' && m.to === pos.ep) s += 10_000 + VAL.p;
  return s;
}

function orderMoves(pos: Position, moves: Move[], ttMove: number, ply: number): Move[] {
  const ks = killers[ply] ?? [];
  return moves
    .map((m) => {
      const packed = pack(m);
      let s = mvv(pos, m);
      if (packed === ttMove) s += 1_000_000;
      else if (ks.includes(packed)) s += 4_000;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

function addKiller(ply: number, m: Move) {
  const packed = pack(m);
  const slot = killers[ply];
  if (!slot || slot[0] === packed) return;
  slot[1] = slot[0];
  slot[0] = packed;
}

function timedOut(): boolean {
  nodes++;
  if ((nodes & 1023) === 0 && performance.now() > deadline) {
    stop = true;
    return true;
  }
  return stop;
}

function quiesce(pos: Position, alpha: number, beta: number, ply: number, qdepth: number): number {
  if (timedOut()) return 0;
  const checking = inCheck(pos, pos.turn);
  if (!checking) {
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
  }
  if (qdepth > 4) return evaluate(pos);
  let moves = genLegal(pos);
  if (!checking) {
    moves = moves.filter((m) => pos.board[m.to] || m.promo || (pos.board[m.from]?.t === 'p' && m.to === pos.ep));
  }
  if (moves.length === 0) {
    if (checking) return -100000 + ply;
    return alpha;
  }
  for (const m of orderMoves(pos, moves, 0, ply)) {
    const u = make(pos, m);
    const sc = -quiesce(pos, -beta, -alpha, ply + 1, qdepth + 1);
    unmake(pos, m, u);
    if (stop) return 0;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return alpha;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  if (timedOut()) return 0;
  if (depth <= 0) return quiesce(pos, alpha, beta, ply, 0);

  const key = hashPos(pos);
  const tt = TT.get(key);
  let ttMove = 0;
  if (tt) {
    ttMove = tt.move;
    if (tt.depth >= depth && Math.abs(tt.score) < 90000) {
      if (tt.flag === EXACT) return tt.score;
      if (tt.flag === LOWER && tt.score >= beta) return tt.score;
      if (tt.flag === UPPER && tt.score <= alpha) return tt.score;
    }
  }

  const moves = genLegal(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.turn)) return -100000 + ply;
    return 0;
  }

  let best = -Infinity;
  let bestMove = 0;
  let flag = UPPER;
  for (const m of orderMoves(pos, moves, ttMove, ply)) {
    const u = make(pos, m);
    const sc = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
    unmake(pos, m, u);
    if (stop) return 0;
    if (sc > best) {
      best = sc;
      bestMove = pack(m);
    }
    if (sc > alpha) {
      alpha = sc;
      flag = EXACT;
    }
    if (alpha >= beta) {
      flag = LOWER;
      if (!u.captured && !m.promo) addKiller(ply, m);
      break;
    }
  }
  if (!stop && best > -Infinity && Math.abs(best) < 90000) {
    TT.set(key, { depth, score: best, flag, move: bestMove });
  }
  return best;
}

export interface SearchOpts {
  maxDepth: number;
  ms: number;
  noise: number;
}

export function searchRoot(pos: Position, opts: SearchOpts): Move | null {
  const legal = genLegal(pos);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  deadline = performance.now() + opts.ms;
  stop = false;
  nodes = 0;
  TT.clear();
  for (const slot of killers) {
    slot.length = 0;
  }

  let best = legal[0];
  let completed: { m: Move; sc: number }[] | null = null;

  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    if (performance.now() > deadline) break;
    const scores: { m: Move; sc: number }[] = [];
    let alpha = -Infinity;
    const beta = Infinity;
    const ordered = orderMoves(pos, legal, pack(best), 0);
    let iterBest = ordered[0];
    let iterScore = -Infinity;
    let failed = false;
    for (const m of ordered) {
      if (performance.now() > deadline) {
        failed = true;
        break;
      }
      const u = make(pos, m);
      const sc = -negamax(pos, depth - 1, -beta, -alpha, 1);
      unmake(pos, m, u);
      if (stop) {
        failed = true;
        break;
      }
      scores.push({ m, sc });
      if (sc > iterScore) {
        iterScore = sc;
        iterBest = m;
        if (sc > alpha) alpha = sc;
      }
    }
    if (!failed) {
      best = iterBest;
      completed = scores;
      if (iterScore > 90000) break;
    } else {
      break;
    }
  }

  if (opts.noise > 0 && completed && completed.length) {
    const top = Math.max(...completed.map((s) => s.sc));
    if (top < 90000) {
      const pool = completed.filter((s) => s.sc >= top - opts.noise);
      return pool[Math.floor(Math.random() * pool.length)].m;
    }
  }
  return best;
}
