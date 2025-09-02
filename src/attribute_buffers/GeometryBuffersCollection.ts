import { GeometryBuffers } from "./GeometryBuffers";
import { GeometryBuilder } from "../geometry/GeometryBuilder";
import { Geometry } from "../geometry/Geometry";

export class GeometryBuffersCollection{
    public static cubeBuffers: GeometryBuffers;
    public static sphereBuffers: GeometryBuffers;
    public static arrowBuffers: GeometryBuffers;
    public static gridPlaneBuffers: GeometryBuffers;
    public static vertexBuffers: GeometryBuffers;
    public static terrainBuffers: GeometryBuffers;
    public static quadBuffers: GeometryBuffers;
    public static circleBuffers: GeometryBuffers;
    public static circleOutlineBuffers: GeometryBuffers;

    public static initialize(device: GPUDevice): void{
        const quad = new GeometryBuilder().createQuadGeometry();  // 2D
        const circle = new GeometryBuilder().createCircleGeometry(1, 64); // 2D
        const circleOutline = new GeometryBuilder().createCircleOutlineGeometry(1, 64); // 2D
        const cube = new GeometryBuilder().createCubeGeometry();
        const sphere = new GeometryBuilder().createSphereGeometry(1, 64);
        const arrow = new GeometryBuilder().createArrowGeometry(0.05, 0.8, 0.15, 0.2, 16);
        const gridPlane = new GeometryBuilder().createGridPlane(128, 128); // 128x128 grid, 20 units size
        const terrain = new GeometryBuilder().createTerrainGeometry(128, 128); // this is happening in every scene.... TODO: FIX
       
        this.quadBuffers = new GeometryBuffers(device, quad);
        this.circleBuffers = new GeometryBuffers(device, circle);
        this.circleOutlineBuffers = new GeometryBuffers(device, circleOutline);
        this.cubeBuffers = new GeometryBuffers(device, cube);
        this.sphereBuffers = new GeometryBuffers(device, sphere);
        this.arrowBuffers = new GeometryBuffers(device, arrow);
        this.gridPlaneBuffers = new GeometryBuffers(device, gridPlane);
        this.terrainBuffers = new GeometryBuffers(device, terrain);
    }

    public static initializeObjects(device: GPUDevice, mesh: Geometry): void{
        this.vertexBuffers = new GeometryBuffers(device, mesh);
    }
}