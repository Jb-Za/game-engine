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
@group(0) @binding(2) var<uniform> intensity: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
let color = textureSample(colorTexture, colorSampler, uv);
let sepia = mat3x3<f32>(
    0.393, 0.349, 0.272,
    0.769, 0.686, 0.534,
    0.189, 0.168, 0.131
);
let sepiaColor = sepia * color.rgb;
let finalColor = mix(color.rgb, sepiaColor, intensity);
return vec4<f32>(finalColor, color.a);
}