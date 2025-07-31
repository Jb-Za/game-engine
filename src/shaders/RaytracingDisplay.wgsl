@group(0) @binding(0)
var rayTracedTexture: texture_2d<f32>;

@group(0) @binding(1)
var textureSampler: sampler;

// Generate fullscreen triangle without vertex buffer
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f(3.0, -1.0),
        vec2f(-1.0, 3.0)
    );
    var out: VertexOutput;
    out.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    out.uv = vec2f((pos[vertexIndex].x + 1.0) * 0.5, 1.0 - (pos[vertexIndex].y + 1.0) * 0.5);
    return out;
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
    let color = textureSample(rayTracedTexture, textureSampler, uv);
    return color;
}