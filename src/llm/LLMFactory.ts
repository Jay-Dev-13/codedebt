import { LLMProvider } from "./LLMProvider";
import { OllamaProvider } from "./OllamaProvider";

export type LLMProviderType = "ollama" | "gemini";

export class LLMFactory {
	static createProvider(type: LLMProviderType, options: any = {}): LLMProvider {
		switch (type) {
			case "ollama":
				return new OllamaProvider(
					options.baseUrl || process.env.OLLAMA_BASE_URL,
					options.model || process.env.OLLAMA_MODEL
				);
			case "gemini":
				// TODO: Implement Gemini provider
				throw new Error("Gemini provider not implemented yet");
			default:
				throw new Error(`Unknown LLM provider type: ${type}`);
		}
	}
}
