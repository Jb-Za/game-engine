export class Vec2 extends Float32Array {
  constructor(x: number = 0, y: number = 0) {
    super(2);

    this[0] = x;
    this[1] = y;
  }

  public get x(): number {
    return this[0];
  }

  public set x(value: number) {
    this[0] = value;
  }

  public get y(): number {
    return this[1];
  }

  public set y(value: number) {
    this[1] = value;
  }

  public nomalize() {
    const length = Math.sqrt(this[0] * this[0] + this[1] * this[1]);
    this[0] /= length;
    this[1] /= length;
  }

  public static magnitude(vec: Vec2): number {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  }

  public static subtract(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  public static add(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  public static multiply(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x * b.x, a.y * b.y);
  }
  public static scale(vec: Vec2, scalar: number): Vec2 {
    return new Vec2(vec.x * scalar, vec.y * scalar);
  }

  public static distance(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public static dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  }
}
