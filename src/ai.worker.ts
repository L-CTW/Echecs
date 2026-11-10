import { searchRoot } from './ai';
import { fromFen, type PType } from './chess';

interface Request {
  id: number;
  fen: string;
  maxDepth: number;
  ms: number;
  noise: number;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, fen, maxDepth, ms, noise } = event.data;
  try {
    const move = searchRoot(fromFen(fen), { maxDepth, ms, noise });
    self.postMessage({
      id,
      from: move?.from ?? -1,
      to: move?.to ?? -1,
      promo: (move?.promo ?? null) as PType | null,
    });
  } catch (error) {
    self.postMessage({ id, from: -1, to: -1, promo: null, error: String(error) });
  }
};
