// Vertex attributes: position, normal, texcoord, joints, weights
// Note: VertexOutput struct is dynamically generated in GLTFPrimitive.ts

struct GeneralUniforms {
    render_mode: u32,
    skin_mode: u32,
}

struct NodeUniforms { 
    world_matrix: mat4x4f,
}

struct AmbientLight{
    color: vec3f, 
    intensity: f32, 
}

struct DirectionalLight{
    color: vec3f, 
    intensity: f32, 
    direction: vec3f, 
    _discard: f32, 
    specularColor: vec3f, 
    specularIntensity: f32, 
}

struct PointLight{
    color: vec3f, 
    intensity: f32, 
    position: vec3f, 
    attenConst: f32, 
    attenLin: f32, 
    attenQuad: f32, 
    _discard: vec2f, 
    specularColor: vec3f, 
    specularIntensity: f32, 
}

@group(0) @binding(0) var<uniform> projectionView: mat4x4f;
@group(0) @binding(1) var<uniform> eye: vec3f;
@group(0) @binding(2) var<uniform> lightSpaceProjectionView: mat4x4f;
@group(1) @binding(0) var<uniform> general_uniforms: GeneralUniforms;
@group(2) @binding(0) var<uniform> node_uniforms: NodeUniforms;
@group(3) @binding(0) var baseColorTexture: texture_2d<f32>;
@group(3) @binding(1) var baseColorSampler: sampler;
@group(3) @binding(2) var<storage, read> joint_matrices: array<mat4x4f>;
@group(3) @binding(3) var<storage, read> inverse_bind_matrices: array<mat4x4f>;
@group(3) @binding(4) var<uniform> diffuseColor: vec4f;
@group(3) @binding(5) var<uniform> shininess: f32;
@group(3) @binding(6) var shadowTexture: texture_depth_2d;
@group(3) @binding(7) var shadowSampler: sampler_comparison;
@group(3) @binding(8) var<uniform> ambientLight: AmbientLight;
@group(3) @binding(9) var<uniform> directionalLight: DirectionalLight;
@group(3) @binding(10) var<uniform> positionalLight: array<PointLight, 3>;

const MAX_JOINTS_PER_VERTEX = 4u;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Handle different render modes
    switch general_uniforms.render_mode {        case 1: {
            // UV coordinates or joint indices visualization for skinned models
            return input.joints;
        }
        case 2: {
            // Texture rendering or weights visualization for skinned models
            return textureSample(baseColorTexture, baseColorSampler, input.texcoord);
        }
        case 3: {
            // Full lighting calculation for lit skinned models
            // Shadows
            var shadowCoords = input.lightSpaceFragmentPos.xyz / input.lightSpaceFragmentPos.w;
            var shadowTextureCoords = shadowCoords.xy * 0.5 + 0.5;
            shadowTextureCoords.y = 1.0 - shadowTextureCoords.y;
            var shadow = textureSampleCompare(shadowTexture, shadowSampler, shadowTextureCoords, shadowCoords.z - 0.05);            // Vector toward the eye
            var toEye = normalize(input.eye - input.fragPos);

            // Ambient Light 
            var lightAmount = ambientLight.color * ambientLight.intensity;

            // Diffuse Light
            var normal = normalize(input.normal);
            var lightDir = normalize(-directionalLight.direction);
            var dotLight = max(dot(normal, lightDir), 0.0);
            
            // Apply shadow only if we're within shadow map bounds, otherwise use full directional lighting
            var shadowFactor = 1.0;
            if (shadowTextureCoords.x >= 0.0 && shadowTextureCoords.x <= 1.0 && 
                shadowTextureCoords.y >= 0.0 && shadowTextureCoords.y <= 1.0) {
                shadowFactor = shadow;
            }
            
            lightAmount += directionalLight.color * directionalLight.intensity * dotLight * shadowFactor;


            // Specular Light
            var halfVector = normalize(lightDir + toEye);
            var dotSpecular = max(dot(normal, halfVector), 0.0);
            dotSpecular = pow(dotSpecular, shininess);
            lightAmount += directionalLight.color * dotSpecular * directionalLight.specularIntensity * shadow;

            // Point lights
            for(var i = 0; i < 3; i++) {
                var lightDir = normalize(positionalLight[i].position - input.fragPos);
                var dotLight = max(dot(normal, lightDir), 0.0);
                
                var distance = length(positionalLight[i].position - input.fragPos);
                var attenuation = positionalLight[i].attenConst + 
                    positionalLight[i].attenLin * distance + 
                    positionalLight[i].attenQuad * distance * distance;
                attenuation = 1.0 / attenuation;

                lightAmount += positionalLight[i].color * positionalLight[i].intensity * dotLight * attenuation * shadow;

                // Specular Light for point lights
                halfVector = normalize(lightDir + toEye);
                dotSpecular = max(dot(normal, halfVector), 0.0);
                dotSpecular = pow(dotSpecular, shininess);
                lightAmount += positionalLight[i].specularColor * positionalLight[i].specularIntensity * dotSpecular * attenuation * shadow;
            }

            var color = textureSample(baseColorTexture, baseColorSampler, input.texcoord) * diffuseColor;
            color = color * vec4f(lightAmount, 1.0);
            return color;
        }
        default: {
            // Normal visualization (default)
            return vec4f(input.normal * 0.5 + 0.5, 1.0);
        }
    }
}
