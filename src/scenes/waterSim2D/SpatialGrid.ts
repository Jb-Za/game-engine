import { Vec2 } from "../../math/Vec2";

export class SpatialGrid {
  // Hash constants
  private static HASH_K1 = 15823;
  private static HASH_K2 = 9737333;

  // 9 neighboring cells (including center)
  public static CELL_OFFSETS = [
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ];

  public static getCell2D(position: Vec2, radius: number): Vec2 {
    return new Vec2(
      Math.floor(position.x / radius),
      Math.floor(position.y / radius),
    );
  }

  public static hashCell2D(cell: Vec2): number {
    const a = (cell.x * this.HASH_K1) >> 0; 
    const b = (cell.y * this.HASH_K2) >> 0;
    return a + b;
  }

  public static keyFromHash(hash: number, tableSize: number): number {
    // unsigned conversion then modulo
    return (hash >>> 0) % (tableSize >>> 0);
  }
}
