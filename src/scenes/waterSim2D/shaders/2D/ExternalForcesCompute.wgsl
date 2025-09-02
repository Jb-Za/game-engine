@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> predictedPositions: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> simParams: SimulationParams;
@group(0) @binding(3) var<uniform> frameParams: FrameParams;
@group(0) @binding(4) var<uniform> mouseParams: MouseParams;

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

struct MouseParams {
    mouseForceStrength: f32,    // 1
    mouseRadius: f32,           // 1
    mousePosition: vec2f,       // 2
    isMousePressed: u32,        // 1
    isMouseRightPressed: u32,   // 1
    _pad1: u32,                 // 1
    _pad2: u32,                 // 1 (32 bytes total)
};



@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = u32(global_id.x);
    if (index >= simParams.particleCount) { return; }

    var particle = particles[index];
    //if(simParams.smoothingRadius == 0.7){
     //   particle.color = vec4f(1.0, 0.0, 0.0, 1.0);
    //}

    var gravityAccel = vec2<f32>(0.0, simParams.gravity);
    
    // Mouse interaction
    if ((mouseParams.isMousePressed != 0 || mouseParams.isMouseRightPressed != 0) && mouseParams.mouseForceStrength != 0.0) {
        let inputPointOffset = mouseParams.mousePosition - particle.position;
        let sqrDst = dot(inputPointOffset, inputPointOffset);
        let radiusSquared = mouseParams.mouseRadius * mouseParams.mouseRadius;
          if (sqrDst < radiusSquared) {
            let dst = sqrt(sqrDst);
            let edgeT = dst / mouseParams.mouseRadius;
            let centreT = 1.0 - edgeT;
            let dirToCentre = select(vec2<f32>(0.0), inputPointOffset / dst, dst > 0.0);
            
            let forceDirection = select(-1.0, 1.0, mouseParams.isMouseRightPressed != 0);
            let interactionStrength = mouseParams.mouseForceStrength * forceDirection;
            
            let gravityWeight = 1.0 - (centreT * min(abs(interactionStrength) / 10.0, 1.0));
            var accel = gravityAccel * gravityWeight;
            
            let interactionForce = dirToCentre * centreT * interactionStrength;
            accel += interactionForce;
            
            // Velocity damping
            let velocityDamping = particle.velocity * (-centreT);
            accel += velocityDamping;
            
            particle.velocity += accel * frameParams.deltaTime;
        } else {
            particle.velocity += gravityAccel * frameParams.deltaTime;        }
    } else {
        particle.velocity += gravityAccel * frameParams.deltaTime;
    }
    
    particles[index] = particle;
    predictedPositions[index] = particle.position;
}


