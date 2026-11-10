import assert from 'node:assert/strict';
import {
  START_FEN,
  captureSquare,
  fileOf,
  fromFen,
  genLegal,
  make,
  parseSq,
  perft,
  rankOf,
  result,
  san,
  sq,
  toFen,
  unmake,
  type Move,
} from './chess';
import { searchRoot } from './ai';

function expectPerft(name: string, fen: string, depth: number, expected: number) {
  const pos = fromFen(fen);
  const before = toFen(pos);
  const t0 = performance.now();
  const n = perft(pos, depth);
  const ms = performance.now() - t0;
  assert.equal(toFen(pos), before, `${name} mutated the position`);
  assert.equal(n, expected, `${name} perft(${depth}) = ${n}, expected ${expected}`);
  console.log(`${name} d${depth} = ${n} (${ms.toFixed(0)} ms)`);
}

function play(fen: string, moves: string[]): string {
  const pos = fromFen(fen);
  for (const text of moves) {
    const from = parseSq(text.slice(0, 2));
    const to = parseSq(text.slice(2, 4));
    const promo = text[4] as Move['promo'] | undefined;
    const legal = genLegal(pos);
    const m = legal.find((x) => x.from === from && x.to === to && x.promo === promo);
    assert.ok(m, `illegal ${text} in ${toFen(pos)}`);
    make(pos, m);
  }
  return toFen(pos);
}

const start = fromFen(START_FEN);
assert.equal(toFen(start), START_FEN);
assert.equal(genLegal(start).length, 20);

const e2 = parseSq('e2');
const e4 = parseSq('e4');
const legalStart = genLegal(start);
const pawn = legalStart.find((m) => m.from === e2 && m.to === e4)!;
assert.equal(san(start, pawn, legalStart), 'e4');
assert.equal(toFen(start), START_FEN);
const knight = legalStart.find((m) => m.from === parseSq('g1') && m.to === parseSq('f3'))!;
assert.equal(san(start, knight, legalStart), 'Cf3');

expectPerft('start', START_FEN, 1, 20);
expectPerft('start', START_FEN, 2, 400);
expectPerft('start', START_FEN, 3, 8902);

const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
expectPerft('kiwipete', kiwipete, 1, 48);
expectPerft('kiwipete', kiwipete, 2, 2039);

const pos3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
expectPerft('pos3', pos3, 1, 14);
expectPerft('pos3', pos3, 2, 191);
expectPerft('pos3', pos3, 3, 2812);

const pos4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
expectPerft('pos4', pos4, 1, 6);
expectPerft('pos4', pos4, 2, 264);

const pos5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';
expectPerft('pos5', pos5, 1, 44);
expectPerft('pos5', pos5, 2, 1486);

{
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const pos = fromFen(fen);
  const m = genLegal(pos).find((x) => x.from === parseSq('e1') && x.to === parseSq('g1'))!;
  assert.equal(san(pos, m, genLegal(pos)), 'O-O');
  const u = make(pos, m);
  assert.equal(pos.board[parseSq('g1')]?.t, 'k');
  assert.equal(pos.board[parseSq('f1')]?.t, 'r');
  assert.equal(pos.board[parseSq('e1')], null);
  assert.equal(pos.board[parseSq('h1')], null);
  assert.equal(pos.castle & 3, 0);
  assert.equal(pos.castle & 12, 12);
  unmake(pos, m, u);
  assert.equal(toFen(pos), fen);
}

{
  const pos = fromFen('4k3/8/b7/8/8/8/8/R3K2R w KQ - 0 1');
  const legal = genLegal(pos);
  assert.equal(legal.some((m) => m.from === 4 && m.to === 6), false);
  assert.equal(legal.some((m) => m.from === 4 && m.to === 2), true);
}

{
  const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
  const pos = fromFen(fen);
  const m = genLegal(pos).find((x) => x.from === parseSq('e5') && x.to === parseSq('d6'))!;
  assert.ok(m);
  assert.equal(captureSquare(pos, m), parseSq('d5'));
  const u = make(pos, m);
  assert.equal(pos.board[parseSq('d6')]?.c, 'w');
  assert.equal(pos.board[parseSq('e5')], null);
  assert.equal(pos.board[parseSq('d5')], null);
  unmake(pos, m, u);
  assert.equal(toFen(pos), fen);
}

{
  const pos = fromFen('4k3/8/8/b7/8/2N5/8/4K3 w - - 0 1');
  const legal = genLegal(pos);
  assert.ok(legal.every((m) => m.from !== sq(2, 2)), 'pinned knight must not move');
  assert.ok(legal.some((m) => m.from === sq(4, 0)));
}

{
  const pos = fromFen('4k3/8/8/8/8/2N1N3/8/4K3 w - - 0 1');
  const legal = genLegal(pos);
  const m = legal.find((x) => x.from === parseSq('c3') && x.to === parseSq('d5'))!;
  assert.equal(san(pos, m, legal), 'Ccd5');
}

{
  const finalFen = play(START_FEN, ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
  const pos = fromFen(finalFen);
  const rep = new Map<string, number>();
  const res = result(pos, rep);
  assert.equal(res.type, 'mate');
  if (res.type === 'mate') assert.equal(res.winner, 'w');
  console.log('scholar mate ok', finalFen);
}

{
  const pos = fromFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  const m = searchRoot(pos, { maxDepth: 2, ms: 1500, noise: 0 });
  assert.ok(m, 'ai returned no move');
  assert.equal(fileOf(m.from), 7);
  assert.equal(rankOf(m.from), 4);
  assert.equal(fileOf(m.to), 5);
  assert.equal(rankOf(m.to), 6);
  console.log('ai finds scholar mate');
}

console.log('all chess tests passed');
