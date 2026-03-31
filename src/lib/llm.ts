// src/lib/llm.ts
// Resolves the LLM model based on LLM_PROVIDER env var or auto-detection fallback.
//
// Set LLM_PROVIDER explicitly to choose a provider:
//   LLM_PROVIDER = azure-openai | azure-foundry | openai | anthropic | bedrock | vertex | fireworks | xai | openrouter
//
// If LLM_PROVIDER is not set, the first provider whose API key is present wins
// (priority: azure-openai → anthropic → openai → bedrock → vertex → fireworks → xai → azure-foundry → openrouter)
//
// ── Provider env vars ──────────────────────────────────────────────────────────
//
// azure-openai   AZURE_OPENAI_API_KEY, AZURE_OPENAI_RESOURCE_NAME, AZURE_OPENAI_DEPLOYMENT
// azure-foundry  AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY, AZURE_FOUNDRY_MODEL
// openai         OPENAI_API_KEY, OPENAI_MODEL          (default: gpt-4o-mini)
// anthropic      ANTHROPIC_API_KEY, ANTHROPIC_MODEL    (default: claude-haiku-4-5-20251001)
// bedrock        AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL
//                  (default: anthropic.claude-3-5-haiku-20241022-v1:0)
// vertex         GOOGLE_VERTEX_PROJECT, GOOGLE_VERTEX_LOCATION, VERTEX_MODEL
//                  (default: gemini-2.0-flash)
// fireworks      FIREWORKS_API_KEY, FIREWORKS_MODEL    (default: accounts/fireworks/models/llama-v3p3-70b-instruct)
// xai            XAI_API_KEY, XAI_MODEL                (default: grok-3-mini)
// openrouter     OPENROUTER_API_KEY, OPENROUTER_MODEL  (default: google/gemini-2.0-flash-exp:free)

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createFireworks } from "@ai-sdk/fireworks";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAzure as createAzureFoundry } from "@quail-ai/azure-ai-provider";

type Provider =
	| "azure-openai"
	| "azure-foundry"
	| "openai"
	| "anthropic"
	| "bedrock"
	| "vertex"
	| "fireworks"
	| "xai"
	| "openrouter";

function detectProvider(): Provider {
	if (process.env.AZURE_OPENAI_API_KEY) return "azure-openai";
	if (process.env.ANTHROPIC_API_KEY) return "anthropic";
	if (process.env.OPENAI_API_KEY) return "openai";
	if (process.env.AWS_ACCESS_KEY_ID) return "bedrock";
	if (process.env.GOOGLE_VERTEX_PROJECT) return "vertex";
	if (process.env.FIREWORKS_API_KEY) return "fireworks";
	if (process.env.XAI_API_KEY) return "xai";
	if (process.env.AZURE_FOUNDRY_API_KEY) return "azure-foundry";
	return "openrouter";
}

export function resolveModel() {
	const provider =
		(process.env.LLM_PROVIDER as Provider | undefined) ?? detectProvider();

	switch (provider) {
		case "azure-openai": {
			const azure = createAzure({
				resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME!,
				apiKey: process.env.AZURE_OPENAI_API_KEY!,
			});
			return azure.chat(process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini");
		}

		case "azure-foundry": {
			const foundry = createAzureFoundry({
				endpoint: process.env.AZURE_FOUNDRY_ENDPOINT!,
				apiKey: process.env.AZURE_FOUNDRY_API_KEY!,
			});
			return foundry(process.env.AZURE_FOUNDRY_MODEL ?? "gpt-4o-mini");
		}

		case "openai": {
			const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
			return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
		}

		case "anthropic": {
			const anthropic = createAnthropic({
				apiKey: process.env.ANTHROPIC_API_KEY!,
			});
			return anthropic(
				process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
			);
		}

		case "bedrock": {
			const bedrock = createAmazonBedrock({
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
				region: process.env.AWS_REGION ?? "us-east-1",
			});
			return bedrock(
				process.env.BEDROCK_MODEL ?? "anthropic.claude-3-5-haiku-20241022-v1:0",
			);
		}

		case "vertex": {
			const vertex = createVertex({
				project: process.env.GOOGLE_VERTEX_PROJECT!,
				location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
			});
			return vertex(process.env.VERTEX_MODEL ?? "gemini-2.0-flash");
		}

		case "fireworks": {
			const fireworks = createFireworks({
				apiKey: process.env.FIREWORKS_API_KEY!,
			});
			return fireworks(
				process.env.FIREWORKS_MODEL ??
					"accounts/fireworks/models/llama-v3p3-70b-instruct",
			);
		}

		case "xai": {
			const xai = createXai({ apiKey: process.env.XAI_API_KEY! });
			return xai(process.env.XAI_MODEL ?? "grok-3-mini");
		}

		case "openrouter":
		default: {
			const openrouter = createOpenRouter({
				apiKey: process.env.OPENROUTER_API_KEY!,
			});
			return openrouter.chat(
				process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-exp:free",
				{ extraBody: { provider: { allow_fallbacks: false } } },
			);
		}
	}
}
