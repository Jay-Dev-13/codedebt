import axios from "axios";
import { LLMProvider, LLMResponse } from "./LLMProvider";

export class OllamaProvider implements LLMProvider {
	private baseUrl: string;
	private model: string;

	constructor(baseUrl: string = "http://localhost:11434", model: string = "llama2") {
		this.baseUrl = baseUrl;
		this.model = model;
	}

	async generateResponse(prompt: string): Promise<LLMResponse> {
		const response = await axios.post<LLMResponse>(`${this.baseUrl}/api/generate`, {
			model: this.model,
			prompt: prompt,
			stream: false,
		});

		return response.data;
	}
}
