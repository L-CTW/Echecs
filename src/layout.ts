/** Square size and the height where pieces stand. */
export const SQUARE = 1;
export const SURFACE_Y = 1.2;

export function xz(file: number, rank: number): [number, number] {
  return [(file - 3.5) * SQUARE, (3.5 - rank) * SQUARE];
}
