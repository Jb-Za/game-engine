import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Mat4x4 } from "../../math/Mat4x4";
import { Texture2D } from "../../texture/Texture2D";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { InputManager } from "../../input/InputManager";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { ObjectMap } from "../../game_objects/ObjectMap";
import { PhysicsWorld } from "../../physics/PhysicsWorld";
import { PhysicsComponent } from "../../physics/PhysicsComponent";
import { PhysicsDebugRenderer } from "../../physics/PhysicsDebugRenderer";
import { RigidBodyType } from "../../physics/RigidBody";
import { Cube } from "../../game_objects/Cube";
import { Ball } from "../../game_objects/Ball";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) { } // lazy linting

    //Input Manager
    const inputManager = new InputManager(canvas);

    GeometryBuffersCollection.initialize(device);

    const objectMap = new ObjectMap();

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(
        device,
        canvas.width,
        canvas.height
    );
    const shadowTexture = Texture2D.createShadowTexture(
        device,
        3072,
        3072
    );
    // LIGHTS
    const ambientLight = new AmbientLight(device);
    ambientLight.color = new Color(1, 1, 1, 1);
    ambientLight.intensity = 0.6;

    const directionalLight = new DirectionalLight(device);
    directionalLight.color = new Color(1, 1, 1, 1);
    directionalLight.intensity = 0;
    directionalLight.direction = new Vec3(-1, 0, 0);
    directionalLight.specularIntensity = 0;
    directionalLight.specularColor = new Color(1, 0, 0, 1);

    const pointLights = new PointLightsCollection(device, 3);
    pointLights.lights[0].color = new Color(0, 0, 1, 1);
    pointLights.lights[0].intensity = 0.6;
    pointLights.lights[0].position = new Vec3(5.74, 2.48, -3.0);
    pointLights.lights[1].intensity = 1;
    pointLights.lights[1].specularIntensity = 0;
    pointLights.lights[1].position = new Vec3(5.74, 2.48, -3.0);
    pointLights.lights[2].intensity = 0;
    pointLights.lights[2].specularIntensity = 0;

    //Game Objects
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = new Vec3(5.74, 1.96, 4.44);
    camera.target = new Vec3(5.02, 1.94, 3.94);

    //
    const shadowCamera = new ShadowCamera(device);
    shadowCamera.eye = new Vec3(5.74, 2.48, -3.0); // Let's imagine it as a negative direction light * -20 or any other fitting scalar
    shadowCamera.target = new Vec3(4.85, 2.38, -2.61);

    // Initialize physics world
    const physicsWorld = new PhysicsWorld();
    physicsWorld.setGravity(new Vec3(0, -5, 0)); // Reduce gravity to help with tunneling
    
    // Improve physics stability
    physicsWorld.timeStep = 1/120; // Smaller timestep for more stability

    // Initialize physics debug renderer
    const physicsDebugRenderer = new PhysicsDebugRenderer(device);

    // Game Objects - Create static floor using a cube from objectMap instead of Floor class
    const floor = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
    floor.pipeline.shadowTexture = shadowTexture;
    // Set transform BEFORE creating physics component
    floor.scale = new Vec3(40, 2, 40); // Make floor much thicker
    floor.position = new Vec3(0, -3, 0); // Move down a bit more
    floor.color.set([0.2,0.2,0.2,1]); // Dark gray floor

    // Add physics to floor - create physics component AFTER setting position and scale
    const floorPhysics = new PhysicsComponent(floor, physicsWorld, 'box', 0);
    floorPhysics.setType(RigidBodyType.STATIC);

    // Create physics objects using objectMap - mix of cubes and spheres
    const physicsObjects: any[] = [];
    const physicsComponents: PhysicsComponent[] = [];

    // Create some falling objects (random mix of cubes and spheres)
    for (let i = 0; i < 8; i++) {
        const isSpphere = Math.random() > 0.5;
        let gameObject;
        let physics;

        if (isSpphere) {
            gameObject = objectMap.createSphere({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
            // Set transform BEFORE creating physics
            gameObject.position = new Vec3(
                (Math.random() - 0.5) * 6,
                Math.random() * 5 + 5,
                (Math.random() - 0.5) * 6
            );
            gameObject.scale = new Vec3(0.5, 0.5, 0.5);
            
            physics = new PhysicsComponent(gameObject, physicsWorld, 'sphere', 1.0); // Reduce mass
            physics.setRestitution(0.6); // More bouncy spheres
            physics.setFriction(0.5); // Increase friction
        } else {
            gameObject = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
            // Set transform BEFORE creating physics
            gameObject.position = new Vec3(
                (Math.random() - 0.5) * 6,
                Math.random() * 5 + 5,
                (Math.random() - 0.5) * 6
            );
            gameObject.scale = new Vec3(0.5, 0.5, 0.5);
            
            physics = new PhysicsComponent(gameObject, physicsWorld, 'box', 1.0); // Reduce mass
            physics.setRestitution(0.3); // Less bouncy cubes
            physics.setFriction(0.7); // Higher friction
        }

        physicsObjects.push(gameObject);
        physicsComponents.push(physics);
    }

    let spawnTimer = 0;
    const spawnInterval = 3; // seconds
    let showPhysicsDebug = false; // Toggle for physics debug rendering

    // Add key controls for physics demo
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === 'e') {
            console.log(camera.eye);
            console.log(camera.target);
            const stats = physicsWorld.getPerformanceStats();
            console.log(`Physics stats - Objects: ${stats.objectCount}, Collision Checks: ${stats.collisionChecks}`);
        }
        if (e.key === 'p' || e.key === 'P') {
            // Toggle physics debug visualization
            showPhysicsDebug = !showPhysicsDebug;
            console.log(`Physics debug rendering: ${showPhysicsDebug ? 'ON' : 'OFF'}`);
        }
        if (e.key === 'c' || e.key === 'C') {
            // Spawn new random object (cube or sphere)
            const isSpphere = Math.random() > 0.5;
            let gameObject;
            let physics;

            if (isSpphere) {
                gameObject = objectMap.createSphere({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
                // Set transform BEFORE creating physics
                gameObject.position = new Vec3(0, 10, 0);
                gameObject.scale = new Vec3(0.5, 0.5, 0.5);
                
                physics = new PhysicsComponent(gameObject, physicsWorld, 'sphere', 1.0);
                physics.setRestitution(0.6);
                physics.setFriction(0.5);
            } else {
                gameObject = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
                // Set transform BEFORE creating physics
                gameObject.position = new Vec3(0, 10, 0);
                gameObject.scale = new Vec3(0.5, 0.5, 0.5);
                
                physics = new PhysicsComponent(gameObject, physicsWorld, 'box', 1.0);
                physics.setRestitution(0.3);
                physics.setFriction(0.7);
            }

            physicsObjects.push(gameObject);
            physicsComponents.push(physics);
        }
        if (e.key === ' ') {
            // Apply upward force to all objects
            physicsComponents.forEach(physics => {
                physics.addForce(new Vec3(0, 50, 0));
            });
        }
    });

    const update = (deltaTime: number) => {
        // Handle auto-spawn
        spawnTimer += deltaTime;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;

            // Spawn random object (cube or sphere)
            const isSpphere = Math.random() > 0.5;
            let gameObject;
            let physics;

            if (isSpphere) {
                gameObject = objectMap.createSphere({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
                // Set transform BEFORE creating physics
                gameObject.position = new Vec3((Math.random() - 0.5) * 6, 10, (Math.random() - 0.5) * 6);
                gameObject.scale = new Vec3(0.5, 0.5, 0.5);
                
                physics = new PhysicsComponent(gameObject, physicsWorld, 'sphere', 1.0);
                physics.setRestitution(0.6);
                physics.setFriction(0.5);
            } else {
                gameObject = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, true);
                // Set transform BEFORE creating physics
                gameObject.position = new Vec3((Math.random() - 0.5) * 6, 10, (Math.random() - 0.5) * 6);
                gameObject.scale = new Vec3(0.5, 0.5, 0.5);
                
                physics = new PhysicsComponent(gameObject, physicsWorld, 'box', 1.0);
                physics.setRestitution(0.3);
                physics.setFriction(0.7);
            }

            physicsObjects.push(gameObject);
            physicsComponents.push(physics);
        }

        // Physics simulation
        physicsWorld.step(deltaTime);

        // Update all physics objects
        [...physicsComponents, floorPhysics].forEach(physics => {
            physics.updateGameObjectTransform();
        });

        camera.update();
        ambientLight.update();
        directionalLight.update();
        pointLights.update();
        shadowCamera.update();

        // Update all game objects (floor is now part of objectMap)
        physicsObjects.forEach(obj => obj.update());
        floor.update(); // Update the floor separately
    };

    const shadowPass = (commandEncoder: GPUCommandEncoder) => {
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [],
            // CONFIGURE DEPTH
            depthStencilAttachment: {
                view: shadowTexture.texture.createView(),
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1.0,
            },
        });

        // DRAW HERE
        objectMap.objects.forEach((object) => {
            object.drawShadows(renderPassEncoder);
        });
        renderPassEncoder.end();
    };

    const scenePass = (commandEncoder: GPUCommandEncoder) => {
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: gpuContext.getCurrentTexture().createView(),
                    storeOp: "store",
                    clearValue: { r: 0.4, g: 0.9, b: 0.9, a: 1.0 },
                    loadOp: "clear",
                },
            ],
            // CONFIGURE DEPTH
            depthStencilAttachment: {
                view: depthTexture.texture.createView(),
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1.0,
            },
        });

        // DRAW HERE
        objectMap.objects.forEach((object) => {
            object.draw(renderPassEncoder);
        });
        
        // Draw physics debug wireframes
        if (showPhysicsDebug) {
            // Use camera's calculated matrices directly instead of recalculating
            // Create temporary view and projection matrices for debug rendering
            const viewMatrix = Mat4x4.lookAt(camera.eye, camera.target, new Vec3(0, 1, 0));
            const projectionMatrix = Mat4x4.perspective(camera.fov, canvas.width / canvas.height, camera.near, camera.far);
            physicsDebugRenderer.render(renderPassEncoder, physicsWorld, viewMatrix, projectionMatrix);
        }
        
        renderPassEncoder.end();
    };

    let then = performance.now() * 0.001;
    const targetFPS = 60;
    const minFrameTime = 1 / targetFPS;
    let lastDrawTime = performance.now() * 0.001;

    const draw = () => {
        let now = performance.now();
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        // Only proceed if enough time has passed for the target FPS
        if (now - lastDrawTime < minFrameTime) {
            animationFrameId = requestAnimationFrame(draw);
            return;
        }
        lastDrawTime = now;
        then = now;
        const startTime = performance.now();
        update(deltaTime);

        const commandEncoder = device.createCommandEncoder();
        shadowPass(commandEncoder);
        scenePass(commandEncoder);

        device.queue.submit([commandEncoder.finish()]);

        const jsTime = performance.now() - startTime;

        if (infoElem != null) {
            const stats = physicsWorld.getPerformanceStats();
            // Count cubes and spheres from physicsObjects using instanceof
            const cubeCount = physicsObjects.filter(obj => obj instanceof Cube).length;
            const sphereCount = physicsObjects.filter(obj => obj instanceof Ball).length;

            infoElem.textContent = `\
Physics Demo
fps: ${(1 / deltaTime).toFixed(1)}
js: ${jsTime.toFixed(1)}ms

Controls:
- C: Spawn random object
- Spacebar: Apply upward force
- P: Toggle physics debug wireframes
- WASD: Move camera
- Mouse: Look around
- E: Log camera position

Stats:
- Physics Objects: ${physicsObjects.length}
- Total Bodies: ${stats.objectCount}
- Collision Checks: ${stats.collisionChecks}
- Cubes: ${cubeCount}
- Spheres: ${sphereCount}
- Debug Rendering: ${showPhysicsDebug ? 'ON' : 'OFF'}`;
        }
        animationFrameId = requestAnimationFrame(draw);
    };

    draw();
}

export function dispose() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

export { init };
