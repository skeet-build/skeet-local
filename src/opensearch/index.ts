import { Client } from '@opensearch-project/opensearch';
import { ServiceConfig } from '../utils/configManager.js';

/**
 * OpenSearch tools and resources manager
 */
export class OpenSearchService {
  private client: Client | null = null;
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
  }
  
  /**
   * Initialize OpenSearch connection
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.url) {
        console.error('OpenSearch URL not provided');
        return false;
      }
      
      this.client = new Client({
        node: this.config.url,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      // Test connection
      await this.client.cat.health();
      
      console.log('OpenSearch connection established successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenSearch connection:', error);
      return false;
    }
  }
  
  /**
   * Get all indices for resources
   */
  public async getIndices(): Promise<any[]> {
    if (!this.client) {
      throw new Error('OpenSearch service not initialized');
    }
    
    const indices = await this.client.cat.indices({
      format: 'json'
    });
    
    return indices.body;
  }
  
  /**
   * Get mapping for a specific index
   */
  public async getIndexMapping(indexName: string): Promise<any> {
    if (!this.client) {
      throw new Error('OpenSearch service not initialized');
    }
    
    const mappingResponse = await this.client.indices.getMapping({
      index: indexName
    });
    
    return mappingResponse.body;
  }
  
  /**
   * Execute a search query
   */
  public async search(query: string, index?: string): Promise<any> {
    if (!this.client) {
      throw new Error('OpenSearch service not initialized');
    }
    
    // Parse the query as JSON if it's a valid JSON string
    let parsedQuery;
    try {
      parsedQuery = JSON.parse(query);
    } catch (e) {
      // If parsing fails, use the query as a simple search string
      parsedQuery = {
        query: {
          query_string: {
            query: query
          }
        }
      };
    }
    
    const searchParams: any = {
      body: parsedQuery
    };
    
    // Add index if specified
    if (index) {
      searchParams.index = index;
    }
    
    const result = await this.client.search(searchParams);
    return result.body;
  }
  
  /**
   * Get available tools
   */
  public getTools(): any[] {
    return [
      {
        name: "opensearch_search",
        description: "Run a search query against OpenSearch",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            index: { type: "string" },
          },
          required: ["query"]
        },
      }
    ];
  }
  
  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    // OpenSearch client doesn't have an explicit shutdown/close method
    this.client = null;
  }
} 