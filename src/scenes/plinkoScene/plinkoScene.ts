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
import { Ball } from "../../game_objects/Ball";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) {} // lazy linting

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);
    const objectMap = new ObjectMap();

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    const shadowTexture = Texture2D.createShadowTexture(device, 3072, 3072);

    // LIGHTS
    const ambientLight = new AmbientLight(device);
    ambientLight.color = new Color(1, 1, 1, 1);
    ambientLight.intensity = 0.7;

    const directionalLight = new DirectionalLight(device);
    directionalLight.color = new Color(1, 1, 1, 1);
    directionalLight.intensity = 0.3;
    directionalLight.direction = new Vec3(-1, -1, 0);

    const pointLights = new PointLightsCollection(device, 3);
    pointLights.lights[0].intensity = 0;
    pointLights.lights[1].intensity = 0;
    pointLights.lights[2].intensity = 0;

    // CAMERA
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = new Vec3(0, 8, 14);
    camera.target = new Vec3(0, 3.5, 0);

    const shadowCamera = new ShadowCamera(device);
    shadowCamera.eye = new Vec3(-5, 10, 5);
    shadowCamera.target = new Vec3(0, 0, 0);

    // Initialize physics world with optimized settings for Plinko
    const physicsWorld = new PhysicsWorld();
    physicsWorld.setGravity(new Vec3(0, -6, 0));
    physicsWorld.timeStep = 1/60;
    physicsWorld.maxSubSteps = 3; // Limit physics iterations

    // Initialize physics debug renderer
    const physicsDebugRenderer = new PhysicsDebugRenderer(device);

    // Plinko board dimensions - UPDATED for better distribution
    const boardWidth = 10;
    const boardHeight = 11;
    const pegRadius = 0.12;
    const ballRadius = 0.1;
    const pegSpacing = 0.6;

    // Arrays to store game objects and physics components
    const gameObjects: any[] = [];
    const physicsComponents: PhysicsComponent[] = [];
    const ballPool: { ball: Ball, physics: PhysicsComponent, isActive: boolean }[] = [];

    // Ball spawning variables
    let ballSpawnTimer = 0;
    const ballSpawnInterval = 0.33;
    const maxActiveBalls = 100;
    let currentActiveBalls = 0;

    // Add distribution tracking
    const bucketCount = 15; // More buckets for better distribution
    const bucketCounts: number[] = new Array(bucketCount).fill(0);
    let totalBallsDropped = 0;

    // === CREATE PLINKO BOARD ===

    // 1. Create side walls
    const leftWall = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
    leftWall.scale = new Vec3(0.3, boardHeight / 1.2, 1);
    leftWall.position = new Vec3(-boardWidth/2 - 0.5, boardHeight/4, 0);
    leftWall.color = new Color(0.3, 0.3, 0.3, 1);
    const leftWallPhysics = new PhysicsComponent(leftWall, physicsWorld, 'box', 0);
    leftWallPhysics.setType(RigidBodyType.STATIC);

    const rightWall = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
    rightWall.scale = new Vec3(0.3, boardHeight / 1.2, 1);
    rightWall.position = new Vec3(boardWidth/2 + 0.5, boardHeight/4, 0);
    rightWall.color = new Color(0.3, 0.3, 0.3, 1);
    const rightWallPhysics = new PhysicsComponent(rightWall, physicsWorld, 'box', 0);
    rightWallPhysics.setType(RigidBodyType.STATIC);

    gameObjects.push(leftWall, rightWall);
    physicsComponents.push(leftWallPhysics, rightWallPhysics);

    // 2. Create floor
    const floor = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
    floor.scale = new Vec3(boardWidth + 2, 0.5, 2);
    floor.position = new Vec3(0, -2, 0);
    floor.color = new Color(0.2, 0.2, 0.2, 1);
    const floorPhysics = new PhysicsComponent(floor, physicsWorld, 'box', 0);
    floorPhysics.setType(RigidBodyType.STATIC);
    
    gameObjects.push(floor);
    physicsComponents.push(floorPhysics);

    // 3. Create peg grid in triangular Plinko pattern - IMPROVED
    const pegRows = 15;
    for (let row = 0; row < pegRows; row++) {
        const y = boardHeight - 2 - (row * pegSpacing);
        const pegsInRow = row + 2; // Start with 2 pegs, increase each row
        const rowWidth = (pegsInRow - 1) * pegSpacing;
        const startX = -rowWidth / 2;

        for (let col = 0; col < pegsInRow; col++) {
            const x = startX + (col * pegSpacing);
            
            // Create sphere peg
            const peg = objectMap.createSphere({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
            peg.scale = new Vec3(pegRadius, pegRadius, pegRadius);
            peg.position = new Vec3(x, y, 0);
            peg.color = new Color(0.8, 0.6, 0.2, 1); // Golden pegs
            
            const pegPhysics = new PhysicsComponent(peg, physicsWorld, 'sphere', 0);
            pegPhysics.setType(RigidBodyType.STATIC);
            pegPhysics.setRestitution(0.1); // bounciness
            pegPhysics.setFriction(0.1); // Keep low friction
            
            gameObjects.push(peg);
            physicsComponents.push(pegPhysics);
        }
    }

    // 4. Create collection buckets at the bottom
    const bucketWidth = boardWidth / bucketCount;
    
    for (let i = 0; i <= bucketCount; i++) {
        const x = -boardWidth/2 + (i * bucketWidth);
        
        // Create bucket walls
        const bucketWall = objectMap.createCube({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
        bucketWall.scale = new Vec3(0.05, 1.5, 1);
        bucketWall.position = new Vec3(x, -1, 0);
        bucketWall.color = new Color(0.1, 0.5, 0.8, 1);
        
        const bucketPhysics = new PhysicsComponent(bucketWall, physicsWorld, 'box', 0);
        bucketPhysics.setType(RigidBodyType.STATIC);
        
        gameObjects.push(bucketWall);
        physicsComponents.push(bucketPhysics);
    }

    // 5. Create ball pool for reuse
    for (let i = 0; i < maxActiveBalls + 2; i++) {
        const ball = objectMap.createSphere({ device, camera, shadowCamera, ambientLight, directionalLight, pointLights }, shadowTexture, false);
        ball.scale = new Vec3(ballRadius, ballRadius, ballRadius);
        ball.position = new Vec3(0, -50, 0); // Start inactive below the scene
        ball.color = new Color(1, 0.8, 0.8, 1); // pink

        const ballPhysics = new PhysicsComponent(ball, physicsWorld, 'sphere', 1);
        ballPhysics.setType(RigidBodyType.DYNAMIC);
        ballPhysics.setRestitution(0.25); // bounciness
        ballPhysics.setFriction(0.1);    // friction
        ballPhysics.setActive(false); // Start inactive
        
        ballPool.push({ ball, physics: ballPhysics, isActive: false });
        gameObjects.push(ball);
        physicsComponents.push(ballPhysics);
    }

    // === GAME FUNCTIONS ===

    function spawnBall(): void {
        if (currentActiveBalls >= maxActiveBalls) return;
        
        // Find inactive ball from pool
        const poolBall = ballPool.find(b => !b.isActive);
        if (!poolBall) return;
        
        // Activate and position ball
        poolBall.isActive = true;
        currentActiveBalls++;
        
        // INCREASED random spawn position for more variation
        const spawnX = (Math.random() - 0.5) * 0.1; // from -0.05 to 0.05
        const spawnY = boardHeight - 0.5; // Add some Y variation
        
        poolBall.ball.position = new Vec3(spawnX, spawnY, 0);
        poolBall.physics.setPosition(new Vec3(spawnX, spawnY, 0));
        
        poolBall.physics.setActive(true);
        poolBall.ball.color = new Color(1, 0.8, 0.8, 1); // pink
    }

    function cleanupBalls(): void {
        ballPool.forEach(poolBall => {
            if (poolBall.isActive && poolBall.ball.position.y < -1.5) {
                // Determine which bucket the ball landed in
                const ballX = poolBall.ball.position.x;
                const bucketIndex = Math.floor((ballX + boardWidth/2) / (boardWidth / bucketCount));
                const clampedIndex = Math.max(0, Math.min(bucketCount - 1, bucketIndex));
                
                bucketCounts[clampedIndex]++;
                totalBallsDropped++;
                
                // Deactivate ball
                poolBall.isActive = false;
                currentActiveBalls--;
                poolBall.physics.setActive(false);
                poolBall.ball.position = new Vec3(0, -50, 0);
                poolBall.physics.setPosition(new Vec3(0, -50, 0));
            }
        });
    }

    function handleInput(): void {
        // Manual ball spawn with spacebar
        if (inputManager.isKeyDown(' ')) {
            spawnBall();
        }
        
        // Reset scene with R key
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            ballPool.forEach(poolBall => {
                poolBall.isActive = false;
                poolBall.physics.setActive(false);
                poolBall.ball.position = new Vec3(0, -20, 0);
                poolBall.physics.setPosition(new Vec3(0, -20, 0));
            });
            currentActiveBalls = 0;
            // Reset distribution tracking
            bucketCounts.fill(0);
            totalBallsDropped = 0;
        }

        if( inputManager.isKeyDown('i') || inputManager.isKeyDown('I') ) {
            physicsDebugRenderer.toggleDynamic();
        }

        if( inputManager.isKeyDown('o') || inputManager.isKeyDown('O') ) {
            physicsDebugRenderer.toggleStatic();
        }
        if( inputManager.isKeyDown('p') || inputManager.isKeyDown('P') ) {
            physicsDebugRenderer.toggleKinematic();
        }
    }

    // === RENDER LOOP ===

    let lastTime = performance.now();
    
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        handleInput();
        
        // Auto-spawn balls
        ballSpawnTimer += deltaTime;
        if (ballSpawnTimer >= ballSpawnInterval) {
            spawnBall();
            ballSpawnTimer = 0;
        }
        
        // Update physics
        physicsWorld.step(deltaTime);
        
        // Sync game objects with physics
        physicsComponents.forEach(physics => {
            if (physics.isActive()) {
                physics.updateGameObjectTransform();
            }
        });
        
        // Update game objects
        gameObjects.forEach(obj => {
            if (obj && typeof obj.update === 'function') {
                obj.update();
            }
        });
        
        // Clean up balls that fell off the board
        cleanupBalls();
        
        // Update lights
        ambientLight.update();
        directionalLight.update();
        pointLights.update();
        
        // Update cameras
        camera.update();
        shadowCamera.update();

        // === SHADOW PASS ===
        const shadowCommandEncoder = device.createCommandEncoder();
        const shadowRenderPass = shadowCommandEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: shadowTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        
        gameObjects.forEach(obj => {
            if (obj && typeof obj.drawShadows === 'function' && obj.position.y > -10) {
                obj.drawShadows(shadowRenderPass);
            }
        });
        
        shadowRenderPass.end();
        device.queue.submit([shadowCommandEncoder.finish()]);

        // === MAIN RENDER PASS ===
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpuContext.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue:  { r: 0.4, g: 0.9, b: 0.9, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        // Render game objects
        gameObjects.forEach(obj => {
            if (obj && typeof obj.draw === 'function' && obj.position.y > -10) {
                obj.draw(renderPass);
            }
        });
        
        // Render physics debug visualization
        const viewMatrix = Mat4x4.lookAt(camera.eye, camera.target, new Vec3(0, 1, 0));
        const projectionMatrix = Mat4x4.perspective(camera.fov, canvas.width / canvas.height, camera.near, camera.far);
        physicsDebugRenderer.render(renderPass, physicsWorld, viewMatrix, projectionMatrix);
        physicsDebugRenderer.showStatic = false;


        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        
        // Update info display
        const stats = physicsWorld.getPerformanceStats();
        if (infoElem) {
            // Calculate distribution stats
            const maxCount = Math.max(...bucketCounts);
            const distributionDisplay = bucketCounts.map((count, i) => {
                const percentage = totalBallsDropped > 0 ? (count / totalBallsDropped * 100).toFixed(1) : '0.0';
                const bar = '█'.repeat(Math.floor(count / maxCount * 10));
                return `${i.toString().padStart(2)}: ${count.toString().padStart(3)} (${percentage}%)\t${bar}`;
            }).join('\n');
            
            infoElem.textContent = 
                `Plinko Physics Demo - Binomial Distribution\n` +
                `Active Balls: ${currentActiveBalls}/${maxActiveBalls}\n` +
                `Total Dropped: ${totalBallsDropped}\n` +
                `Physics Objects: ${stats.objectCount}\n` +
                `Collision Checks: ${stats.collisionChecks}\n` +
                `\nBucket Distribution:\n${distributionDisplay}\n` +
                `\nControls:\n` +
                `SPACEBAR - Spawn Ball\n` +
                `R - Reset Scene\n` +
                `Mouse - Look Around\n` +
                `O - Toggle Physics Debug Static\n` +
                `I - Toggle Physics Debug Dynamic\n`;
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop(performance.now());
}

export function dispose() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

export { init };
