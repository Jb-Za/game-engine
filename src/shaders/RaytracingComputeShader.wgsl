struct Sphere {
    center: vec3f,            
    radius: f32,        
    color: vec3f,       
    roughness: f32,  
    emissioncolor: vec3f, // Optional emission color    
    emissionstrength: f32,  
    padding2: vec4f, 
};

struct Plane {
    position: vec3f,
    _pad0: f32, // padding after position
    normal: vec3f,
    _pad1: f32, // padding after normal
    size: vec2f, // width and height bounds
    _pad2: vec2f, 
    color: vec3f,       // material color
    _pad3: f32,         // padding after color
    roughness: f32,     // material roughness
    _pad4: f32,         // padding after roughness
    emission: vec3f,    // material emission
    _pad5: f32,         // padding after emission
}

struct CameraData {
    eye: vec3f,
    _pad0: f32,
    forward: vec3f,
    _pad1: f32,
    right: vec3f,
    _pad2: f32,
    up: vec3f,
    _pad3: f32,
    halfWidth: f32,
    halfHeight: f32,
    _pad4: vec2f,
}

struct Ray {
    origin: vec3f,
    dir: vec3f,
};

struct HitInfo {
      didHit: bool,
    dst: f32,
    hitPoint: vec3f,
    normal: vec3f,
    materialcolor: vec3f,
    emissioncolor: vec3f,
    emissionstrength: f32,
    index: u32,
};

@group(0) @binding(0)
var<uniform> camera: CameraData;

// Output texture we write ray traced results to
@group(0) @binding(1)
var outputTexture: texture_storage_2d<rgba8unorm, write>;

@group(0) @binding(2) 
var<uniform> frame: u32;

@group(0) @binding(3)
var previousFrame: texture_2d<f32>; // Need to add this binding

// Scene objects
struct SceneCounts {
    numSpheres: u32,
    numPlanes: u32,
    _pad0: u32,
    _pad1: u32,
};

@group(1) @binding(0)
var<storage, read> spheres: array<Sphere>;
@group(1) @binding(1)
var<storage, read> planes: array<Plane>;
@group(1) @binding(2)
var<uniform> sceneCounts: SceneCounts;
// will add triangles


fn RaySphere(ray: Ray, sphereCentre: vec3f, sphereRadius: f32) -> HitInfo {
    var hitInfo: HitInfo;
    hitInfo.didHit = false;
    hitInfo.dst = 0.0;
    hitInfo.hitPoint = vec3f(0.0, 0.0, 0.0);
    hitInfo.normal = vec3f(0.0, 0.0, 0.0);

    let offsetRayOrigin = ray.origin - sphereCentre;
    let a = dot(ray.dir, ray.dir);
    let b = 2.0 * dot(offsetRayOrigin, ray.dir);
    let c = dot(offsetRayOrigin, offsetRayOrigin) - sphereRadius * sphereRadius;
    let discriminant = b * b - 4.0 * a * c;

    if (discriminant >= 0.0) {
        let dst = (-b - sqrt(discriminant)) / (2.0 * a);
        if (dst >= 0.0) {
            hitInfo.didHit = true;
            hitInfo.dst = dst;
            hitInfo.hitPoint = ray.origin + ray.dir * dst;
            hitInfo.normal = normalize(hitInfo.hitPoint - sphereCentre);
        }
    }
    return hitInfo;
}

// Main compute shader - runs once per pixel
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let pixelCoords = vec2u(id.xy);
    let width = textureDimensions(outputTexture).x;
    let height = textureDimensions(outputTexture).y;

    if (pixelCoords.x >= width || pixelCoords.y >= height) {
        return; // Out of bounds
    }

    // Convert to normalized device coordinates
    let ndc = (vec2f(f32(pixelCoords.x), f32(pixelCoords.y)) / vec2f(f32(width), f32(height))) * 2.0 - vec2f(1.0, 1.0);
    
    let imagePoint =
        camera.eye +
        camera.forward +
        ndc.x * camera.halfWidth * camera.right +
        ndc.y * camera.halfHeight * camera.up;

    let rayDir = normalize(imagePoint - camera.eye);
    let ray = Ray(camera.eye, rayDir);
    let seed = pixelCoords.x * 48271u + pixelCoords.y * 719393u + frame * 16807u;

    // Cast multiple rays per pixel for this frame
    var currentFrameColor: vec3f = vec3f(0.0, 0.0, 0.0);
    let raysPerPixel = 20u; // Number of rays to trace per pixel
    for (var i: u32 = 0u; i < raysPerPixel; i = i + 1u) {
        let sample_seed = seed + i * 7919u;
        currentFrameColor += trace_ray(ray, sample_seed);
    }
    currentFrameColor = currentFrameColor / f32(raysPerPixel);
    
    // Blend with previous frames for temporal accumulation
    let previous = textureLoad(previousFrame, vec2i(pixelCoords), 0).rgb;
    let blendFactor = 1.0 / f32(frame + 1); // TODO: mess with this factor
    let finalColor = mix(previous, currentFrameColor, blendFactor);

    textureStore(outputTexture, vec2i(pixelCoords), vec4f(finalColor, 1.0));
}

