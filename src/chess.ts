export type Color = 'w' | 'b';
export type PType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  c: Color;
  t: PType;
}

export interface Move {
  from: number;
  to: number;
  promo?: PType;
}

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castle: number;
  ep: number;
  half: number;
  full: number;
}

export interface Undo {
  captured: Piece | null;
  capSq: number;
  castle: number;
  ep: number;
  half: number;
  full: number;
  moved: Piece;
  rookFrom: number;
  rookTo: number;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const fileOf = (s: number) => s & 7;
export const rankOf = (s: number) => s >> 3;
export const sq = (f: number, r: number) => r * 8 + f;
export const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');

const FILES = 'abcdefgh';

export function alg(s: number): string {
  return FILES[fileOf(s)] + String(rankOf(s) + 1);
}

export function parseSq(a: string): number {
  return sq(a.charCodeAt(0) - 97, a.charCodeAt(1) - 49);
}

const PROMO: PType[] = ['q', 'r', 'b', 'n'];
const KNIGHT = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const KING = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const BISHOP = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const ROOK = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

export function clonePos(p: Position): Position {
  return {
    board: p.board.map((sqp) => (sqp ? { c: sqp.c, t: sqp.t } : null)),
    turn: p.turn,
    castle: p.castle,
    ep: p.ep,
    half: p.half,
    full: p.full,
  };
}

export function fromFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  const ranks = parts[0].split('/');
  const board: (Piece | null)[] = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[7 - r]) {
      if (ch >= '1' && ch <= '8') {
        f += ch.charCodeAt(0) - 48;
        continue;
      }
      const c: Color = ch === ch.toUpperCase() ? 'w' : 'b';
      board[sq(f, r)] = { c, t: ch.toLowerCase() as PType };
      f++;
    }
  }
  let castle = 0;
  const castleStr = parts[2] ?? '-';
  if (castleStr.includes('K')) castle |= 1;
  if (castleStr.includes('Q')) castle |= 2;
  if (castleStr.includes('k')) castle |= 4;
  if (castleStr.includes('q')) castle |= 8;
  const epStr = parts[3] ?? '-';
  return {
    board,
    turn: parts[1] === 'b' ? 'b' : 'w',
    castle,
    ep: epStr === '-' ? -1 : parseSq(epStr),
    half: parts[4] ? Number(parts[4]) : 0,
    full: parts[5] ? Number(parts[5]) : 1,
  };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[sq(f, r)];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) {
        row += empty;
        empty = 0;
      }
      row += p.c === 'w' ? p.t.toUpperCase() : p.t;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  let castle = '';
  if (pos.castle & 1) castle += 'K';
  if (pos.castle & 2) castle += 'Q';
  if (pos.castle & 4) castle += 'k';
  if (pos.castle & 8) castle += 'q';
  if (!castle) castle = '-';
  const ep = pos.ep >= 0 ? alg(pos.ep) : '-';
  return `${rows.join('/')} ${pos.turn} ${castle} ${ep} ${pos.half} ${pos.full}`;
}

export function repKey(pos: Position): string {
  return toFen(pos).split(' ').slice(0, 4).join(' ');
}

function onBoard(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

export function isAttacked(board: (Piece | null)[], s: number, by: Color): boolean {
  const f = fileOf(s);
  const r = rankOf(s);
  const pawnRank = by === 'w' ? r - 1 : r + 1;
  if (pawnRank >= 0 && pawnRank < 8) {
    for (const df of [-1, 1]) {
      const ff = f + df;
      if (ff < 0 || ff > 7) continue;
      const p = board[sq(ff, pawnRank)];
      if (p && p.c === by && p.t === 'p') return true;
    }
  }
  for (const [df, dr] of KNIGHT) {
    const ff = f + df;
    const rr = r + dr;
    if (!onBoard(ff, rr)) continue;
    const p = board[sq(ff, rr)];
    if (p && p.c === by && p.t === 'n') return true;
  }
  for (const [df, dr] of KING) {
    const ff = f + df;
    const rr = r + dr;
    if (!onBoard(ff, rr)) continue;
    const p = board[sq(ff, rr)];
    if (p && p.c === by && p.t === 'k') return true;
  }
  const slide = (dirs: number[][], types: PType[]) => {
    for (const [df, dr] of dirs) {
      let ff = f + df;
      let rr = r + dr;
      while (onBoard(ff, rr)) {
        const p = board[sq(ff, rr)];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        ff += df;
        rr += dr;
      }
    }
    return false;
  };
  return slide(BISHOP, ['b', 'q']) || slide(ROOK, ['r', 'q']);
}

export function kingSquare(pos: Position, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (p && p.c === color && p.t === 'k') return i;
  }
  return -1;
}

export function inCheck(pos: Position, color: Color): boolean {
  const k = kingSquare(pos, color);
  return k >= 0 && isAttacked(pos.board, k, opp(color));
}

