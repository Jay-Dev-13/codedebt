import { z } from "zod";
import { LLMProvider } from "../llm/LLMProvider";
import { Logger } from "../logger";

export interface ValidationOptions {
	maxRetries?: number;
	retryDelay?: number;
	transformOutput?: (output: string) => any;
}

export class LLMOutputValidator {
	private llmProvider: LLMProvider;
	private logger: Logger;
	private defaultOptions: Required<ValidationOptions> = {
		maxRetries: 3,
		retryDelay: 1000,
		transformOutput: (output: string) => {
			try {
				return JSON.parse(output);
			} catch {
				return output;
			}
		},
	};

	constructor(llmProvider: LLMProvider) {
		this.llmProvider = llmProvider;
		this.logger = new Logger("LLMOutputValidator");
	}

	async validateWithRetry<T>(prompt: string, schema: z.ZodSchema<T>, options: ValidationOptions = {}): Promise<T> {
		const finalOptions = { ...this.defaultOptions, ...options };
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= finalOptions.maxRetries; attempt++) {
			try {
				const response = await this.llmProvider.generateResponse(prompt);
				const transformedOutput = finalOptions.transformOutput(response.response);

				// Attempt to validate against schema
				const validatedOutput = schema.parse(transformedOutput);
				return validatedOutput;
			} catch (error) {
				lastError = error as Error;
				this.logger.warn(`Validation attempt ${attempt} failed:`, error);

				if (attempt < finalOptions.maxRetries) {
					// If this wasn't the last attempt, wait before retrying
					await new Promise((resolve) => setTimeout(resolve, finalOptions.retryDelay * attempt));

					// Modify the prompt to help guide the model towards the correct output format
					prompt = this.enhancePromptForRetry(prompt, error as Error, schema);
				} else {
					throw new Error(
						`Validation failed after ${finalOptions.maxRetries} attempts. Last error: ${lastError?.message}`
					);
				}
			}
		}

		throw lastError || new Error("Validation failed");
	}

	private enhancePromptForRetry(prompt: string, error: Error, schema: z.ZodSchema<any>): string {
		// Extract the schema description for better error messages
		const schemaDescription = schema.description || JSON.stringify(schema);

		// Add more specific instructions based on the validation error
		const enhancedPrompt = `${prompt}

		IMPORTANT: The previous response did not match the required schema. Please ensure your response strictly follows this format:
		${schemaDescription}
		
		Error from previous attempt: ${error.message}
		Please provide a response that exactly matches this schema.`;

		return enhancedPrompt;
	}
}
