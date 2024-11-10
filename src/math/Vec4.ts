export class Vec4 extends Float32Array {
    constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
        super(4);

        this[0] = x;
        this[1] = y;
        this[2] = z;
        this[3] = w;
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

    public get z(): number {
        return this[2];
    }

    public set z(value: number) {
        this[2] = value;
    }

    public get w(): number {
        return this[3];
    }

    public set w(value: number) {
        this[3] = value;
    }

    public static length(v: Vec4): number {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
    }

    public static subtract(a: Vec4, b: Vec4): Vec4 {
        return new Vec4(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w);
    }

    public static normalize(v: Vec4): Vec4 {
        const length = Vec4.length(v);
        return new Vec4(v.x / length, v.y / length, v.z / length, v.w / length);
    }

    public static dot(a: Vec4, b: Vec4): number {
        return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    }

    public static add(a: Vec4, b: Vec4): Vec4 {
        return new Vec4(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
    }

    public static multiplyScalar(a: Vec4, scalar: number): Vec4 {
        return new Vec4(a.x * scalar, a.y * scalar, a.z * scalar, a.w * scalar);
    }

    public static multiply(a: Vec4, b: Vec4): Vec4 {
        return new Vec4(a.x * b.x, a.y * b.y, a.z * b.z, a.w * b.w);
    }

    public static distance(a: Vec4, b: Vec4): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dw = a.w - b.w;
        return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw);
    }

    public static scale(a: Vec4, factor: number): Vec4 {
        return new Vec4(a.x * factor, a.y * factor, a.z * factor, a.w * factor);
    }
}