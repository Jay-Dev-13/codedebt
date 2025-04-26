import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, LLMResponse } from "./LLMProvider";

export class GeminiProvider implements LLMProvider {
    private model: string;
    private genAI: GoogleGenerativeAI;

    constructor(apiKey: string = process.env.GEMINI_API_KEY || "", model: string = "gemini-2.0-flash") {
        if (!apiKey) {
            throw new Error("Gemini API key is required");
        }
        this.model = model;
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generateResponse(prompt: string): Promise<LLMResponse> {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            return {
                response: text,
                done: true
            };
        } catch (error: any) {
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }
} 