fn check_ray_collision(ray: Ray) -> HitInfo {
    var closest: HitInfo;
    closest.didHit = false;
    closest.dst = 1e30;
    for (var i = 0u; i < sceneCounts.numSpheres; i = i + 1u) {
        let hit = RaySphere(ray, spheres[i].center, spheres[i].radius);
        if (hit.didHit && hit.dst < closest.dst) {
            closest = hit;
            closest.index = i;
            closest.materialcolor = spheres[i].color;
            closest.emissioncolor = spheres[i].emissioncolor;
            closest.emissionstrength = spheres[i].emissionstrength;
        }
    }

    // todo: add plane collision checks. and triangles later
    return closest;
}

fn trace_ray(ray: Ray, state: u32) -> vec3<f32> {
    var ray_color: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);
    var brightness_score: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

    let max_bounce_limit: i32 = 5;
    var local_ray = ray;
    var local_state = state;

    for (var i: i32 = 0; i <= max_bounce_limit; i = i + 1) {
        let current_collision: HitInfo = check_ray_collision(local_ray);
        if (current_collision.didHit) {
            local_ray.origin = current_collision.hitPoint;
            let rand = random_direction(local_state);
            local_ray.dir = normalize(current_collision.normal + rand.xyz);
            local_state = u32(rand.w);
            let emitted_light: vec3<f32> = current_collision.emissioncolor *
                                           current_collision.emissionstrength;

            brightness_score = brightness_score + emitted_light * ray_color;
            ray_color = ray_color * current_collision.materialcolor;
        } else {
            let t = 0.5 * (local_ray.dir.y + 1.0);
            let sky = mix(vec3<f32>(0.3, 0.3, 0.4), vec3<f32>(0.05, 0.05, 0.1), t);
            brightness_score = brightness_score + sky * ray_color;
            break;
        }
    }

    // if(brightness_score.x == 0.0 && brightness_score.y == 0.0 && brightness_score.z == 0.0) {
    //     // If no light was emitted, return gray
    //     return vec3<f32>(0.8, 0.8, 0.8); // Return a gray color
    // }

    return brightness_score;
}


//rng stuff

// PCG (Permuted Congruential Generator)
// Thanks to:
// https://www.pcg-random.org
// https://www.shadertoy.com/view/XlGcRh
fn next_random(state: u32) -> vec2<u32> {
    let new_state = state * 747796405u + 2891336453u;
    var result = ((new_state >> ((new_state >> 28u) + 4u)) ^ new_state) * 277803737u;
    result = (result >> 22u) ^ result;
    return vec2<u32>(result, new_state); // return result and updated state
}

// Generate a uniform random float in [0.0, 1.0]
fn random_value(state: u32) -> vec2<f32> {
    let rnd = next_random(state);
    let value = f32(rnd.x) / 4294967295.0; // 2^32 - 1
    return vec2<f32>(value, f32(rnd.y));
}

// Random value from a normal distribution (mean = 0, stddev = 1)
// Thanks to: https://stackoverflow.com/a/6178290
fn random_value_normal_distribution(state: u32) -> vec2<f32> {
    let theta_pair = random_value(state);
    let theta = 2.0 * 3.1415926 * theta_pair.x;

    let rho_pair = random_value(u32(theta_pair.y));
    let rho = sqrt(-2.0 * log(rho_pair.x));

    let value = rho * cos(theta);
    return vec2<f32>(value, f32(u32(rho_pair.y)));
}

// Generate a random direction vector (unit length)
// Thanks to: https://math.stackexchange.com/a/1585996
fn random_direction(state: u32) -> vec4<f32> {
    let x_pair = random_value_normal_distribution(state);
    let x = x_pair.x;

    let y_pair = random_value_normal_distribution(u32(x_pair.y));
    let y = y_pair.x;

    let z_pair = random_value_normal_distribution(u32(y_pair.y));
    let z = z_pair.x;

    let direction = normalize(vec3<f32>(x, y, z));
    return vec4<f32>(direction, f32(u32(z_pair.y))); // xyz = direction, w = new state
}

