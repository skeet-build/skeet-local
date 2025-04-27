declare module '@modelcontextprotocol/sdk/server' {
  export class Server {
    constructor(
      info: { name: string; version: string },
      config: { capabilities: { resources: any; tools: any } }
    );
    connect(transport: any): Promise<void>;
    setRequestHandler(schema: any, handler: any): void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio' {
  export class StdioServerTransport {
    constructor();
  }
}

declare module '@modelcontextprotocol/sdk/types' {
  export const CallToolRequestSchema: any;
  export const ListResourcesRequestSchema: any;
  export const ListToolsRequestSchema: any;
  export const ReadResourceRequestSchema: any;
} 