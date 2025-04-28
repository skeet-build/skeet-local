import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface ServiceConfig {
  enabled: boolean;
  url?: string;
  options?: Record<string, any>;
}

export interface SkeetConfig {
  postgres: ServiceConfig;
  mysql: ServiceConfig;
  redis: ServiceConfig;
  opensearch: ServiceConfig;
  [key: string]: ServiceConfig;
}

class ConfigManager {
  private config: SkeetConfig;
  private configPath: string;
  private skeetApiUrl: string;
  private skeetApiKey: string | null;
  
  constructor() {
    this.config = {
      postgres: { enabled: false },
      mysql: { enabled: false },
      redis: { enabled: false },
      opensearch: { enabled: false }
    };
    
    // Default config path can be overridden with env var
    this.configPath = process.env.SKEET_CONFIG_PATH || path.join(process.cwd(), 'skeet.config.json');
    
    // Skeet API configuration
    this.skeetApiUrl = process.env.SKEET_API_URL || 'https://skeet.sh/api/integrations';
    this.skeetApiKey = process.env.SKEET_API_KEY || null;
  }
  
  /**
   * Fetch configuration from Skeet API
   */
  private async fetchFromApi(): Promise<boolean> {
    // Skip if no API key is provided
    if (!this.skeetApiKey) {
      console.log('No Skeet API key provided, skipping API configuration');
      return false;
    }
    
    console.log(`Fetching configuration from Skeet API: ${this.skeetApiUrl}`);
    
    try {
      const data = await this.makeApiRequest();
      
      if (!data) {
        console.error('\n❌ Failed to fetch configurations from Skeet API.');
        console.error('Please visit https://skeet.build/dashboard to update your MCP server configurations.');
        console.error('You can also check your SKEET_API_KEY and SKEET_API_URL environment variables.');
        return false;
      }
      
      // Process the API response and update configuration based on integrations
      if (data.integrations) {
        const integrations = data.integrations;
        
        // Process PostgreSQL connections
        if (integrations.postgres?.connections?.length > 0) {
          const primaryConnection = integrations.postgres.connections.find(conn => conn.is_primary === true);
          if (primaryConnection) {
            this.config.postgres = {
              enabled: true,
              url: primaryConnection.dsn || '',
              options: {
                connection: primaryConnection
              }
            };
            console.log(`Configured primary PostgreSQL connection: ${primaryConnection.name}`);
          }
        }
        
        // Process MySQL connections
        if (integrations.mysql?.connections?.length > 0) {
          const primaryConnection = integrations.mysql.connections.find(conn => conn.is_primary === true);
          if (primaryConnection) {
            this.config.mysql = {
              enabled: true,
              url: primaryConnection.dsn || '',
              options: {
                connection: primaryConnection
              }
            };
            console.log(`Configured primary MySQL connection: ${primaryConnection.name}`);
          }
        }
        
        // Process Redis connections
        if (integrations.redis?.connections?.length > 0) {
          const primaryConnection = integrations.redis.connections.find(conn => conn.is_primary === true);
          if (primaryConnection) {
            this.config.redis = {
              enabled: true,
              url: primaryConnection.dsn || '',
              options: {
                connection: primaryConnection
              }
            };
            console.log(`Configured primary Redis connection: ${primaryConnection.name}`);
          }
        }
        
        // Process OpenSearch connections
        if (integrations.opensearch?.connections?.length > 0) {
          const primaryConnection = integrations.opensearch.connections.find(conn => conn.is_primary === true);
          if (primaryConnection) {
            this.config.opensearch = {
              enabled: true,
              url: primaryConnection.dsn || '',
              options: {
                connection: primaryConnection
              }
            };
            console.log(`Configured primary OpenSearch connection: ${primaryConnection.name}`);
          }
        }
        
        console.log('Successfully loaded configuration from Skeet API');
        return true;
      } else {
        console.error('\n❌ No integrations found in the API response.');
        console.error('Please visit https://skeet.build/dashboard to configure your MCP server integrations.');
        return false;
      }
    } catch (error) {
      console.error('Error fetching configuration from Skeet API:', error);
      console.error('\n❌ Failed to connect to Skeet API.');
      console.error('Please visit https://skeet.build/dashboard to verify your MCP server configurations.');
      console.error('Make sure your SKEET_API_KEY and SKEET_API_URL environment variables are set correctly.');
      return false;
    }
  }
  
  /**
   * Build database URL from connection info
   * Note: This is kept for backward compatibility but no longer used
   * since we now use the dsn field directly.
   */
  private buildDatabaseUrl(type: string, connection: any): string {
    // If dsn is available, use it directly
    if (connection.dsn) {
      return connection.dsn;
    }
    
    // Fallback to building URL from components
    if (connection.hostname && connection.port && connection.database) {
      switch (type) {
        case 'postgres':
          return `postgresql://${connection.hostname}:${connection.port}/${connection.database}`;
        case 'mysql':
          return `mysql://${connection.hostname}:${connection.port}/${connection.database}`;
        case 'redis':
          return `redis://${connection.hostname}:${connection.port}/${connection.database}`;
        case 'opensearch':
          return `http://${connection.hostname}:${connection.port}`;
        default:
          return '';
      }
    }
    
    console.warn(`No connection details found for ${type} connection`);
    return '';
  }
  
