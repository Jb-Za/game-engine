import { GeometryBuffers } from "./GeometryBuffers";
import { GeometryBuilder } from "../geometry/GeometryBuilder";
import { Geometry } from "../geometry/Geometry";

export class GeometryBuffersCollection{
    public static cubeBuffers: GeometryBuffers;
    public static sphereBuffers: GeometryBuffers;
    public static arrowBuffers: GeometryBuffers;
    public static vertexBuffers: GeometryBuffers;

    public static initialize(device: GPUDevice): void{
        const geometry = new GeometryBuilder().createCubeGeometry();
        const sphere = new GeometryBuilder().createSphereGeometry(1, 64);
        const arrow = new GeometryBuilder().createArrowGeometry(0.05, 0.8, 0.15, 0.2, 16); // Proper arrow with shaft and head
       
        this.cubeBuffers = new GeometryBuffers(device, geometry);
        this.sphereBuffers = new GeometryBuffers(device, sphere);
        this.arrowBuffers = new GeometryBuffers(device, arrow);
    }

    public static initializeObjects(device: GPUDevice, mesh: Geometry): void{
        this.vertexBuffers = new GeometryBuffers(device, mesh);
    }
}