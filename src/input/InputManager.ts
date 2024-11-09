export class InputManager {
    private keys: Map<string, boolean> = new Map <string, boolean> ();

    constructor(){
        window.addEventListener("keydown", (e) => {
            this.keys.set(e.key, true);
        })

        window.addEventListener("keyup", (e) => {
            this.keys.set(e.key, false);
        })
    }

    public isKeyDown(e: string): boolean{
        return this.keys.get(e) ?? false;
    }
}