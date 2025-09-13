struct VSInput 
{
    @location(0) position: vec3f, 
    @location(1) color: vec4f, 
    @location(2) texCoord: vec2f,
    @location(3) normal: vec3f,
}

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(1) color: vec4f,
    @location(2) texCoord: vec2f,
    @location(3) normal: vec3f,
    @location(4) fragPos: vec3f,
    @location(5) eye: vec3f,
    @location(6) lightSpaceFragmentPos: vec4f,
    @location(7) worldPos: vec3f,
}

@group(0) @binding(0)
var<uniform> transform: array<mat4x4f, 1>;

@group(0) @binding(1)
var<uniform> normalMatrix: array<mat3x3f, 1>;

// Combined water parameters to reduce uniform buffer count
@group(0) @binding(2)
var<uniform> waterParams: vec4f; // x: time, y: texTilingX, z: texTilingY, w: unused

@group(0) @binding(3)
var<uniform> waveParams: vec4f; // x: speed, y: height, z: frequency, w: scale

@group(1) @binding(0)
var<uniform> projectionView: mat4x4f;
@group(1) @binding(1)
var<uniform> eye: vec3f;
@group(1) @binding(2)
var<uniform> lightSpaceProjectionView: mat4x4f;

@vertex 
fn waterVS(
    in: VSInput,
    @builtin(vertex_index) vid: u32, 
    @builtin(instance_index) iid: u32,
) -> VSOutput
{
    var out : VSOutput;
    
    // Get world position before wave displacement
    let worldPos = (transform[iid] * vec4f(in.position, 1.0)).xyz;
    out.worldPos = worldPos;
    
    // Calculate wave displacement
    let time = waterParams.x;
    let texTiling = vec2f(waterParams.y, waterParams.z);
    let waveSpeed = waveParams.x;
    let waveHeight = waveParams.y;
    let waveFreq = waveParams.z;
    let waveScale = waveParams.w;
    
    // Multiple wave layers for more realistic water
    let wave1 = sin(worldPos.x * waveFreq + time * waveSpeed) * waveHeight;
    let wave2 = sin(worldPos.z * waveFreq * 0.7 + time * waveSpeed * 1.2) * waveHeight * 0.5;
    let wave3 = sin((worldPos.x + worldPos.z) * waveFreq * 1.3 + time * waveSpeed * 0.8) * waveHeight * 0.3;
    
    let totalWaveHeight = wave1 + wave2 + wave3;
    
    // Apply wave displacement to vertex position
    var displacedPos = in.position;
    displacedPos.y += totalWaveHeight;
    
    // Transform to clip space
    out.position = projectionView * transform[iid] * vec4f(displacedPos, 1.0);
    out.color = in.color;
    
    // Animate texture coordinates for flowing effect
    let flowSpeed = 0.1;
    let animatedTexCoord = in.texCoord + vec2f(time * flowSpeed, time * flowSpeed * 0.7);
    out.texCoord = animatedTexCoord * texTiling;
    
    // Calculate normal with wave influence for lighting
    let normalOffset = 0.1;
    let dx = cos(worldPos.x * waveFreq + time * waveSpeed) * waveHeight * waveFreq;
    let dz = cos(worldPos.z * waveFreq * 0.7 + time * waveSpeed * 1.2) * waveHeight * 0.5 * waveFreq * 0.7;
    
    let waveNormal = normalize(vec3f(-dx, 1.0, -dz));
    out.normal = normalMatrix[iid] * waveNormal;
    
    out.fragPos = (transform[iid] * vec4f(displacedPos, 1.0)).xyz;
    out.eye = eye;
    out.lightSpaceFragmentPos = lightSpaceProjectionView * vec4f(out.fragPos, 1.0);
    
    return out;
}

struct AmbientLight{
    @location(0) color: vec3f, 
    @location(1) intensity: f32, 
};

struct DirectionalLight{
    @location(0) color: vec3f, 
    @location(1) intensity: f32, 
    @location(2) direction: vec3f, 
    @location(3) _discard: f32, 
    @location(4) specularColor: vec3f, 
    @location(5) specularIntensity: f32, 
};

struct PointLight{
    @location(0) color: vec3f, 
    @location(1) intensity: f32, 
    @location(2) position: vec3f, 
    @location(3) attenConst: f32, 
    @location(4) attenLin: f32, 
    @location(5) attenQuad: f32, 
    @location(6) _discard: vec2f, 
    @location(7) specularColor: vec3f, 
    @location(8) specularIntensity: f32, 
};

@group(2) @binding(0)
var diffuseTexture: texture_2d<f32>;
@group(2) @binding(1)
var diffuseTexSampler: sampler;
@group(2) @binding(2)
var<uniform> diffuseColor: vec4f;
@group(2) @binding(3)
var<uniform> shininess: f32;
@group(2) @binding(4)
var shadowTexture: texture_depth_2d;
@group(2) @binding(5)
var shadowSampler: sampler_comparison;

@group(3) @binding(0)
var<uniform> ambientLight: AmbientLight;
@group(3) @binding(1)
var<uniform> directionalLight: DirectionalLight;
@group(3) @binding(2)
var<storage, read> positionalLight: array<PointLight>;
@group(3) @binding(3)
var<uniform> numPointLights: f32;

@fragment 
fn waterFS(in: VSOutput) -> @location(0) vec4f
{
    let texColor = textureSample(diffuseTexture, diffuseTexSampler, in.texCoord);
    
    // Enhanced water-specific fragment shading
    let viewDir = normalize(in.eye - in.fragPos);
    let normal = normalize(in.normal);
    
    // Fresnel effect - more reflective at grazing angles
    let fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.0);
    
    // Base water color with some variation
    let baseWaterColor = diffuseColor.rgb;
    let depthColor = baseWaterColor * 0.5; // Darker water in "deeper" areas
    
    // Mix base color with texture
    var finalColor = mix(baseWaterColor, texColor.rgb, 0.3);
    
    // Add foam effect at wave peaks (98% of max height)
    let time = waterParams.x;
    let waveSpeed = waveParams.x;
    let waveHeight = waveParams.y;
    let waveFreq = waveParams.z;
    
    // Calculate the same wave displacement as in vertex shader
    let wave1 = sin(in.worldPos.x * waveFreq + time * waveSpeed) * waveHeight;
    let wave2 = sin(in.worldPos.z * waveFreq * 0.7 + time * waveSpeed * 1.2) * waveHeight * 0.5;
    let wave3 = sin((in.worldPos.x + in.worldPos.z) * waveFreq * 1.3 + time * waveSpeed * 0.8) * waveHeight * 0.3;
    let totalWaveHeight = wave1 + wave2 + wave3;
    
    // Maximum possible wave height (sum of all wave amplitudes)
    let maxWaveHeight = waveHeight + (waveHeight * 0.5) + (waveHeight * 0.3);
    
    // Create foam when wave reaches 98% of maximum height
    let foamThreshold = maxWaveHeight * 0.92;
    let foam = step(foamThreshold, totalWaveHeight) * 0.4; // Slightly more intense foam
    finalColor += foam;
    
    // Simple ambient lighting
    let ambient = ambientLight.color * ambientLight.intensity;
    finalColor *= ambient;
    
    // Simple directional lighting
    let lightDir = normalize(-directionalLight.direction);
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = directionalLight.color * directionalLight.intensity * diff;
    finalColor += diffuse * 0.5;
    
    // Apply transparency with fresnel
    let alpha = mix(diffuseColor.a, 1.0, fresnel * 0.3);
    
    return vec4f(finalColor, alpha);
}
