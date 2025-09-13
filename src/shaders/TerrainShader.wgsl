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
}

@group(0) @binding(0)
var<uniform> transform: array<mat4x4f, 1>;

@group(0) @binding(1)
var<uniform> normalMatrix: array<mat3x3f, 1>;

@group(0) @binding(2)
var<uniform> texturetiling: vec2f;

@group(1) @binding(0)
var<uniform> projectionView: mat4x4f;
@group(1) @binding(1)
var<uniform> eye: vec3f;
@group(1) @binding(2)
var<uniform> lightSpaceProjectionView: mat4x4f;

@vertex 
fn materialVS(
    in: VSInput,

    // builtins 
    @builtin(vertex_index) vid: u32, 
    @builtin(instance_index) iid: u32,
) -> VSOutput
{
    var out : VSOutput;
    out.position = projectionView * transform[iid] * vec4f(in.position, 1.0);
    out.color = in.color;
    out.texCoord = in.texCoord * texturetiling; 
    out.normal = normalMatrix[iid] * in.normal;
    out.fragPos = (transform[iid] * vec4f(in.position, 1.0)).xyz;
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

// Blending data structure for smooth terrain transitions
struct BlendingData {
    result: vec4f,
    height: f32
}

// Blend layer function for smooth height-based transitions
fn blendLayer(layer: vec4f, layerHeight: f32, bd: BlendingData, blendSharpness: f32) -> BlendingData {
    var result = bd;
    result.height = max(0.0, bd.height - layerHeight);
    let t = min(1.0, result.height * blendSharpness);
    result.result = mix(bd.result, layer, t);
    return result;
}


@fragment
fn materialFS(in : VSOutput) -> @location(0) vec4f
{
    //Shadows
    // do perspective divide. divide by w to allow for perspective.... closer = bigger. w can = 0.1. so the fragment scales up.
    var shadowCoords = in.lightSpaceFragmentPos.xyz / in.lightSpaceFragmentPos.w;

    // transform to [0,1] range
    var shadowTextureCoords = shadowCoords.xy * 0.5 + 0.5;
    shadowTextureCoords.y = 1.0 - shadowTextureCoords.y;
    
    var shadow = textureSampleCompare(shadowTexture, shadowSampler, shadowTextureCoords, shadowCoords.z - 0.01); //0.01 is a bias. have yo play with this value

    //vector toward the eye
    var toEye = normalize(in.eye - in.fragPos);

   // Ambient Light 
    var lightAmount = ambientLight.color * ambientLight.intensity;

    // Diffuse Light
    var normal = normalize(in.normal);
    var lightDir = normalize(-directionalLight.direction);
    var dotLight = max(dot(normal, lightDir), 0.0);
    lightAmount += directionalLight.color * directionalLight.intensity * dotLight * shadow;

    // Specular Light
    var halfVector = normalize(lightDir + toEye);
    var dotSpecular = max(dot(normal, halfVector), 0.0);
    dotSpecular = pow(dotSpecular, shininess);
    lightAmount += directionalLight.color * dotSpecular * directionalLight.intensity * shadow;

    // Point lights
    for(var i: u32 = 0u; i < u32(numPointLights); i = i + 1u)
    {
        var lightDir = normalize(positionalLight[i].position - in.fragPos);
        var dotLight = max(dot(normal, lightDir), 0.0);
        

        var distance = length(positionalLight[i].position - in.fragPos);
        var attenuation = positionalLight[i].attenConst + 
        positionalLight[i].attenLin * distance + 
        positionalLight[i].attenQuad * distance * distance;

        attenuation = 1.0 / attenuation;

        lightAmount += positionalLight[i].color * positionalLight[i].intensity * dotLight * attenuation * shadow;

        //specular Light
        halfVector = normalize(lightDir + toEye);
        dotSpecular = max(dot(normal, halfVector), 0.0);
        dotSpecular = pow(dotSpecular, shininess);
        lightAmount += positionalLight[i].specularIntensity * dotSpecular * positionalLight[i].specularIntensity * shadow;

    }

    // Height-based smooth terrain blending
    let height = in.fragPos.y;
    let blendSharpness = 0.5; // Controls transition sharpness (lower = softer)
    
    // Sample base texture
    let baseTexture = textureSample(diffuseTexture, diffuseTexSampler, in.texCoord) * in.color * diffuseColor;
    
    // Initialize blending data with deepest layer (deep water)
    var bd = BlendingData(vec4f(0.0, 0.1, 0.4, 1.0) * baseTexture, height);
    
    // Layer blend progression from bottom to top
    // Each layer blends smoothly based on height difference
    bd = blendLayer(vec4f(0.2, 0.4, 0.8, 1.0) * baseTexture, -1.0, bd, blendSharpness);   // Shallow water
    bd = blendLayer(vec4f(0.9, 0.8, 0.6, 1.0) * baseTexture, 5.0, bd, blendSharpness);   // Beach/sand
    bd = blendLayer(vec4f(0.2, 0.7, 0.2, 1.0) * baseTexture, 6.0, bd, blendSharpness);  // Grass
    bd = blendLayer(vec4f(0.1, 0.5, 0.1, 1.0) * baseTexture, 8.0, bd, blendSharpness);  // Forest
    bd = blendLayer(vec4f(0.5, 0.5, 0.5, 1.0) * baseTexture, 10.0, bd, blendSharpness);  // Rock
    bd = blendLayer(vec4f(0.9, 0.9, 1.0, 1.0) * baseTexture, 12.0, bd, blendSharpness);  // Snow
    
    // Apply lighting to final blended color
    var color = bd.result * vec4f(lightAmount, 1.0);
    //var color =  baseTexture * vec4f(lightAmount, 1.0);

    return color;
}