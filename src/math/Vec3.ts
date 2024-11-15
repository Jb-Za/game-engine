export class Vec3 extends Float32Array
{
    constructor(x: number = 0, y: number = 0, z: number = 0)
    {
        super(3);

        this[0] = x;
        this[1] = y;
        this[2] = z;
    }

    public get x(): number
    {
        return this[0];
    }

    public set x(value: number)
    {
        this[0] = value;
    }

    public get y(): number
    {
        return this[1];
    }

    public set y(value: number)
    {
        this[1] = value;
    }

    public get z(): number
    {
        return this[2];
    }

    public set z(value: number)
    {
        this[2] = value;
    }

    public static length(v: Vec3): number
    {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    public static subtract(a: Vec3 ,b: Vec3) : Vec3 
    {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    public static normalize(v: Vec3): Vec3
    {
        const length = Vec3.length(v);
        return new Vec3(v.x / length, v.y / length, v.z / length);
    }

    public static cross(a: Vec3, b: Vec3): Vec3
    {
        return new Vec3(
            a.y * b.z - a.z * b.y, 
            a.z * b.x - a.x * b.z, 
            a.x * b.y - a.y * b.x
        );
    }

    public static dot(a: Vec3, b: Vec3): number
    {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    public static add(a: Vec3 ,b: Vec3) : Vec3 
    {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    public static transpose(a : Vec3){
        return new Vec3(a[0], a[1], a[2]);
    }

    public static multiplyScalar(a: Vec3, scalar: number): Vec3 {
        return new Vec3(a.x * scalar, a.y * scalar, a.z * scalar);
    }

    public static multiply(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(a.x * b.x, a.y * b.y, a.z * b.z);
    }

    public static distance(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    public static scale(a: Vec3, factor: number): Vec3 {
        return new Vec3(a.x * factor, a.y * factor, a.z * factor);
    }
    
}