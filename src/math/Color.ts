export class Color  extends Float32Array
{
    constructor(r: number = 1, g: number = 1, b: number = 1, a: number = 1)
    {
        super(4);   

        this[0] = r;
        this[1] = g;
        this[2] = b;
        this[3] = a;
    }

    public get r(): number
    {
        return this[0];
    }

    public set r(value: number)
    {
        this[0] = value;
    }

    public get g(): number
    {
        return this[1];
    }

    public set g(value: number)
    {
        this[1] = value;
    }

    public get b(): number
    {
        return this[2];
    }

    public set b(value: number)
    {
        this[2] = value;
    }

    public get a(): number
    {
        return this[3];
    }

    public set a(value: number)
    {
        this[3] = value;
    }

    public static red(): Color 
    {
        return new Color(1, 0, 0, 1);
    }

    public static white(): Color 
    {
        return new Color(1, 1, 1, 1);
    }

    public static black(): Color 
    {
        return new Color(0, 0, 0, 1);
    }

    public static green(): Color 
    {
        return new Color(0, 1, 0, 1);
    }

    public static blue(): Color 
    {
        return new Color(0, 0, 1, 1);
    }

    public static yellow(): Color 
    {
        return new Color(1, 1, 0, 1);
    }

    public static lightBlue(): Color 
    {
        return new Color(0.678, 0.847, 0.902, 1);
    }

    public static lightGreen(): Color 
    {
        return new Color(0.564, 0.933, 0.564, 1);
    }

    public static pink(): Color 
    {
        return new Color(1, 0.753, 0.796, 1);
    }

    public static gray(): Color 
    {
        return new Color(0.5, 0.5, 0.5, 1);
    }

    public static fromHex(hex: string): Color 
    {
        const bigint = parseInt(hex.replace('#', ''), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return new Color(r / 255, g / 255, b / 255, 1);
    }
}