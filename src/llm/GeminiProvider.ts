import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, LLMResponse } from "./LLMProvider";

export class GeminiProvider implements LLMProvider {
	private model: GenerativeModel;
	private genAI: GoogleGenerativeAI;

	constructor(apiKey: string = process.env.GEMINI_API_KEY || "", model: string = "gemini-2.0-flash") {
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
