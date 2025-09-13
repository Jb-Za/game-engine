import { Texture2D } from "../texture/Texture2D";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export interface PostProcessingEffect {
    name: string;
    shaderCode: string;
    uniforms?: { [key: string]: any };
    textures?: { [key: string]: Texture2D };
}

export interface PostProcessingOptions {
    width: number;
    height: number;
    format: GPUTextureFormat;
}

export class PostProcessing {
    private device: GPUDevice;
    private colorTexture: Texture2D;
    private normalTexture: Texture2D;
    private depthTexture: Texture2D;
    private quadVertexBuffer: GPUBuffer;
    private outputFormat: GPUTextureFormat;
    
    // Available effects
    private effects: Map<string, {
        pipeline: GPURenderPipeline;
        compositePipeline: GPURenderPipeline; // pipeline with blending enabled for parallel compositing
        bindGroups: GPUBindGroup[];
        uniformBuffers: Map<string, UniformBuffer>;
        expectedBindings: Array<{ binding: number; type: 'texture' | 'sampler' | 'uniform'; variableName: string }>;
        customTextures?: Map<string, Texture2D>; // textures provided by effect by variable name
        bindGroupLayout: GPUBindGroupLayout;
        pipelineLayout: GPUPipelineLayout;
    }> = new Map();
    
    // Active effects for parallel processing
    private activeEffects: string[] = ['passthrough'];
    private sampler: GPUSampler;

