#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { serviceManager } from "./src/serviceManager.js";
import { configManager } from "./src/utils/configManager.js";

// Display banner
console.log("🚀 Starting Skeet Local MCP Server...");
console.log("-----------------------------------");

// Check for API key and display authentication status
const skeetApiKey = process.env.SKEET_API_KEY;
if (skeetApiKey) {
  console.log("✅ Skeet API key detected. Will fetch remote configurations from Skeet API.");
  console.log(`🔗 API URL: ${process.env.SKEET_API_URL || 'http://localhost:4444/api/integrations'}`);
} else {
  console.log("⚠️  No Skeet API key found. Running in local-only mode.");
  console.log("   To enable remote configuration, set the SKEET_API_KEY environment variable.");
}

// Initialize the MCP server
const server = new Server(
  {
    name: "skeet-build/skeet-local",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Initialize services with configuration
async function initializeWithConfig() {
  console.log("\n🔄 Refreshing configurations from Skeet API...");
  
  try {
    // First refresh configurations from all sources including Skeet API
    const config = await configManager.refreshConfigurations();
    console.log("✅ Configuration refresh completed");
    
    // Log active configurations
    Object.entries(config).forEach(([service, serviceConfig]) => {
      if (serviceConfig.enabled) {
        console.log(`🔌 ${service} enabled: ${serviceConfig.url || 'custom configuration'}`);
      }
    });
    
    // Then initialize the service manager with the updated configurations
    console.log("\n🔄 Initializing services...");
    const success = await serviceManager.initialize();
    
    if (success) {
      const activeServices = serviceManager.getActiveServices();
      if (activeServices.length > 0) {
        console.log("✅ Service manager initialized successfully");
        console.log(`🧰 Available services: ${activeServices.join(', ')}`);
      } else {
        console.log("⚠️  No services are currently active.");
        console.log("   To enable services, configure database URLs via environment variables or Skeet API.");
      }
    } else {
      console.warn("⚠️  Service manager initialization had issues");
    }
  } catch (error) {
    console.error("❌ Error initializing services:", error);
  }
  
  console.log("\n📡 MCP Server is now running and ready to handle requests.");
  console.log("-----------------------------------");
}

// Start initialization process
initializeWithConfig();

// List all tools from all services
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: serviceManager.getTools(),
  };
});

// List resources from all services
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Resources will be implemented later based on active services
  return { resources: [] };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  // Resource reading will be implemented later based on active services
  throw new Error("Resource not found");
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await serviceManager.executeTool(
      request.params.name, 
      request.params.arguments || {}
    );
    
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: false,
    };
  } catch (error) {
    console.error(`Error executing tool ${request.params.name}:`, error);
    throw error;
  }
});

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down Skeet Local MCP Server...");
  await serviceManager.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down Skeet Local MCP Server...");
  await serviceManager.shutdown();
  process.exit(0);
});

runServer().catch(console.error);
