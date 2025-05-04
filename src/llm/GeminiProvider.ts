import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, LLMResponse } from "./LLMProvider";

export enum GEMINI_MODELS {
	Gemini2Flash = "gemini-2.0-flash",
	Gemini2FlashLite = "gemini-2.0-flash-lite",
	Gemini2Pro = "gemini-2.0-pro",
	GeminiEmbeddingExp0307 = "embedding-001",
}

export class GeminiProvider implements LLMProvider {
	private model: GenerativeModel;
	private genAI: GoogleGenerativeAI;

	constructor(apiKey: string = process.env.GEMINI_API_KEY || "", model: string = GEMINI_MODELS.Gemini2Pro) {
		if (!apiKey) {
			throw new Error("Gemini API key is required");
		}
		this.genAI = new GoogleGenerativeAI(apiKey);
		this.model = this.genAI.getGenerativeModel({ model });
	}

	async generateResponse(prompt: string): Promise<LLMResponse> {
		try {
			const result = await this.model.generateContent(prompt);
			const text = result.response.text();

			return {
				response: text,
				done: true,
			};
		} catch (error: any) {
			throw new Error(`Gemini API error: ${error.message}`);
		}
	}
}
