@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> simParams: SimulationParams;
@group(0) @binding(2) var<uniform> frameParams: FrameParams;

struct Particle {
    position: vec2f, // 2
    velocity: vec2f, // 2
    density: f32,    // 1
    nearDensity: f32,// 1
    _padding: vec2f, // 2
    color: vec4f,    // 4
    _padding0: vec4f, // padding for 64 bytes
}

struct SimulationParams {
    gravity: f32,               // 1
    targetDensity: f32,         // 1
    pressureMultiplier: f32,    // 1
    nearPressureMultiplier: f32,// 1
    viscosityStrength: f32,     // 1
    smoothingRadius: f32,       // 1
    particleCount: u32,         // 1
    _pad1: u32,                 // 1 (32 bytes total)
};

struct FrameParams {
    deltaTime: f32,             // 1
    _pad1: f32,                 // 1
    _pad2: f32,                 // 1
    _pad3: f32,                 // 1 (16 bytes total)
};




@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= simParams.particleCount) { return; }

    var particle = particles[index];
    // Update position
    particle.position = particle.position + particle.velocity * frameParams.deltaTime;

    // Handle boundary collisions
    let minX = -24.0; // TODO turn this into a parameter later
    let maxX = 24.0;
    let minY = -14.0;
    let maxY = 14.0;
    let damping = 0.2;
    let margin = 0.05;

    if (particle.position.x < minX + margin) {
        particle.position.x = minX + margin;
        particle.velocity.x = abs(particle.velocity.x) * damping;
    }
    if (particle.position.x > maxX - margin) {
        particle.position.x = maxX - margin;
        particle.velocity.x = -abs(particle.velocity.x) * damping;
    }
    if (particle.position.y < minY + margin) {
        particle.position.y = minY + margin;
        if (particle.velocity.y < 0.0) {
            particle.velocity.y = -particle.velocity.y * damping;
        }
    }
    if (particle.position.y > maxY - margin) {
        particle.position.y = maxY - margin;
        if (particle.velocity.y > 0.0) {
            particle.velocity.y = -particle.velocity.y * damping;
        }
    }

    //particle.color = getParticleDensityColor(particle.density, simParams.targetDensity);
    //particle.color = getColor(particle.density, params.targetDensity);
    particle.color = getParticleVelocityColor(particle.velocity);
    particles[index] = particle;
}

fn getParticleDensityColor(density: f32, targetDensity: f32) -> vec4<f32> {
    // Normalize density to 0-1 range for color mapping
    let normalizedDensity = min(max((density - 0.0) / (targetDensity * 2.0), 0.0), 1.0);

    if (density < 0.1) {
        // Very low density - bright blue
        return vec4<f32>(0.0, 0.5, 1.0, 1.0);
    } else if (normalizedDensity < 0.33) {
        // Low density - blue to cyan
        let t = normalizedDensity * 3.0;
        return vec4<f32>(0.0, t, 1.0, 1.0);
    } else if (normalizedDensity < 0.66) {
        // Medium density - cyan to green (target range)
        let t = (normalizedDensity - 0.33) * 3.0;
        return vec4<f32>(0.0, 1.0, 1.0 - t, 1.0);
    } else {
        // High density - green to red
        let t = (normalizedDensity - 0.66) * 3.0;
        return vec4<f32>(t, 1.0 - t, 0.0, 1.0);
    }
}

fn getParticleVelocityColor(velocity: vec2<f32>) -> vec4<f32> {
    let speed = length(velocity);
    let maxSpeed = 10.0;
    let t = min(speed / maxSpeed, 1.0);

    if (t < 0.33) {
        // Blue to Cyan
        let k = t / 0.33;
        return vec4<f32>(0.0, k, 1.0, 1.0); // (0,0,1) to (0,1,1)
    } else if (t < 0.66) {
        // Cyan to Light Green
        let k = (t - 0.33) / 0.33;
        return vec4<f32>(0.0, 1.0, 1.0 - k, 1.0); // (0,1,1) to (0,1,0)
    } else {
        // Light Green to Yellow
        let k = (t - 0.66) / 0.34;
        return vec4<f32>(k, 1.0, 0.0, 1.0); // (0,1,0) to (1,1,0)
    }
}

fn getColor(density: f32, targetDensity: f32) -> vec4<f32> {
    if(density > 0.0){
        return vec4<f32>(1.0, 0.0, 0.0, 1.0);
    }
    else{
        return vec4<f32>(0.0, 0.0, 1.0, 1.0);
    }
}