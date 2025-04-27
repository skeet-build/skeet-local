import { configManager, SkeetConfig } from './utils/configManager.js';
import { PostgresService } from './postgres/index.js';
import { MySqlService } from './mysql/index.js';
import { RedisService } from './redis/index.js';
import { OpenSearchService } from './opensearch/index.js';

/**
 * Service Manager for Skeet MCP
 * Manages all database services and their tools
 */
export class ServiceManager {
  private postgresService: PostgresService | null = null;
  private mysqlService: MySqlService | null = null;
  private redisService: RedisService | null = null;
  private opensearchService: OpenSearchService | null = null;
  
  private activeServices: string[] = [];
  private tools: any[] = [];
  private isApiAuthenticated: boolean = false;
  
  constructor() {}
  
  /**
   * Initialize all configured services
   */
  public async initialize(): Promise<boolean> {
    try {
      // Refresh configurations to get latest service configs
      const config = await configManager.refreshConfigurations();
      
      // Track API authentication status
      this.isApiAuthenticated = configManager.isApiAuthenticated();
      
      // Initialize PostgreSQL if enabled
      if (config.postgres.enabled) {
        console.log('🔄 Initializing PostgreSQL service...');
        this.postgresService = new PostgresService(config.postgres);
        const success = await this.postgresService.initialize();
        if (success) {
          this.activeServices.push('postgres');
          this.tools = [...this.tools, ...this.postgresService.getTools()];
          console.log('✅ PostgreSQL service initialized successfully');
        } else {
          this.postgresService = null;
          console.warn('⚠️  PostgreSQL service initialization failed');
        }
      }
      
      // Initialize MySQL if enabled
      if (config.mysql.enabled) {
        console.log('🔄 Initializing MySQL service...');
        this.mysqlService = new MySqlService(config.mysql);
        const success = await this.mysqlService.initialize();
        if (success) {
          this.activeServices.push('mysql');
          this.tools = [...this.tools, ...this.mysqlService.getTools()];
          console.log('✅ MySQL service initialized successfully');
        } else {
          this.mysqlService = null;
          console.warn('⚠️  MySQL service initialization failed');
        }
      }
      
      // Initialize Redis if enabled
      if (config.redis.enabled) {
        console.log('🔄 Initializing Redis service...');
        this.redisService = new RedisService(config.redis);
        const success = await this.redisService.initialize();
        if (success) {
          this.activeServices.push('redis');
          this.tools = [...this.tools, ...this.redisService.getTools()];
          console.log('✅ Redis service initialized successfully');
        } else {
          this.redisService = null;
          console.warn('⚠️  Redis service initialization failed');
        }
      }
      
      // Initialize OpenSearch if enabled
      if (config.opensearch.enabled) {
        console.log('🔄 Initializing OpenSearch service...');
        this.opensearchService = new OpenSearchService(config.opensearch);
        const success = await this.opensearchService.initialize();
        if (success) {
          this.activeServices.push('opensearch');
          this.tools = [...this.tools, ...this.opensearchService.getTools()];
          console.log('✅ OpenSearch service initialized successfully');
        } else {
          this.opensearchService = null;
          console.warn('⚠️  OpenSearch service initialization failed');
        }
      }
      
      // Add refresh tool
      this.tools.push({
        name: "refresh_skeet_tools",
        description: "Refreshes the available Skeet tools and configurations",
        inputSchema: {
          type: "object",
          properties: {},
        },
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing services:', error);
      return false;
    }
  }
  
  /**
   * Refresh all services and tools
   */
  public async refreshServices(): Promise<boolean> {
    try {
      console.log('🔄 Refreshing Skeet services and tools...');
      
      // Clean up existing services
      await this.shutdown();
      
      // Reset state
      this.activeServices = [];
      this.tools = [];
      this.postgresService = null;
      this.mysqlService = null;
      this.redisService = null;
      this.opensearchService = null;
      
      // Initialize everything again
      const success = await this.initialize();
      
      if (success) {
        console.log('✅ Services refresh complete');
      } else {
        console.log('⚠️  Services refresh completed with issues');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error refreshing services:', error);
      return false;
    }
  }
  
  /**
   * Get all available tools
   */
  public getTools(): any[] {
    return this.tools;
  }
  
  /**
   * Get all active services
   */
  public getActiveServices(): string[] {
    return this.activeServices;
  }
  
  /**
   * Check if API is authenticated
   */
  public isUsingSkeetApi(): boolean {
    return this.isApiAuthenticated;
  }
  
  /**
   * Execute a tool by name
   */
  public async executeTool(toolName: string, args: any): Promise<any> {
    console.log(`🔧 Executing tool: ${toolName}`);
    
    switch(toolName) {
      case 'refresh_skeet_tools':
        const success = await this.refreshServices();
        return {
          status: success ? 'success' : 'error',
          message: success 
            ? 'Successfully refreshed Skeet tools and configurations' 
            : 'Failed to refresh Skeet tools and configurations',
          apiIntegrated: this.isApiAuthenticated,
          activeServices: this.activeServices
        };
        
      case 'postgres_query':
        if (!this.postgresService) throw new Error('PostgreSQL service not initialized');
        return await this.postgresService.executeQuery(args.sql);
        
      case 'mysql_query':
        if (!this.mysqlService) throw new Error('MySQL service not initialized');
        return await this.mysqlService.executeQuery(args.sql);
        
      case 'redis_query':
        if (!this.redisService) throw new Error('Redis service not initialized');
        return await this.redisService.executeCommand(args.command);
        
      case 'redis_get':
        if (!this.redisService) throw new Error('Redis service not initialized');
        return await this.redisService.get(args.key);
        
      case 'redis_set':
        if (!this.redisService) throw new Error('Redis service not initialized');
        return await this.redisService.set(args.key, args.value, args.expiry);
        
      case 'opensearch_search':
        if (!this.opensearchService) throw new Error('OpenSearch service not initialized');
        return await this.opensearchService.search(args.query, args.index);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Shutdown all services cleanly
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('🔄 Shutting down active services...');
      
      if (this.postgresService) {
        await this.postgresService.shutdown();
        console.log('✅ PostgreSQL service shut down');
      }
      
      if (this.mysqlService) {
        await this.mysqlService.shutdown();
        console.log('✅ MySQL service shut down');
      }
      
      if (this.redisService) {
        await this.redisService.shutdown();
        console.log('✅ Redis service shut down');
      }
      
      if (this.opensearchService) {
        await this.opensearchService.shutdown();
        console.log('✅ OpenSearch service shut down');
      }
      
      console.log('✅ All services shut down successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Export singleton instance
export const serviceManager = new ServiceManager(); 