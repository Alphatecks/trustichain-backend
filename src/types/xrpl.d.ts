declare module 'xrpl' {
  export class Client {
    constructor(server: string, options?: { connectionTimeout?: number; timeout?: number });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    on(event: string, listener: (...args: unknown[]) => void): this;
    request(request: Record<string, unknown>): Promise<unknown>;
  }
  export function xrpToDrops(xrp: string | number): string;
  export function dropsToXrp(drops: string | number): string;
}
