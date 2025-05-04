import { GEMINI_MODELS, GeminiProvider } from "./GeminiProvider";
import { LLMProvider } from "./LLMProvider";
import { OllamaProvider } from "./OllamaProvider";

export enum LLMProviderType {
	Ollama = "ollama",
	Gemini = "gemini",
}

export class LLMFactory {
	static createProvider(type: LLMProviderType): LLMProvider {
		switch (type) {
			case LLMProviderType.Ollama:
				return new OllamaProvider(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL);
			case LLMProviderType.Gemini:
				return new GeminiProvider(process.env.GEMINI_API_KEY, GEMINI_MODELS.Gemini2Flash);
			default:
				throw new Error(`Unknown LLM provider type: ${type}`);
		}
	}
}
