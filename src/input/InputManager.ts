import { Vec2 } from "../math/Vec2";
import { EventEmitter } from "../Events/EventEmitter";


export type Coordinates = { x: number; y: number };

export class InputManager {
  private keys: Map<string, boolean> = new Map<string, boolean>();
  private mouseKeys: Map<number, boolean> = new Map<number, boolean>();

 
  private mousePosition: Coordinates = { x: 0, y: 0 };
  private lastMousePosition: Coordinates = { x: 0, y: 0 };
  private _mouseMoved: EventEmitter<Coordinates> = new EventEmitter();


  constructor(private canvas?: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.set(e.key, true);
    });

    window.addEventListener("keyup", (e) => {
      this.keys.set(e.key, false);
    });

    window.addEventListener("mouseup", (e: MouseEvent) => {
      this.mouseKeys.set(e.button, false);
    });

    window.addEventListener("mousedown", (e) => {
      this.mouseKeys.set(e.button, true);

    });

    // window.addEventListener("mousemove", (e: MouseEvent) => {
    //   this._updateMousePosition(e.clientX, e.clientY);
    // });
    
    document.addEventListener("pointerlockchange", this.canvasLock, false);
  }

  private canvasLock = () => {
    if (document.pointerLockElement === this.canvas) {
      console.log("The pointer lock status is now locked");
      document.addEventListener("mousemove", this._updateMouse, false);
    } else {
      console.log("The pointer lock status is now unlocked");
      document.removeEventListener("mousemove", this._updateMouse, false);
    }
  }

  private _updateMouse = (e: MouseEvent) => {
    this._updateMousePosition(e.movementX, e.movementY); // by default, outputs a normalized input delta. (x : -1/0/1 , y: -1/0/1)
  }

  public get onMouseMove(): EventEmitter<Coordinates>{
    return this._mouseMoved;
  }

  private _updateMousePosition(x: number, y: number): void{
    this._mouseMoved.emit({x: x , y: y});
  }

  public isKeyDown(e: string): boolean {
    return this.keys.get(e) ?? false;
  }

  public isMouseDown(button: number): boolean {
    return this.mouseKeys.get(button) ?? false;
  }

  // public getMousePosition(): { x: number; y: number } {
  //   return { ...this.mousePosition };
  // }

  // private calculateMouseAxis(): Coordinates {
  //   const x = this.mousePosition.x - this.lastMousePosition.x;
  //   const y = this.mousePosition.y - this.lastMousePosition.y;

  //   // Optionally add dead zones to ignore minor movements
  //   const deadZone = 0.0;
  //   const normalizedX = Math.abs(x) > deadZone ? x : 0;
  //   const normalizedY = Math.abs(y) > deadZone ? y : 0;

  //   return { x: normalizedX, y: normalizedY };
  // }

}
