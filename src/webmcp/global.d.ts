/**
 * Chromium extensions to the core ModelContext interface. Feature-detect before use.
 * The core surface (registerTool, ontoolchange) comes from webmcp-types.
 */
interface RegisteredTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: { readonly readOnlyHint?: boolean; readonly untrustedContentHint?: boolean };
}

interface ModelContext {
  getTools?(): Promise<ReadonlyArray<RegisteredTool>>;
  executeTool?(tool: RegisteredTool | string, input?: object | string, options?: { signal?: AbortSignal }): Promise<string>;
}
