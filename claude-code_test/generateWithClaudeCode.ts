import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

interface CodeGenerationResult {
  success: boolean;
  messages: SDKMessage[];
  error?: string;
}

export async function generateCodeWithClaude(prompt: string): Promise<CodeGenerationResult> {
  try {
    const messages: SDKMessage[] = [];
    const abortController = new AbortController();

    // Execute the query and collect all messages
    for await (const message of query({
      prompt: prompt,
      abortController: abortController,
      options: {
        model: "claude-haiku-4-5-20251001",
        maxTurns: 10, // Allow multiple turns for complex builds
        systemPrompt: "You are a helpful coding assistant",
        settingSources: ['user', 'project', 'local'],
        // Grant all necessary permissions for code generation
        allowedTools: [
          "Read",
          "Write",
          "Edit",
          "MultiEdit",
          "Bash",
          "LS",
          "Glob",
          "Grep",
          "WebSearch",
          "WebFetch"
        ]
      }
    })) {
      messages.push(message);

      // Log each message for debugging
      console.log(`[${message.type}]`, message);
    }

    return {
      success: true,
      messages: messages
    };

  } catch (error: any) {
    console.error("Error generating code:", error);
    return {
      success: false,
      messages: [],
      error: error.message
    };
  }
}