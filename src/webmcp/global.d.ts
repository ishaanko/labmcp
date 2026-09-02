/**
 * Chromium extensions to the core ModelContext interface. Feature-detect before use.
 * The core surface (registerTool, ontoolchange, WebMCP.ModelContext, WebMCP.RegisteredTool) comes
 * from webmcp-types. These merge into that namespace rather than declaring a separate global
 * `ModelContext`, which `document.modelContext` is not typed as.
 */
declare namespace WebMCP {
  interface ModelContext {
    getTools?(): Promise<ReadonlyArray<RegisteredTool>>;
    executeTool?(tool: RegisteredTool | string, input?: object | string, options?: { signal?: AbortSignal }): Promise<string>;
  }
}
