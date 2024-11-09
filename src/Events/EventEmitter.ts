export class EventEmitter<T> {
    private listeners: Array<(event: T) => void> = [];
  
    public addListener(listener: (event: T) => void) {
      this.listeners.push(listener);
    }
  
    public removeListener(listener: (event: T) => void) {
      this.listeners = this.listeners.filter((l) => l !== listener);
    }
  
    public emit(event: T) {
      this.listeners.forEach((listener) => listener(event));
    }
  }
  