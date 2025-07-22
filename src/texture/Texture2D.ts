export class Texture2D {
    public texture!: GPUTexture;
    public sampler!: GPUSampler;

    constructor(private device: GPUDevice, texture: GPUTexture | null = null) {
        if (texture) {
            this.texture = texture;
        }
    }

    public static async create(device: GPUDevice, image: HTMLImageElement, isColorTexture: boolean = true) {
        const texture = new Texture2D(device);
        const format = isColorTexture ? "rgba8unorm-srgb" : "rgba8unorm";
        await texture.initialize(image, format);
        return texture;
    }

    public static createEmpty(device: GPUDevice, isColorTexture: boolean = true): Texture2D {
        const texture = new Texture2D(device);
        // Use sRGB format for color textures, linear format for non-color data
        const format = isColorTexture ? "rgba8unorm-srgb" : "rgba8unorm";
        texture.initializeFromDataSync(new Uint8Array([255, 255, 255, 255]), 1, 1, format);
        return texture;
    }

    private createTextureAndSampler(width: number, height: number, format: GPUTextureFormat = "rgba8unorm") {
        this.texture = this.device.createTexture({
            size: { width, height },
            format: format,
            usage: GPUTextureUsage.COPY_DST
                | GPUTextureUsage.TEXTURE_BINDING
                | GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.sampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
        });
    }
    
    public async initialize(image: HTMLImageElement, format: GPUTextureFormat = "rgba8unorm-srgb") {
        this.createTextureAndSampler(image.width, image.height, format);

        const imageBitmap = await createImageBitmap(image);

        this.device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture: this.texture },
            { width: image.width, height: image.height }
        );
    }

    public static createDepthTexture(device: GPUDevice, width: number, height: number) {
        const depthTexture: GPUTexture = device.createTexture({
            label: "Depth Texture",
            size: {
                width: width,
                height: height
            },
            format: "depth32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        return new Texture2D(device, depthTexture);
    }

    public static createShadowTexture(device: GPUDevice, width: number, height: number) {
        const depthTexture: GPUTexture = device.createTexture({
            label: "Shadow Map Depth Texture",
            size: {
                width: width,
                height: height
            },
            format: "depth32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
        });

        const texture = new Texture2D(device, depthTexture);
        texture.sampler = device.createSampler(
            {
                compare: "less-equal",
            }
        )
        return texture;
    }

    public initializeFromDataSync(data: ArrayBuffer, width: number, height: number, format: GPUTextureFormat = "rgba8unorm") {
        this.createTextureAndSampler(width, height, format);

        this.device.queue.writeTexture(
            { texture: this.texture },
            data,
            {},
            { width, height }
        );
    }
}