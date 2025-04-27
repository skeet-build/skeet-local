import * as mysql from 'mysql2/promise';
import { ServiceConfig } from '../utils/configManager.js';

/**
 * MySQL tools and resources manager
 */
export class MySqlService {
  private pool: mysql.Pool | null = null;
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
  }
  
  /**
   * Initialize MySQL connection
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.url) {
        console.error('MySQL URL not provided');
        return false;
      }
      
      // Create connection pool
      this.pool = mysql.createPool(this.config.url);
      
      // Test connection
      const connection = await this.pool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      
      console.log('MySQL connection established successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize MySQL connection:', error);
      return false;
    }
  }
  
  /**
   * Get table schemas for resources
   */
  public async getTableSchemas(): Promise<any[]> {
    if (!this.pool) {
      throw new Error('MySQL service not initialized');
    }
    
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT TABLE_NAME as table_name FROM information_schema.tables WHERE table_schema = ?",
        [new URL(this.config.url!).pathname.replace(/^\//, '')]
      );
      return rows as any[];
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get schema for a specific table
   */
  public async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('MySQL service not initialized');
    }
    
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = ?",
        [tableName, new URL(this.config.url!).pathname.replace(/^\//, '')]
      );
      return rows as any[];
    } finally {
      connection.release();
    }
  }
  
  /**
   * Execute a read-only SQL query
   */
  public async executeQuery(sql: string): Promise<any> {
    if (!this.pool) {
      throw new Error('MySQL service not initialized');
    }
    
    const connection = await this.pool.getConnection();
    try {
      // Set session to read only
      await connection.query("SET SESSION TRANSACTION READ ONLY");
      await connection.beginTransaction();
      
      const [rows] = await connection.query(sql);
      return rows;
    } finally {
      try {
        await connection.rollback();
      } catch (error) {
        console.warn("Could not roll back transaction:", error);
      }
      connection.release();
    }
  }
  
  /**
   * Get available tools
   */
  public getTools(): any[] {
    return [
      {
        name: "mysql_query",
        description: "Run a read-only SQL query against MySQL",
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