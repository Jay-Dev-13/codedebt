import { LLMProvider } from "./LLMProvider";
import { OllamaProvider } from "./OllamaProvider";
import { GeminiProvider } from "./GeminiProvider";

export enum LLMProviderType {
	Ollama = "ollama",
	Gemini = "gemini",
}

export class LLMFactory {
	static createProvider(type: LLMProviderType, options: any = {}): LLMProvider {
		switch (type) {
			case LLMProviderType.Ollama:
				return new OllamaProvider(
					options.baseUrl || process.env.OLLAMA_BASE_URL,
					options.model || process.env.OLLAMA_MODEL
				);
			case LLMProviderType.Gemini:
				return new GeminiProvider(
					options.apiKey || process.env.GEMINI_API_KEY,
					options.model || process.env.GEMINI_MODEL
				);
			default:
				throw new Error(`Unknown LLM provider type: ${type}`);
		}
	}
}
