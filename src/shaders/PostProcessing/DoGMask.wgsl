// DoG Edge Detection Mask - outputs soft edge mask for outlines
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
@group(0) @binding(2) var<uniform> texelSize: vec2<f32>;
@group(0) @binding(3) var<uniform> sigma: f32;
@group(0) @binding(4) var<uniform> scale: f32;
@group(0) @binding(5) var<uniform> radius: f32;
@group(0) @binding(6) var<uniform> threshold: f32;
@group(0) @binding(7) var<uniform> edgeSharpness: f32;

fn gaussian(dist: f32, s: f32) -> f32 {
    return exp(-0.5 * (dist * dist) / (s * s));
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var sumSmall = vec3<f32>(0.0);
    var sumLarge = vec3<f32>(0.0);
    var wSmall = 0.0;
    var wLarge = 0.0;
    let r = i32(round(radius));

    // Sample in a square neighborhood
    for (var y: i32 = -r; y <= r; y = y + 1) {
        for (var x: i32 = -r; x <= r; x = x + 1) {
            let off = vec2<f32>(f32(x), f32(y)) * texelSize;
            let dist = sqrt(f32(x * x + y * y));
            let ws = gaussian(dist, sigma);
            let wl = gaussian(dist, sigma * scale);
            let sample = textureSample(colorTexture, colorSampler, uv + off).rgb;
            sumSmall = sumSmall + sample * ws;
            sumLarge = sumLarge + sample * wl;
            wSmall = wSmall + ws;
            wLarge = wLarge + wl;
        }
    }

    // Normalize gaussian sums
    let small = sumSmall / wSmall;
    let large = sumLarge / wLarge;
    let diff = small - large;
    let strength = length(diff); // edge strength

    // Soft threshold to create mask
    //let mask = clamp((strength - threshold) * edgeSharpness + 0.5, 0.0, 1.0);
    
    // Output mask as grayscale
    //return vec4<f32>(vec3<f32>(mask), 1.0);

    let mask1 = clamp((strength - 0.1) * edgeSharpness + 0.5, 0.0, 1.0);
    let mask2 = clamp((strength - 0.3) * edgeSharpness + 0.5, 0.0, 1.0);
    let mask3 = clamp((strength - 0.6) * edgeSharpness + 0.5, 0.0, 1.0);

    // Store in RGB
    return vec4<f32>(mask1, mask2, mask3, 1.0);
}
