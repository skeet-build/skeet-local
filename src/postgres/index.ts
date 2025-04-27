import pg from 'pg';
import { ServiceConfig } from '../utils/configManager.js';

/**
 * PostgreSQL tools and resources manager
 */
export class PostgresService {
  private pool: pg.Pool | null = null;
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
  }
  
  /**
   * Initialize PostgreSQL connection
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.url) {
        console.error('PostgreSQL URL not provided');
        return false;
      }
      
      this.pool = new pg.Pool({
        connectionString: this.config.url,
      });
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('PostgreSQL connection established successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize PostgreSQL connection:', error);
      return false;
    }
  }
  
  /**
   * Get table schemas for resources
   */
  public async getTableSchemas(): Promise<any[]> {
    if (!this.pool) {
      throw new Error('PostgreSQL service not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get schema for a specific table
   */
  public async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('PostgreSQL service not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
        [tableName]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Execute a read-only SQL query
   */
  public async executeQuery(sql: string): Promise<any> {
    if (!this.pool) {
      throw new Error('PostgreSQL service not initialized');
    }
    
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);
      return result.rows;
    } finally {
      try {
        await client.query("ROLLBACK");
      } catch (error) {
        console.warn("Could not roll back transaction:", error);
      }
      client.release();
    }
  }
  
  /**
   * Get available tools
   */
  public getTools(): any[] {
    return [
      {
        name: "postgres_query",
        description: "Run a read-only SQL query against PostgreSQL",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
          required: ["sql"]
        },
      }
    ];
  }
  
  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
} 