import { MathUtils } from "./MathUtil";
import { Vec3 } from "./Vec3";
import { Vec4 } from "./Vec4";

export class Mat4x4 extends Float32Array{
    constructor(){
        super([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ])
    }

    public static identity(): Mat4x4{
        return new Mat4x4();
    }

    public static get BYTE_SIZE(){
        return 16 * Float32Array.BYTES_PER_ELEMENT;
    }

    public static translation(x: number, y: number, z: number): Mat4x4{
        const m = new Mat4x4();
        m.set([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ])
        return m;
    }

    public static scale(x: number, y: number, z: number): Mat4x4{
        const m = new Mat4x4();
        m.set([
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1
        ])
        return m;
    }

    /**
     * A static method that multiplies two 4x4 matrices together.
     *
     * @param a - The first 4x4 matrix.
     * @param b - The second 4x4 matrix.
     *
     * @returns A new 4x4 matrix.
     */
    public static multiply(a: Mat4x4, b: Mat4x4): Mat4x4 {

        const r0c0 = a[0] * b[0] + a[4] * b[1] + a[8] * b[2] + a[12] * b[3];
        const r1c0 = a[0] * b[4] + a[4] * b[5] + a[8] * b[6] + a[12] * b[7];
        const r2c0 = a[0] * b[8] + a[4] * b[9] + a[8] * b[10] + a[12] * b[11];
        const r3c0 = a[0] * b[12] + a[4] * b[13] + a[8] * b[14] + a[12] * b[15];

        const r0c1 = a[1] * b[0] + a[5] * b[1] + a[9] * b[2] + a[13] * b[3];
        const r1c1 = a[1] * b[4] + a[5] * b[5] + a[9] * b[6] + a[13] * b[7];
        const r2c1 = a[1] * b[8] + a[5] * b[9] + a[9] * b[10] + a[13] * b[11];
        const r3c1 = a[1] * b[12] + a[5] * b[13] + a[9] * b[14] + a[13] * b[15];

        const r0c2 = a[2] * b[0] + a[6] * b[1] + a[10] * b[2] + a[14] * b[3];
        const r1c2 = a[2] * b[4] + a[6] * b[5] + a[10] * b[6] + a[14] * b[7];
        const r2c2 = a[2] * b[8] + a[6] * b[9] + a[10] * b[10] + a[14] * b[11];
        const r3c2 = a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14] * b[15];

        const r0c3 = a[3] * b[0] + a[7] * b[1] + a[11] * b[2] + a[15] * b[3];
        const r1c3 = a[3] * b[4] + a[7] * b[5] + a[11] * b[6] + a[15] * b[7];
        const r2c3 = a[3] * b[8] + a[7] * b[9] + a[11] * b[10] + a[15] * b[11];
        const r3c3 = a[3] * b[12] + a[7] * b[13] + a[11] * b[14] + a[15] * b[15];

        const m = new Mat4x4();
        m.set([
            r0c0, r0c1, r0c2, r0c3,
            r1c0, r1c1, r1c2, r1c3,
            r2c0, r2c1, r2c2, r2c3,
            r3c0, r3c1, r3c2, r3c3
        ]);