    constructor(device: GPUDevice, options: PostProcessingOptions) {
        this.device = device;
        this.outputFormat = options.format;
        
        // Create color texture for offscreen rendering
        this.colorTexture = this.createColorTexture(options.width, options.height, options.format);
        this.normalTexture = this.createAuxTexture(options.width, options.height, 'rgba8unorm');
        this.depthTexture  = this.createAuxTexture(options.width, options.height, 'rgba8unorm');
        
        // Create fullscreen quad
        this.quadVertexBuffer = this.createQuadBuffer();
        
        // Create sampler
        this.sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });

        // Add default passthrough effect
        this.addEffect({
            name: 'passthrough',
            shaderCode: this.getPassthroughShader()
        });
    }

    private createColorTexture(width: number, height: number, format: GPUTextureFormat): Texture2D {
        const texture = this.device.createTexture({
            size: { width, height },
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        
        return new Texture2D(this.device, texture);
    }

    // create auxiliary render-target that can also be sampled
    private createAuxTexture(width: number, height: number, format: GPUTextureFormat): Texture2D {
        const texture = this.device.createTexture({
            size: { width, height },
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        return new Texture2D(this.device, texture);
    }

    private createQuadBuffer(): GPUBuffer {
        // Fullscreen quad vertices (position + UV)
        const quadVertices = new Float32Array([
            -1, -1,  0, 1,  // bottom-left
             1, -1,  1, 1,  // bottom-right
            -1,  1,  0, 0,  // top-left
             1,  1,  1, 0   // top-right
        ]);

        const buffer = this.device.createBuffer({
            size: quadVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(buffer.getMappedRange()).set(quadVertices);
        buffer.unmap();
        
        return buffer;
    }

    // do no post processing, just pass through the texture
    private getPassthroughShader(): string {
        return `
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) uv: vec2<f32>
            }

            @vertex
            fn vs_main(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>) -> VertexOutput {
                var output: VertexOutput;
                output.position = vec4<f32>(position, 0.0, 1.0);
                output.uv = uv;
                return output;
            }

            @group(0) @binding(0) var colorTexture : texture_2d<f32>;
            @group(0) @binding(1) var colorSampler : sampler;

            @fragment
            fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
                return textureSample(colorTexture, colorSampler, uv);
            }
        `;
    }

    public addEffect(effect: PostProcessingEffect): void {
        const shaderModule = this.device.createShaderModule({
            code: effect.shaderCode,
        });

        // Parse the shader to find all expected bindings with their variable names
        const expectedBindings = this.parseShaderBindings(effect.shaderCode);
        // Create uniform buffers for this effect
        const uniformBuffers = new Map<string, UniformBuffer>();
        const bindGroupEntries: GPUBindGroupEntry[] = [];

        // Create uniform buffers for all uniforms in the effect definition
        if (effect.uniforms) {
            for (const [name, value] of Object.entries(effect.uniforms)) {
                const buffer = new UniformBuffer(this.device, value, `${effect.name}_${name}`);
                uniformBuffers.set(name, buffer);
            }
        }

        // Allow custom textures to be referenced by variable name (if provided)
        const customTextures = new Map<string, Texture2D>();
        if (effect.textures) {
            for (const [name, tex] of Object.entries(effect.textures)) {
                customTextures.set(name, tex);
            }
        }

        // Bind strictly what the shader expects, by binding index and variable name
        for (const binding of expectedBindings.sort((a, b) => a.binding - b.binding)) {
            if (binding.type === 'texture') {
                let view: GPUTextureView | undefined;
                // map by common variable names first
                if (binding.variableName === 'colorTexture') {
                    view = this.colorTexture.texture.createView();
                } else if (binding.variableName === 'normalTexture') {
                    view = this.normalTexture.texture.createView();
                } else if (binding.variableName === 'depthTexture') {
                    view = this.depthTexture.texture.createView();
                } else if (customTextures.has(binding.variableName)) {
                    view = customTextures.get(binding.variableName)!.texture.createView();
                }
                if (!view) {
                    console.error(`Effect '${effect.name}': Missing required texture for binding ${binding.binding} (${binding.variableName}).`);
                } else {
                    bindGroupEntries.push({ binding: binding.binding, resource: view });
                }
            } else if (binding.type === 'sampler') {
                bindGroupEntries.push({ binding: binding.binding, resource: this.sampler });
            } else if (binding.type === 'uniform') {
                const uniformBuffer = uniformBuffers.get(binding.variableName);
                if (uniformBuffer) {
                    bindGroupEntries.push({ binding: binding.binding, resource: { buffer: uniformBuffer.buffer } });
                } else {
                    console.error(`Effect '${effect.name}': Missing required uniform '${binding.variableName}' for binding ${binding.binding}.`);
                }
            }
        }

        // Ensure we have exactly the entries the layout expects
        if (bindGroupEntries.length !== expectedBindings.length) {
            console.error(`Effect '${effect.name}': Bind group entries (${bindGroupEntries.length}) do not match expected (${expectedBindings.length}). Effect will not be registered.`);
            return;
        }

        // Build an explicit bind group layout and pipeline layout based on expected bindings
        const bglEntries: GPUBindGroupLayoutEntry[] = expectedBindings.map(b => {
            if (b.type === 'texture') {
                return {
                    binding: b.binding,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float', viewDimension: '2d', multisampled: false }
                } as GPUBindGroupLayoutEntry;
            } else if (b.type === 'sampler') {
                return {
                    binding: b.binding,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                } as GPUBindGroupLayoutEntry;
            } else {
                return {
                    binding: b.binding,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                } as GPUBindGroupLayoutEntry;
            }
        });
        const bindGroupLayout = this.device.createBindGroupLayout({ entries: bglEntries });
        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        // Create two pipelines: base (no blending) and composite (with blending enabled)
        const basePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 4 * 4,
                    attributes: [
                        { format: 'float32x2', offset: 0, shaderLocation: 0 },
                        { format: 'float32x2', offset: 8, shaderLocation: 1 }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.outputFormat }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        const compositePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 4 * 4,
                    attributes: [
                        { format: 'float32x2', offset: 0, shaderLocation: 0 },
                        { format: 'float32x2', offset: 8, shaderLocation: 1 }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.outputFormat,
                    blend: {
                        color: { srcFactor: 'constant', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'constant', dstFactor: 'one', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-strip' }
        });

        const bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: bindGroupEntries
        });
        
        this.effects.set(effect.name, {
            pipeline: basePipeline,
            compositePipeline: compositePipeline,
            bindGroups: [bindGroup],
            uniformBuffers,
            expectedBindings,
            customTextures: customTextures.size ? customTextures : undefined,
            bindGroupLayout,
            pipelineLayout
        });
    }

    private parseShaderBindings(shaderCode: string): Array<{binding: number, type: 'texture' | 'sampler' | 'uniform', variableName: string}> {
        const bindings: Array<{binding: number, type: 'texture' | 'sampler' | 'uniform', variableName: string}> = [];
        // capture optional storage class (e.g., <uniform>) to correctly identify uniforms
        const bindingRegex = /@group\(0\)\s*@binding\((\d+)\)\s*var(?:<([^>]+)>)?\s+(\w+)\s*:\s*([^;]+)/g;
        let match: RegExpExecArray | null;
        while ((match = bindingRegex.exec(shaderCode)) !== null) {
            const bindingNumber = parseInt(match[1]);
            const storageClass = (match[2] || '').trim();
            const variableName = match[3];
            const declaredType = match[4].trim();

            let type: 'texture' | 'sampler' | 'uniform';
            if (declaredType.includes('texture_2d')) {
                type = 'texture';
            } else if (declaredType.includes('sampler')) {
                type = 'sampler';
            } else if (storageClass.includes('uniform')) {
                type = 'uniform';
            } else {
                // Default to uniform if storage class says so or unrecognized
                type = storageClass.includes('uniform') ? 'uniform' : 'uniform';
            }
            bindings.push({ binding: bindingNumber, type, variableName });
        }
        return bindings;
    }

    // Set single effect or multiple effects for parallel processing
    public setEffect(effectNames: string | string[]): boolean {
        const effects = Array.isArray(effectNames) ? effectNames : [effectNames];
        
        // Validate all effects exist
        for (const effectName of effects) {
            if (!this.effects.has(effectName)) {
                console.warn(`Effect '${effectName}' not found`);
                return false;
            }
        }
        
        this.activeEffects = effects;
        return true;
    }

    public updateUniform(effectName: string, uniformName: string, value: any): boolean {
        const effect = this.effects.get(effectName);
        if (effect && effect.uniformBuffers.has(uniformName)) {
            effect.uniformBuffers.get(uniformName)!.update(value);
            return true;
        }
        return false;
    }

    public getColorTexture(): Texture2D {
        return this.colorTexture;
    }

    public getNormalTexture(): Texture2D {
        return this.normalTexture;
    }

    public getDepthTextureAsColor(): Texture2D {
        return this.depthTexture;
    }
    
    
    public resize(width: number, height: number, format: GPUTextureFormat): void {
        // Recreate color texture with new dimensions
        this.colorTexture = this.createColorTexture(width, height, format);
        this.normalTexture = this.createAuxTexture(width, height, 'rgba8unorm');
        this.depthTexture = this.createAuxTexture(width, height, 'rgba8unorm');

        // Recreate bind groups for all effects to use new textures strictly matching original shader bindings
        for (const effect of this.effects.values()) {
            const entries: GPUBindGroupEntry[] = [];
            for (const b of effect.expectedBindings.sort((a, b) => a.binding - b.binding)) {
                if (b.type === 'texture') {
                    let view: GPUTextureView | undefined;
                    if (b.variableName === 'colorTexture') {
                        view = this.colorTexture.texture.createView();
                    } else if (b.variableName === 'normalTexture') {
                        view = this.normalTexture.texture.createView();
                    } else if (b.variableName === 'depthTexture') {
                        view = this.depthTexture.texture.createView();
                    } else if (effect.customTextures && effect.customTextures.has(b.variableName)) {
                        view = effect.customTextures.get(b.variableName)!.texture.createView();
                    }
                    if (!view) {
                        console.warn(`On resize: missing texture for binding ${b.binding} (${b.variableName}).`);
                        continue;
                    }
                    entries.push({ binding: b.binding, resource: view });
                } else if (b.type === 'sampler') {
                    entries.push({ binding: b.binding, resource: this.sampler });
                } else {
                    const ub = effect.uniformBuffers.get(b.variableName);
                    if (ub) entries.push({ binding: b.binding, resource: { buffer: ub.buffer } });
                }
            }
            effect.bindGroups[0] = this.device.createBindGroup({
                layout: effect.bindGroupLayout,
                entries
            });
        }
    }

    public render(renderPassEncoder: GPURenderPassEncoder): void {
        if (this.activeEffects.length === 1) {
            // Single effect - render directly
            this.renderSingleEffect(renderPassEncoder, this.activeEffects[0]);
        } else {
            // Multiple effects - render with averaging blend using blend constant
            this.renderParallelEffects(renderPassEncoder);
        }
    }

    private renderSingleEffect(renderPassEncoder: GPURenderPassEncoder, effectName: string): void {
        const effect = this.effects.get(effectName);
        if (!effect) return;

        renderPassEncoder.setPipeline(effect.pipeline);
        renderPassEncoder.setBindGroup(0, effect.bindGroups[0]);
        renderPassEncoder.setVertexBuffer(0, this.quadVertexBuffer);
        renderPassEncoder.draw(4);
    }

    private renderParallelEffects(renderPassEncoder: GPURenderPassEncoder): void {
        const n = Math.max(1, this.activeEffects.length);
        // average the outputs of all active effects: sum(effects) * (1/n)
        // requires composite pipelines with blend using constant factor
        renderPassEncoder.setBlendConstant({ r: 1 / n, g: 1 / n, b: 1 / n, a: 1 / n });

        for (let i = 0; i < this.activeEffects.length; i++) {
            const effect = this.effects.get(this.activeEffects[i]);
            if (!effect) continue;
            renderPassEncoder.setPipeline(effect.compositePipeline);
            renderPassEncoder.setBindGroup(0, effect.bindGroups[0]);
            renderPassEncoder.setVertexBuffer(0, this.quadVertexBuffer);
            renderPassEncoder.draw(4);
        }
    }

    public dispose(): void {
        // Clean up resources
        this.quadVertexBuffer.destroy();
    }
}