import fs from 'fs';
import path from 'path';
import https from 'https';

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
        return false;
      }
      
      // Process the API response and update configuration
      if (data.configurations) {
        // Process each service configuration
        for (const [service, config] of Object.entries(data.configurations)) {
          if (this.config[service]) {
            this.config[service] = {
              ...this.config[service],
              ...(config as ServiceConfig),
              enabled: true
            };
          }
        }
        
        console.log('Successfully loaded configuration from Skeet API');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error fetching configuration from Skeet API:', error);
      return false;
    }
  }
  
  /**
   * Make HTTP request to Skeet API
   */
  private makeApiRequest(): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.skeetApiKey}`,
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(this.skeetApiUrl, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`API request failed with status code: ${res.statusCode}`);
            console.error(`Response: ${data}`);
            return resolve(null);
          }
          
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            console.error('Error parsing API response:', error);
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('API request error:', error);
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
    return this.config;
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