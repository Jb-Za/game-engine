import { EventEmitter } from "../events/EventEmitter";


export type Coordinates = { x: number; y: number };

export class InputManager {
  private keys: Map<string, boolean> = new Map<string, boolean>();
  private mouseKeys: Map<number, boolean> = new Map<number, boolean>();
  private _mouseMoved: EventEmitter<Coordinates> = new EventEmitter();


  constructor(private canvas?: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.set(e.code, true);
      if (e.key.length === 1) {
        this.keys.set(e.key.toLowerCase(), true);
      } else {
        this.keys.set(e.key, true);
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys.set(e.code, false);
      if (e.key.length === 1) {
        this.keys.set(e.key.toLowerCase(), false);
        this.keys.set(e.key.toUpperCase(), false);
      } else {
        this.keys.set(e.key, false);
      }
    });

    window.addEventListener("mouseup", (e: MouseEvent) => {
      this.mouseKeys.set(e.button, false);
    });

    window.addEventListener("mousedown", (e) => {
      this.mouseKeys.set(e.button, true);
    });

    window.addEventListener("wheel", (e: WheelEvent) => {
      if (e.deltaY < 0) {
        this.keys.set("mousewheelup", true);
        this.keys.set("mousewheeldown", false);
      } else if (e.deltaY > 0) {
        this.keys.set("mousewheeldown", true);
        this.keys.set("mousewheelup", false);
      }
      // Optionally, reset after a short delay to avoid stuck state
      setTimeout(() => {
        this.keys.set("mousewheelup", false);
        this.keys.set("mousewheeldown", false);
      }, 50);
    });


    
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

  public isMouseWheelUp(): boolean {
    return this.keys.get("mousewheelup") ?? false;
  }

  public isMouseWheelDown(): boolean {
    return this.keys.get("mousewheeldown") ?? false;
  }

  private _updateMousePosition(x: number, y: number): void{
    this._mouseMoved.emit({x: x , y: y});
  }

  public isKeyDown(e: string): boolean {
    return this.keys.get(e) ?? false;
  }

  // Method to manually clear a stuck key
  public clearKey(key: string): void {
    this.keys.set(key, false);
  }

  // Method to clear all keys (useful for debugging)
  public clearAllKeys(): void {
    this.keys.clear();
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