        return m;
    }

    public static perspective(fov: number = 90, aspectRatio: number = 1, near : number = 0.01 , far: number = 100): Mat4x4{
        const r = 1/ MathUtils.toRadians(fov);
        
        const r0c0 = 1 / Math.tan(r / 2);
        const r1c1 = 1 / Math.tan(r / 2) * aspectRatio; 

        const r2c2 = -far/(near - far);
        const r3c2 = near * far / (near - far);
        
        const m = new Mat4x4();
        m.set([
            r0c0, 0, 0,    0,
            0, r1c1, 0,    0,
            0, 0,    r2c2, 1,
            0, 0,    r3c2, 0
        ]);
        return m;
    }
    
    public static rotationX(angle: number) : Mat4x4{
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        
        const m = new Mat4x4();
        m.set([
            1, 0, 0, 0,
            0, c, -s, 0,
            0, s,  c, 0,
            0, 0,  0, 1
        ]);
        return m;
    }
    public static rotationZ(angle: number) : Mat4x4{
        const s = Math.sin(angle);
        const c = Math.cos(angle);

        const m = new Mat4x4();
        m.set([
            c, -s, 0, 0,
            s,  c, 0, 0,
            0,  0, 1, 0,
            0,  0, 0, 1
        ]);
        return m;
    }

    public static rotationY(angle: number): Mat4x4 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m = new Mat4x4();
        m.set([
            c, 0, s, 0,    // first column
            0, 1, 0, 0,    // second column
            -s, 0, c, 0,   // third column
            0, 0, 0, 1     // fourth column (homogeneous coordinates)
        ]);

        return m;
    }
    
      
    public static orthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): Mat4x4{
        const r0c0 = 2 / (right - left);
        const r1c2 = 2 / (top - bottom);
        const r2c2 = 1 / (far - near);

        const r3r0 = -(right + left) / (right - left); // -1 to 1
        const r3c1 = -(top + bottom) / (top - bottom); // -1 to 1
        const r3c2 = -near / (far - near); // 0 to 1

        const m = new Mat4x4();
        m.set([
            r0c0, 0,    0,    0,
            0,    r1c2, 0,    0,
            0,    0,    r2c2, 0,
            r3r0, r3c1, r3c2, 1
        ]);
        return m;
    }

    public static transpose(m: Mat4x4): Mat4x4 {
        const t = new Mat4x4();
        t.set([
            m[0], m[4], m[8], m[12],
            m[1], m[5], m[9], m[13],
            m[2], m[6], m[10], m[14],
            m[3], m[7], m[11], m[15]
        ]);
        return t;
    }

    public static lookAt(eye : Vec3 , target: Vec3, up: Vec3): Mat4x4
    {
        const forward = Vec3.normalize(Vec3.subtract(target, eye));
        const right = Vec3.normalize(Vec3.cross( up, forward));
        up  = Vec3.cross(forward, right);

        const lookAt = new Mat4x4();
        lookAt.set([
            right.x, up.x, forward.x,0,
            right.y, up.y, forward.y,0,
            right.z, up.z, forward.z,0,
            -Vec3.dot(eye, right),-Vec3.dot(eye, up),-Vec3.dot(eye, forward),1
        ]);

        return lookAt
    }

    public static multiplyVec(matrix: Mat4x4, vector: Vec3): Vec3 {
        const x = matrix[0] * vector.x + matrix[4] * vector.y + matrix[8] * vector.z + matrix[12];
        const y = matrix[1] * vector.x + matrix[5] * vector.y + matrix[9] * vector.z + matrix[13];
        const z = matrix[2] * vector.x + matrix[6] * vector.y + matrix[10] * vector.z + matrix[14];
    
        return new Vec3(x, y, z);
    }

    public static multiplyVec4(matrix: Mat4x4, vector: Vec4): Vec4 {
        const x = matrix[0] * vector.x + matrix[4] * vector.y + matrix[8] * vector.z + matrix[12] * vector.w;
        const y = matrix[1] * vector.x + matrix[5] * vector.y + matrix[9] * vector.z + matrix[13] * vector.w;
        const z = matrix[2] * vector.x + matrix[6] * vector.y + matrix[10] * vector.z + matrix[14] * vector.w;
        const w = matrix[3] * vector.x + matrix[7] * vector.y + matrix[11] * vector.z + matrix[15] * vector.w;
    
        return new Vec4(x, y, z, w);
    }

    // Returns the matrix as a Float32Array in column-major order
    public static toFloat32Array(a: Mat4x4): Float32Array {
        const array = new Float32Array(16);

        // Fill the array in column-major order
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                array[col * 4 + row] = a[row * 4 + col];
            }
        }

        return array;
    }

    public static add(a: Mat4x4, b: Mat4x4): Mat4x4 {
        const m = new Mat4x4();
        for (let i = 0; i < 16; i++) {
            m[i] = a[i] + b[i];
        }
        return m;
    }

    public static rotationAxis(axis: Vec3, angle: number): Mat4x4 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const t = 1 - c;

        const x = axis.x;
        const y = axis.y;
        const z = axis.z;

        const r0c0 = t * x * x + c;
        const r0c1 = t * x * y - s * z;
        const r0c2 = t * x * z + s * y;

        const r1c0 = t * x * y + s * z;
        const r1c1 = t * y * y + c;
        const r1c2 = t * y * z - s * x;

        const r2c0 = t * x * z - s * y;
        const r2c1 = t * y * z + s * x;
        const r2c2 = t * z * z + c;

        const m = new Mat4x4();
        m.set([
            r0c0, r0c1, r0c2, 0,
            r1c0, r1c1, r1c2, 0,
            r2c0, r2c1, r2c2, 0,
            0, 0, 0, 1
        ]);

        return m;
    }

    public static transformVec4(matrix: Mat4x4, vector: Vec4): Vec4 {
        const x = matrix[0] * vector.x + matrix[4] * vector.y + matrix[8] * vector.z + matrix[12] * vector.w;
        const y = matrix[1] * vector.x + matrix[5] * vector.y + matrix[9] * vector.z + matrix[13] * vector.w;
        const z = matrix[2] * vector.x + matrix[6] * vector.y + matrix[10] * vector.z + matrix[14] * vector.w;
        const w = matrix[3] * vector.x + matrix[7] * vector.y + matrix[11] * vector.z + matrix[15] * vector.w;
    
        return new Vec4(x, y, z, w);
    }

    public static compose(translation: number[], rotation: number[], scale: number[]): Mat4x4 {
        const t = Mat4x4.translation(translation[0], translation[1], translation[2]);
        const r = Mat4x4.rotationFromQuaternion(rotation);
        const s = Mat4x4.scale(scale[0], scale[1], scale[2]);
    
        return Mat4x4.multiply(t, Mat4x4.multiply(r, s));
    }
    
    public static rotationFromQuaternion(q: number[]): Mat4x4 {
        const [x, y, z, w] = q;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        const m = new Mat4x4();

        m.set( [
            1 - (yy + zz), xy - wz, xz + wy, 0,
            xy + wz, 1 - (xx + zz), yz - wx, 0,
            xz - wy, yz + wx, 1 - (xx + yy), 0,
            0, 0, 0, 1
        ]);

        return m;
    }

    public static fromValues(
        m00: number, m01: number, m02: number, m03: number,
        m10: number, m11: number, m12: number, m13: number,
        m20: number, m21: number, m22: number, m23: number,
        m30: number, m31: number, m32: number, m33: number): Mat4x4 {
        const m = new Mat4x4();
        m.set([
            m00, m01, m02, m03,
            m10, m11, m12, m13,
            m20, m21, m22, m23,
            m30, m31, m32, m33
        ]);
        return m;
    }

    public static fromArray(array: Float32Array, offset: number = 0): Mat4x4 {
        const mat = new Mat4x4();
        for (let i = 0; i < 16; i++) {
          mat[i] = array[offset + i];
        }
        return mat;
    }

    public static fromRotationTranslationScale(m: Mat4x4, rotation: number[], translation: number[], scale: number[]): Mat4x4 {
        const [x, y, z, w] = rotation;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;
        const sx = scale[0], sy = scale[1], sz = scale[2];

        m.set([
            (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
            (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
            (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
            translation[0], translation[1], translation[2], 1
        ]);

        return m;
    }

    public static transformMat4(out: Vec3, a: Vec3, m: Mat4x4): Vec3 {
        let x = a[0], y = a[1], z = a[2];
        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        return out;
    }
}