function pushPawn(out: Move[], from: number, to: number, promote: boolean) {
  if (!promote) {
    out.push({ from, to });
    return;
  }
  for (const promo of PROMO) out.push({ from, to, promo });
}

function genPseudo(pos: Position, out: Move[]) {
  const board = pos.board;
  const c = pos.turn;
  const enemy = opp(c);
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p || p.c !== c) continue;
    const f = fileOf(s);
    const r = rankOf(s);
    if (p.t === 'p') {
      const dir = c === 'w' ? 1 : -1;
      const start = c === 'w' ? 1 : 6;
      const last = c === 'w' ? 7 : 0;
      const r1 = r + dir;
      if (onBoard(f, r1) && !board[sq(f, r1)]) {
        pushPawn(out, s, sq(f, r1), r1 === last);
        const r2 = r + dir * 2;
        if (r === start && !board[sq(f, r2)]) pushPawn(out, s, sq(f, r2), false);
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (!onBoard(ff, r1)) continue;
        const t = sq(ff, r1);
        const dest = board[t];
        if ((dest && dest.c === enemy) || t === pos.ep) pushPawn(out, s, t, r1 === last);
      }
    } else if (p.t === 'n' || p.t === 'k') {
      const leaps = p.t === 'n' ? KNIGHT : KING;
      for (const [df, dr] of leaps) {
        const ff = f + df;
        const rr = r + dr;
        if (!onBoard(ff, rr)) continue;
        const dest = board[sq(ff, rr)];
        if (!dest || dest.c === enemy) out.push({ from: s, to: sq(ff, rr) });
      }
      if (p.t === 'k') {
        const can = (right: number, empty: number[], pass: number[], dest: number, rookSq: number) => {
          if ((pos.castle & right) === 0) return;
          if (empty.some((sqi) => board[sqi])) return;
          const rook = board[rookSq];
          if (!rook || rook.t !== 'r' || rook.c !== c) return;
          if (pass.some((sqi) => isAttacked(board, sqi, enemy))) return;
          out.push({ from: s, to: dest });
        };
        if (c === 'w' && s === 4) {
          can(1, [5, 6], [4, 5, 6], 6, 7);
          can(2, [1, 2, 3], [4, 3, 2], 2, 0);
        } else if (c === 'b' && s === 60) {
          can(4, [61, 62], [60, 61, 62], 62, 63);
          can(8, [57, 58, 59], [60, 59, 58], 58, 56);
        }
      }
    } else {
      const dirs = p.t === 'b' ? BISHOP : p.t === 'r' ? ROOK : [...BISHOP, ...ROOK];
      for (const [df, dr] of dirs) {
        let ff = f + df;
        let rr = r + dr;
        while (onBoard(ff, rr)) {
          const t = sq(ff, rr);
          const dest = board[t];
          if (!dest) out.push({ from: s, to: t });
          else {
            if (dest.c === enemy) out.push({ from: s, to: t });
            break;
          }
          ff += df;
          rr += dr;
        }
      }
    }
  }
}

function updateCastle(pos: Position, from: number, to: number, piece: Piece, captured: Piece | null) {
  if (piece.t === 'k') {
    if (piece.c === 'w') pos.castle &= ~3;
    else pos.castle &= ~12;
  }
  if (piece.t === 'r') {
    if (from === 7) pos.castle &= ~1;
    if (from === 0) pos.castle &= ~2;
    if (from === 63) pos.castle &= ~4;
    if (from === 56) pos.castle &= ~8;
  }
  if (captured?.t === 'r') {
    if (to === 7) pos.castle &= ~1;
    if (to === 0) pos.castle &= ~2;
    if (to === 63) pos.castle &= ~4;
    if (to === 56) pos.castle &= ~8;
  }
}

export function make(pos: Position, m: Move): Undo {
  const piece = pos.board[m.from];
  if (!piece) throw new Error(`empty from ${m.from}`);
  const dest = pos.board[m.to];
  const undo: Undo = {
    captured: null,
    capSq: -1,
    castle: pos.castle,
    ep: pos.ep,
    half: pos.half,
    full: pos.full,
    moved: piece,
    rookFrom: -1,
    rookTo: -1,
  };
  pos.board[m.from] = null;
  if (piece.t === 'p' && m.to === pos.ep && !dest) {
    const capSq = sq(fileOf(m.to), rankOf(m.from));
    undo.captured = pos.board[capSq];
    undo.capSq = capSq;
    pos.board[capSq] = null;
  } else if (dest) {
    undo.captured = dest;
    undo.capSq = m.to;
  }
  pos.board[m.to] = m.promo ? { c: piece.c, t: m.promo } : piece;
  if (piece.t === 'k' && Math.abs(fileOf(m.to) - fileOf(m.from)) === 2) {
    const r = rankOf(m.from);
    undo.rookFrom = fileOf(m.to) === 6 ? sq(7, r) : sq(0, r);
    undo.rookTo = fileOf(m.to) === 6 ? sq(5, r) : sq(3, r);
    pos.board[undo.rookTo] = pos.board[undo.rookFrom];
    pos.board[undo.rookFrom] = null;
  }
  updateCastle(pos, m.from, m.to, piece, undo.captured);
  if (piece.t === 'p' && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2) {
    pos.ep = sq(fileOf(m.from), (rankOf(m.from) + rankOf(m.to)) >> 1);
  } else {
    pos.ep = -1;
  }
  pos.half = piece.t === 'p' || undo.captured ? 0 : pos.half + 1;
  if (pos.turn === 'b') pos.full++;
  pos.turn = opp(pos.turn);
  return undo;
}

