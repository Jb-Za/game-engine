import { Vec3 } from "./Vec3";
import { Mat4x4 } from "./Mat4x4";

export class Quaternion {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    /**
     * Creates an identity quaternion [0, 0, 0, 1]
     */
    public static identity(): Quaternion {
        return new Quaternion(0, 0, 0, 1);
    }

    /**
     * Converts this quaternion to a rotation matrix
     */
    public static getQuaternionFromMat4x4(m: Mat4x4): Quaternion {
        const trace = m[0] + m[5] + m[10];
        let x, y, z, w;

        if (trace > 0) {
            const s = Math.sqrt(trace + 1.0) * 2; // S=4*qw
            w = 0.25 * s;
            x = (m[6] - m[9]) / s;
            y = (m[8] - m[2]) / s;
            z = (m[1] - m[4]) / s;
        } else if ((m[0] > m[5]) && (m[0] > m[10])) {
            const s = Math.sqrt(1.0 + m[0] - m[5] - m[10]) * 2; // S=4*qx
            w = (m[6] - m[9]) / s;
            x = 0.25 * s;
            y = (m[1] + m[4]) / s;
            z = (m[8] + m[2]) / s;
        } else if (m[5] > m[10]) {
            const s = Math.sqrt(1.0 + m[5] - m[0] - m[10]) * 2; // S=4*qy
            w = (m[8] - m[2]) / s;
            x = (m[1] + m[4]) / s;
            y = 0.25 * s;
            z = (m[6] + m[9]) / s;
        } else {
            const s = Math.sqrt(1.0 + m[10] - m[0] - m[5]) * 2; // S=4*qz
            w = (m[1] - m[4]) / s;
            x = (m[8] + m[2]) / s;
            y = (m[6] + m[9]) / s;
            z = 0.25 * s;
        }

        return new Quaternion(x, y, z, w);
    }

    /**
     * Creates a quaternion from axis angle representation
     * @param axis The rotation axis (should be normalized)
     * @param angle The rotation angle in radians
     */
    public static fromAxisAngle(axis: Vec3, angle: number): Quaternion {
        const halfAngle = angle / 2;
        const sinHalfAngle = Math.sin(halfAngle);
        return new Quaternion(
            axis.x * sinHalfAngle,
            axis.y * sinHalfAngle,
            axis.z * sinHalfAngle,
            Math.cos(halfAngle)
        );
    }

    /**
     * Creates a quaternion for rotation around the Y axis (yaw)
     * @param angle The rotation angle in radians
     */
    public static fromYaw(angle: number): Quaternion {
        const halfAngle = angle / 2;
        return new Quaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle));
    }

    /**
     * Creates a quaternion for rotation around the X axis (pitch)
     * @param angle The rotation angle in radians
     */
    public static fromPitch(angle: number): Quaternion {
        const halfAngle = angle / 2;
        return new Quaternion(Math.sin(halfAngle), 0, 0, Math.cos(halfAngle));
    }

    /**
     * Creates a quaternion for rotation around the Z axis (roll)
     * @param angle The rotation angle in radians
     */
    public static fromRoll(angle: number): Quaternion {
        const halfAngle = angle / 2;
        return new Quaternion(0, 0, Math.sin(halfAngle), Math.cos(halfAngle));
    }

    /**
     * Multiplies two quaternions (applies rotations in order q2 then q1)
     * @param q1 First quaternion
     * @param q2 Second quaternion
     */
    public static multiply(q1: Quaternion, q2: Quaternion): Quaternion {
        const { x: x1, y: y1, z: z1, w: w1 } = q1;
        const { x: x2, y: y2, z: z2, w: w2 } = q2;
        return new Quaternion(
            w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
            w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
        );
    }

    /**
     * Normalizes the given quaternion
     * @param q The quaternion to normalize
     */
    public static normalize(q: Quaternion): Quaternion {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (length === 0) {
            return Quaternion.identity();
        }
        return new Quaternion(
            q.x / length,
            q.y / length,
            q.z / length,
            q.w / length
        );
    }

    /**
     * Conjugates this quaternion (inverts the rotation)
     */
    public conjugate(): Quaternion {
        return new Quaternion(-this.x, -this.y, -this.z, this.w);
    }

    /**
     * Rotates a vector by this quaternion
     * @param v Vector to rotate
     */
    /**
     * Rotates a vector by a quaternion
     * @param q The quaternion to use for rotation
     * @param v The vector to rotate
     */
    public static rotateVector(q: Quaternion, v: Vec3): Vec3 {
        // Extract the vector part of the quaternion
        const u = new Vec3(q.x, q.y, q.z);
        const s = q.w;

        // v' = 2.0f * dot(u, v) * u
        //    + (s*s - dot(u, u)) * v
        //    + 2.0f * s * cross(u, v)
        const dotUV = Vec3.dot(u, v);
        const crossUV = Vec3.cross(u, v);
        const uu = Vec3.dot(u, u);

        let v1 = Vec3.multiplyScalar(u, 2 * dotUV);
        let v2 = Vec3.multiplyScalar(v, s * s - uu);
        let v3 = Vec3.multiplyScalar(crossUV, 2 * s);

        return Vec3.add(Vec3.add(v1, v2), v3);
    }

    /**
     * Returns the forward vector from this quaternion (equivalent to rotating [0,0,-1])
     */
    public getForwardVector(): Vec3 {
        return new Vec3(
            2 * (this.x * this.z - this.w * this.y),
            2 * (this.y * this.z + this.w * this.x),
            -(1 - 2 * (this.x * this.x + this.y * this.y))
        );
    }

    /**
     * Returns the right vector from this quaternion (equivalent to rotating [1,0,0])
     */
    public getRightVector(): Vec3 {
        return new Vec3(
            1 - 2 * (this.y * this.y + this.z * this.z),
            2 * (this.x * this.y + this.w * this.z),
            2 * (this.x * this.z - this.w * this.y)
        );
    }

    /**
     * Returns the up vector from this quaternion (equivalent to rotating [0,1,0])
     */
    public getUpVector(): Vec3 {
        return new Vec3(
            2 * (this.x * this.y - this.w * this.z),
            1 - 2 * (this.x * this.x + this.z * this.z),
            2 * (this.y * this.z + this.w * this.x)
        );
    }

    /**
     * Converts this quaternion to a rotation matrix
     */
    public toMatrix(): Mat4x4 {
        return Mat4x4.rotationFromQuaternion(this);
    }

    /**
     * Returns this quaternion as an array [x, y, z, w]
     */
    public toArray(): number[] {
        return [this.x, this.y, this.z, this.w];
    }
}
