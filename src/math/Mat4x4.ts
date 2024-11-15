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
}