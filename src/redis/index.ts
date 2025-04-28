import { createClient, RedisClientType } from 'redis';
import { ServiceConfig } from '../utils/configManager.js';

/**
 * Redis tools and resources manager
 */
export class RedisService {
  private client: RedisClientType | null = null;
  private config: ServiceConfig;
  private connectionDetails: any;
  
  constructor(config: ServiceConfig) {
    this.config = config;
    this.connectionDetails = config.options?.connection || {};
  }
  
  /**
   * Initialize Redis connection
   */
  public async initialize(): Promise<boolean> {
    try {
      // Check if we have connection details
      if (!this.connectionDetails && !this.config.url) {
        console.error('Redis connection information not provided');
        return false;
      }
      
      // If we have the dsn from the connection details, use it directly
      if (this.connectionDetails.dsn) {
        console.log(`Using direct DSN for Redis connection: ${this.connectionDetails.name}`);
        this.client = createClient({ url: this.connectionDetails.dsn });
      } else if (this.config.url) {
        // Otherwise use the URL configured in the service config
        console.log(`Using URL connection for Redis: ${this.config.url}`);
        this.client = createClient({ url: this.config.url });
      } else {
        console.error('No valid connection configuration for Redis');
        return false;
      }
      
      // Make sure we have a client before attempting to connect
      if (!this.client) {
        console.error('Failed to create Redis client');
        return false;
      }
      
      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      
      console.log('Redis connection established successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Redis connection:', error);
      return false;
    }
  }
  
  /**
   * Get all keys for resources
   */
  public async getKeys(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    
    // Get all keys with their types
    const keys = await this.client.keys('*');
    const keysWithTypes = await Promise.all(
      keys.map(async (key: string) => {
        const type = await this.client!.type(key);
        return { key, type };
      })
    );
    
    return keysWithTypes;
  }
  
  /**
   * Get schema for a specific key
   */
  public async getKeySchema(keyName: string): Promise<any> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    
    const type = await this.client.type(keyName);
    let schemaData: any = { key: keyName, type };
    
    // Get type-specific information
    switch (type) {
      case 'string':
        schemaData.value = await this.client.get(keyName);
        break;
      case 'list':
        schemaData.length = await this.client.lLen(keyName);
        break;
      case 'set':
        schemaData.members = await this.client.sMembers(keyName);
        break;
      case 'hash':
        schemaData.fields = await this.client.hGetAll(keyName);
        break;
      case 'zset':
        schemaData.length = await this.client.zCard(keyName);
        break;
    }
    
    return schemaData;
  }
  
  /**
   * Execute a Redis command
   */
  public async executeCommand(command: string): Promise<any> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    
    // Parse the command string into an array of arguments
    const commandParts = command.split(/\s+/);
    const commandName = commandParts[0].toUpperCase();
    
    // Restrict to read-only commands and selected SET commands
    const allowedCommands = [
      // Read-only commands
      'GET', 'MGET', 'STRLEN', 'HGET', 'HGETALL', 'HMGET', 'HLEN', 'HKEYS', 'HVALS',
      'LLEN', 'LRANGE', 'LINDEX', 'SISMEMBER', 'SMEMBERS', 'SCARD', 'ZRANGE', 'ZRANGEBYSCORE',
      'ZCARD', 'ZSCORE', 'ZCOUNT', 'KEYS', 'TYPE', 'TTL', 'EXISTS', 'INFO', 'SCAN',
      // Set read operations
      'SINTER', 'SUNION', 'SDIFF', 'SRANDMEMBER',
      // Set write operations
      'SADD', 'SREM', 'SPOP', 'SMOVE', 'SINTERSTORE', 'SUNIONSTORE', 'SDIFFSTORE'
    ];
    
    if (!allowedCommands.includes(commandName)) {
      throw new Error(`Command "${commandName}" is not allowed. Only certain commands are permitted.`);
    }
    
    // Execute the command
    return this.client.sendCommand(commandParts);
  }
  
  /**
   * Get a specific Redis key
   */
  public async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    
    return this.client.get(key);
  }
  
  /**
   * Set a Redis key value
   */
  public async set(key: string, value: string, expiry?: number): Promise<string> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    
    if (expiry) {
      return this.client.set(key, value, { EX: expiry });
    } else {
      return this.client.set(key, value);
    }
  }
  
  /**
   * Get available tools
   */
  public getTools(): any[] {
    return [
      {
        name: "redis_query",
        description: "Execute Redis commands (primarily read operations)",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string" },
          },
          required: ["command"]
        },
      },
      {
        name: "redis_get",
        description: "Get value for a specific Redis key",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
          },
          required: ["key"]
        },
      },
      {
        name: "redis_set",
        description: "Set value for a specific Redis key",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            expiry: { type: "number" },
          },
          required: ["key", "value"]
        },
      }
    ];
  }
  
  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
} 