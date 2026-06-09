import type { AIProvider } from "@/modules/messaging/ai/ai-provider";
import { MockAIProvider } from "@/modules/messaging/ai/mock-ai-provider";
import { RealAIProvider } from "@/modules/messaging/ai/real-ai-provider";

/** Mirror the compliance-gateway pattern: real when configured, else mock. */
export function getAIProvider(): AIProvider {
  const key = process.env.AI_API_KEY;
  return key ? new RealAIProvider(key) : new MockAIProvider();
}

export type { AIProvider } from "@/modules/messaging/ai/ai-provider";