  /**
   * Make HTTP request to Skeet API
   */
  private makeApiRequest(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use user_api_key as a query parameter instead of Authorization header
      const apiUrl = `${this.skeetApiUrl}?user_api_key=${this.skeetApiKey}`;
      
      const options = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Determine if we're using http or https
      const requestModule = this.skeetApiUrl.startsWith('https') ? https : http;
      
      const req = requestModule.request(apiUrl, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`API request failed with status code: ${res.statusCode}`);
            console.error(`Response: ${data}`);
            console.error('\n❌ Failed to authenticate with Skeet API.');
            console.error('Please visit https://skeet.build/dashboard to verify your API key and settings.');
            return resolve(null);
          }
          
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            console.error('Error parsing API response:', error);
            console.error('\n❌ Received invalid data from Skeet API.');
            console.error('Please visit https://skeet.build/dashboard to check the status of your account.');
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('API request error:', error);
        console.error('\n❌ Failed to connect to Skeet API server.');
        console.error('Please check your internet connection and visit https://skeet.build/dashboard to verify the API endpoint.');
        reject(error);
      });
      
      req.end();
    });
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): void {
    console.log('Loading configuration from environment variables...');
    
    // PostgreSQL
    if (process.env.POSTGRES_URL) {
      this.config.postgres = {
        enabled: true,
        url: process.env.POSTGRES_URL
      };
    }
    
    // MySQL
    if (process.env.MYSQL_URL) {
      this.config.mysql = {
        enabled: true,
        url: process.env.MYSQL_URL
      };
    }
    
    // Redis
    if (process.env.REDIS_URL) {
      this.config.redis = {
        enabled: true,
        url: process.env.REDIS_URL
      };
    }
    
    // OpenSearch
    if (process.env.OPENSEARCH_URL) {
      this.config.opensearch = {
        enabled: true,
        url: process.env.OPENSEARCH_URL
      };
    }
  }
  
  /**
   * Load configuration from config file
   */
  private loadFromFile(): boolean {
    try {
      if (fs.existsSync(this.configPath)) {
        console.log(`Loading configuration from ${this.configPath}...`);
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        
        // Merge with current config
        Object.keys(fileConfig).forEach(key => {
          if (this.config[key]) {
            this.config[key] = {
              ...this.config[key],
              ...fileConfig[key],
              enabled: true
            };
          }
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading config file:', error);
      return false;
    }
  }
  
  /**
   * Refresh all configurations
   */
  public async refreshConfigurations(): Promise<SkeetConfig> {
    // Reset config
    this.config = {
      postgres: { enabled: false },
      mysql: { enabled: false },
      redis: { enabled: false },
      opensearch: { enabled: false }
    };
    
    try {
      // Priority of configuration sources (highest priority last):
      // 1. Environment variables
      // 2. Local config file
      // 3. Skeet API
      this.loadFromEnv();
      this.loadFromFile();
      await this.fetchFromApi();
      
      // Load dynamic services if any exist
      await this.discoverServices();
      
      console.log('Configuration refresh completed');
      
      // Check if any services are enabled
      const enabledServices = Object.entries(this.config)
        .filter(([_, config]) => config.enabled)
        .map(([service]) => service);
      
      if (enabledServices.length === 0) {
        console.warn('\n⚠️ No services were enabled after configuration.');
        console.warn('Please visit https://skeet.build/dashboard to configure your MCP server integrations,');
        console.warn('or set environment variables for direct database connections.');
      }
      
      return this.config;
    } catch (error) {
      console.error('❌ Failed to refresh configurations:', error);
      console.error('Please visit https://skeet.build/dashboard to update your MCP server configurations.');
      return this.config;
    }
  }
  
  /**
   * Discover services dynamically 
   * This could be extended to detect services running in Docker, etc.
   */
  private async discoverServices(): Promise<void> {
    // This is a placeholder for future implementation
    // Here you could scan for Docker containers, network services, etc.
    console.log('Checking for additional services...');
    
    // Example: Auto-detect local PostgreSQL instance
    // try {
    //   const result = await someTestConnection();
    //   if (result) this.config.postgres.enabled = true;
    // } catch (e) {}
  }
  
  /**
   * Get the current configuration
   */
  public getConfig(): SkeetConfig {
    return this.config;
  }
  
  /**
   * Check if a specific service is enabled
   */
  public isServiceEnabled(service: string): boolean {
    return !!this.config[service]?.enabled;
  }
  
  /**
   * Get service configuration
   */
  public getServiceConfig(service: string): ServiceConfig | undefined {
    return this.config[service];
  }
  
  /**
   * Get API authentication status
   */
  public isApiAuthenticated(): boolean {
    return !!this.skeetApiKey;
  }
}

// Export singleton instance
export const configManager = new ConfigManager(); 