export function unmake(pos: Position, m: Move, u: Undo) {
  pos.turn = opp(pos.turn);
  pos.castle = u.castle;
  pos.ep = u.ep;
  pos.half = u.half;
  pos.full = u.full;
  if (u.rookFrom >= 0) {
    pos.board[u.rookFrom] = pos.board[u.rookTo];
    pos.board[u.rookTo] = null;
  }
  pos.board[m.from] = u.moved;
  pos.board[m.to] = null;
  if (u.captured && u.capSq >= 0) pos.board[u.capSq] = u.captured;
}

export function genLegal(pos: Position): Move[] {
  const pseudo: Move[] = [];
  genPseudo(pos, pseudo);
  const legal: Move[] = [];
  const me = pos.turn;
  for (const m of pseudo) {
    const u = make(pos, m);
    if (!inCheck(pos, me)) legal.push(m);
    unmake(pos, m, u);
  }
  return legal;
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = genLegal(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const u = make(pos, m);
    n += perft(pos, depth - 1);
    unmake(pos, m, u);
  }
  return n;
}

const SAN: Record<PType, string> = { p: '', n: 'C', b: 'F', r: 'T', q: 'D', k: 'R' };

export function san(pos: Position, m: Move, legal: Move[]): string {
  const piece = pos.board[m.from];
  if (!piece) return alg(m.to);
  if (piece.t === 'k' && Math.abs(fileOf(m.to) - fileOf(m.from)) === 2) {
    return fileOf(m.to) === 6 ? 'O-O' : 'O-O-O';
  }
  let s = SAN[piece.t];
  if (piece.t !== 'p' && piece.t !== 'k') {
    const others = legal.filter(
      (o) => o.to === m.to && o.from !== m.from && pos.board[o.from]?.t === piece.t,
    );
    if (others.length) {
      const sameFile = others.some((o) => fileOf(o.from) === fileOf(m.from));
      const sameRank = others.some((o) => rankOf(o.from) === rankOf(m.from));
      if (!sameFile) s += FILES[fileOf(m.from)];
      else if (!sameRank) s += String(rankOf(m.from) + 1);
      else s += alg(m.from);
    }
  }
  const isCap = !!pos.board[m.to] || (piece.t === 'p' && m.to === pos.ep);
  if (piece.t === 'p' && isCap) s += FILES[fileOf(m.from)];
  if (isCap) s += 'x';
  s += alg(m.to);
  if (m.promo) s += '=' + SAN[m.promo];
  const u = make(pos, m);
  const gives = inCheck(pos, pos.turn);
  const mate = gives && genLegal(pos).length === 0;
  unmake(pos, m, u);
  if (mate) s += '#';
  else if (gives) s += '+';
  return s;
}

export function captureSquare(pos: Position, m: Move): number | null {
  if (pos.board[m.to]) return m.to;
  const p = pos.board[m.from];
  if (p?.t === 'p' && m.to === pos.ep) return sq(fileOf(m.to), rankOf(m.from));
  return null;
}

function bishopSquareColor(s: number): number {
  return (fileOf(s) + rankOf(s)) & 1;
}

export function insufficient(pos: Position): boolean {
  const extras: { t: PType; sq: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (p && p.t !== 'k') extras.push({ t: p.t, sq: i });
  }
  if (extras.length === 0) return true;
  if (extras.length === 1 && (extras[0].t === 'n' || extras[0].t === 'b')) return true;
  if (extras.length === 2 && extras[0].t === 'b' && extras[1].t === 'b') {
    return bishopSquareColor(extras[0].sq) === bishopSquareColor(extras[1].sq);
  }
  return false;
}

export type Result =
  | { type: 'ongoing' }
  | { type: 'mate'; winner: Color }
  | { type: 'draw'; reason: 'stalemate' | 'insufficient' | 'fifty' | 'threefold' };

export function result(pos: Position, rep: Map<string, number>): Result {
  const legal = genLegal(pos);
  if (legal.length === 0) {
    if (inCheck(pos, pos.turn)) return { type: 'mate', winner: opp(pos.turn) };
    return { type: 'draw', reason: 'stalemate' };
  }
  if (pos.half >= 100) return { type: 'draw', reason: 'fifty' };
  if ((rep.get(repKey(pos)) ?? 0) >= 3) return { type: 'draw', reason: 'threefold' };
  if (insufficient(pos)) return { type: 'draw', reason: 'insufficient' };
  return { type: 'ongoing' };
}
