import { Mat4x4 } from "./Mat4x4";
import { Quaternion } from "./Quaternion";

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

    public get xyz(): number[]
    {
        return [this[0], this[1], this[2]];
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

    public static transformPoint(mat: Mat4x4, point: Vec3): Vec3 {
        const x = point.x, y = point.y, z = point.z;
        const e = mat;
      
        const tx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const ty = e[1] * x + e[5] * y + e[9] * z + e[13];
        const tz = e[2] * x + e[6] * y + e[10] * z + e[14];
      
        return new Vec3(tx, ty, tz);
      }

    public static transformVector(mat: Mat4x4, vector: Vec3): Vec3 {
        const x = vector.x, y = vector.y, z = vector.z;
        const e = mat;
      
        const tx = e[0] * x + e[4] * y + e[8] * z;
        const ty = e[1] * x + e[5] * y + e[9] * z;
        const tz = e[2] * x + e[6] * y + e[10] * z;
      
        return new Vec3(tx, ty, tz);
      }
    
    /**
     * Returns a Vec3 representing the direction of the Y axis rotated by the given quaternion.
     * @param q Quaternion
     * @returns Vec3
     */
    public static fromQuaternion(q: Quaternion): Vec3 {
        // Accept both object and array forms
        let x: number, y: number, z: number, w: number;
        if (Array.isArray(q)) {
            [x, y, z, w] = q;
        } else {
            x = q.x; y = q.y; z = q.z; w = q.w;
        }
        // Rotate the Y axis (0,1,0) by the quaternion
        // Formula: v' = q * v * q^-1
        // Optimized for (0,1,0):
        const vx = 2 * (x * y - w * z);
        const vy = 1 - 2 * (x * x + z * z);
        const vz = 2 * (y * z + w * x);
        return new Vec3(vx, vy, vz);
    }

    /**
     * Returns a Vec3 representing the forward direction (Z-axis) rotated by the given quaternion.
     * @param q Quaternion
     * @returns Vec3
     */
    public static vectorFromQuaternion(q: Quaternion): Vec3 {
        // Accept both object and array forms
        let x: number, y: number, z: number, w: number;
        if (Array.isArray(q)) {
            [x, y, z, w] = q;
        } else {
            x = q.x; y = q.y; z = q.z; w = q.w;
        }
        // Rotate the Z axis (0,0,1) by the quaternion to get forward direction
        // Formula: v' = q * v * q^-1
        // Optimized for (0,0,1):
        const vx = 2 * (x * z + w * y);
        const vy = 2 * (y * z - w * x);
        const vz = 1 - 2 * (x * x + y * y);
        return new Vec3(vx, vy, vz);
    }
}