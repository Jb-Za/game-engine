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
@group(0) @binding(8) var hatchTexture: texture_2d<f32>;
@group(0) @binding(9) var hatchSampler: sampler;

fn gaussian(dist: f32, s: f32) -> f32 {
    return exp(-0.5 * (dist * dist) / (s * s));
}

fn luminance(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Sample original color
    let originalColor = textureSample(colorTexture, colorSampler, uv).rgb;
    
    // Compute Difference of Gaussians for edge detection
    var sumSmall = vec3<f32>(0.0);
    var sumLarge = vec3<f32>(0.0);
    var wSmall = 0.0;
    var wLarge = 0.0;
    let r = i32(round(radius));

    // iterate over a (2r+1)x(2r+1) neighborhood
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

    // normalize
    let small = sumSmall / wSmall;
    let large = sumLarge / wLarge;
    let diff = small - large;
    let edgeStrength = length(diff);
    
    // Convert original color to luminance for tone mapping
    let lum = luminance(originalColor);
    
    // Create multiple hatch density levels based on luminance and edge strength
    let hatchScale1 = 8.0;   // Fine hatching
    let hatchScale2 = 4.0;   // Medium hatching  
    let hatchScale3 = 2.0;   // Coarse hatching
    
    // Sample hatching texture at different scales
    let hatchUV1 = uv * hatchScale1;
    let hatchUV2 = uv * hatchScale2;
    let hatchUV3 = uv * hatchScale3;
    
    let hatch1 = textureSample(hatchTexture, hatchSampler, hatchUV1).r;
    let hatch2 = textureSample(hatchTexture, hatchSampler, hatchUV2).r;
    let hatch3 = textureSample(hatchTexture, hatchSampler, hatchUV3).r;
    
    // Determine hatch intensity based on luminance
    var hatchIntensity = 1.0;
    
    // Dark areas get heavy hatching
    if (lum < 0.3) {
        hatchIntensity = min(hatch1 * hatch2 * hatch3, 1.0);
    }
    // Medium areas get medium hatching  
    else if (lum < 0.6) {
        hatchIntensity = min(hatch1 * hatch2, 1.0);
    }
    // Light areas get fine hatching
    else if (lum < 0.8) {
        hatchIntensity = hatch1;
    }
    // Very light areas get no hatching
    
    // Apply edge enhancement
    let edgeMask = clamp((edgeStrength - threshold) * edgeSharpness + 0.5, 0.0, 1.0);
    
    // Blend hatching with original image
    // Stronger hatching in darker areas and along edges
    let hatchStrength = (1.0 - lum) * 0.8 + edgeMask * 0.4;
    let finalColor = mix(originalColor, originalColor * hatchIntensity, hatchStrength);
    
    return vec4<f32>(finalColor, 1.0);
}