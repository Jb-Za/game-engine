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

@group(0) @binding(0) var colorTexture: texture_2d<f32>;
@group(0) @binding(1) var colorSampler: sampler;
@group(0) @binding(2) var<uniform> blurRadius: f32;
@group(0) @binding(3) var<uniform> texelSize: vec2<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var color = vec4<f32>(0.0);
    let radius = i32(blurRadius);
    var totalWeight = 0.0;
    
    for (var x = -radius; x <= radius; x++) {
        for (var y = -radius; y <= radius; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            let weight = exp(-0.5 * (f32(x * x + y * y)) / (blurRadius * blurRadius));
            color += textureSample(colorTexture, colorSampler, uv + offset) * weight;
            totalWeight += weight;
        }
    }
    
    return color / totalWeight;
}