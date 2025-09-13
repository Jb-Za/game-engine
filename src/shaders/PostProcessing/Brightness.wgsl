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
@group(0) @binding(2) var<uniform> brightness: f32;
@group(0) @binding(3) var<uniform> contrast: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(colorTexture, colorSampler, uv);
    let adjusted = (color.rgb - 0.5) * contrast + 0.5 + brightness;
    return vec4<f32>(clamp(adjusted, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
}