import { Color } from "../math/Color";
import { Vec3 } from "../math/Vec3";

export class PointLight{
    public color = new Color(1, 1, 1, 1);
    public intensity = 1;
    public position = new Vec3(0, 0, 0); 
    public attenConst = 1;
    public attenLinear = 0.1;
    public attenQuadratic = 0.032;
    public specularColor: Color = Color.white();
    public specularIntensity: number = 0;
}

export class PointLightsCollection{
    public buffer: GPUBuffer;
    public lights: PointLight[] = []
    private device: GPUDevice;

    constructor(device: GPUDevice, lightCount: number){
        this.device = device;
        const byteSize = lightCount * 16 * Float32Array.BYTES_PER_ELEMENT;
        this.buffer = device.createBuffer({
            label: "Point Lights Storage Buffer",
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        for(let i = 0; i < lightCount; i++){
            this.lights.push(new PointLight());
        }
    }    public update(){
        for (let i = 0; i < this.lights.length; i++) {
            const data = new Float32Array([
                this.lights[i].color.r, this.lights[i].color.g, this.lights[i].color.b, this.lights[i].intensity,
                this.lights[i].position.x, this.lights[i].position.y, this.lights[i].position.z, this.lights[i].attenConst, 0, 0,
                this.lights[i].attenLinear, this.lights[i].attenQuadratic, this.lights[i].specularColor.r, this.lights[i].specularColor.g, this.lights[i].specularColor.b, this.lights[i].specularIntensity
            ]);

            this.device.queue.writeBuffer(this.buffer, i * 16 * Float32Array.BYTES_PER_ELEMENT, data);   
        }
    }
}