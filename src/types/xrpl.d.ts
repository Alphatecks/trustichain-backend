declare module 'xrpl' {
  export class Client {
    constructor(server: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    // ...other methods as needed
  }
  export function xrpToDrops(xrp: string | number): string;
  export function dropsToXrp(drops: string | number): string;
  // ...other exports as needed
}
