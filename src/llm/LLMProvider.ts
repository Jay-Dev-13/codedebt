export interface LLMResponse {
	response: string;
	done: boolean;
}

export interface LLMProvider {
	generateResponse(prompt: string): Promise<LLMResponse>;
}
