import * as mysql from 'mysql2/promise';
import { ServiceConfig } from '../utils/configManager.js';

/**
 * MySQL tools and resources manager
 */
export class MySqlService {
  private pool: mysql.Pool | null = null;
  private config: ServiceConfig;
  private connectionDetails: any;
  
  constructor(config: ServiceConfig) {
    this.config = config;
    this.connectionDetails = config.options?.connection || {};
  }
  
  /**
   * Initialize MySQL connection
   */
  public async initialize(): Promise<boolean> {
    try {
      // Check if we have connection details
      if (!this.connectionDetails && !this.config.url) {
        console.error('MySQL connection information not provided');
        return false;
      }
      
      // If we have the dsn from the connection details, use it directly
      if (this.connectionDetails.dsn) {
        console.log(`Using direct DSN for MySQL connection: ${this.connectionDetails.name}`);
        this.pool = mysql.createPool(this.connectionDetails.dsn);
      } else if (this.config.url) {
        // Otherwise use the URL configured in the service config
        console.log(`Using URL connection for MySQL: ${this.config.url}`);
        this.pool = mysql.createPool(this.config.url);
      } else {
        console.error('No valid connection configuration for MySQL');
        return false;
      }
      
      // Make sure we have a pool before attempting to connect
      if (!this.pool) {
        console.error('Failed to create MySQL connection pool');
        return false;
      }
      
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