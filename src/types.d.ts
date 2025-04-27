// Type declarations for external modules

declare module 'redis' {
  export interface RedisClientType {
    connect(): Promise<void>;
    ping(): Promise<string>;
    keys(pattern: string): Promise<string[]>;
    type(key: string): Promise<string>;
    lLen(key: string): Promise<number>;
    sMembers(key: string): Promise<string[]>;
    hGetAll(key: string): Promise<Record<string, string>>;
    zCard(key: string): Promise<number>;
    sendCommand(args: string[]): Promise<any>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { EX?: number }): Promise<string>;
    quit(): Promise<string>;
  }
  
  export function createClient(options: { url: string }): RedisClientType;
}

declare module '@opensearch-project/opensearch' {
  export class Client {
    constructor(options: { node: string, ssl?: { rejectUnauthorized: boolean } });
    cat: {
      health: () => Promise<any>;
      indices: (options: { format: string }) => Promise<{ body: any[] }>;
    };
    indices: {
      getMapping: (options: { index: string }) => Promise<{ body: any }>;
    };
    search: (options: { body: any, index?: string }) => Promise<{ body: any }>;
  }
}

declare module 'mysql2/promise' {
  export interface Pool {
    getConnection(): Promise<Connection>;
    end(): Promise<void>;
  }
  
  export interface Connection {
    query(sql: string, values?: any[]): Promise<[any, any]>;
    beginTransaction(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
  }
  
  export function createPool(config: string | object): Pool;
} 