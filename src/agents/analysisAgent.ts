/*
    Responsibilities:
    - Analyze folder structure
    - Analyze individual files
    - Store intermediate results for each file

    Notes:
    - Use Langchain/LangGraph to build the agent
    - The agent needs to iterate over all the files in the codebase and analyze them.
    - We have a central storage for all the prompts involved in the analysis. Refer to common/prompts.ts for the prompts.
    - Keep the intermediate results in a central storage for the next agent to use.
*/

import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { glob } from "glob";
import { join } from "path";
import { PROMPTS } from "../common/prompts";
import { LLMFactory, LLMProviderType } from "../llm/LLMFactory";
import { LLMProvider } from "../llm/LLMProvider";
import { Logger } from "../logger";
import { DocumentAnalysis } from "../rag/types";
import { CodeDebtAnalysisSchema } from "../types/schemas";
import { LLMOutputValidator } from "../utils/validator";
interface AnalysisState {
	analyzedFiles: string[];
	excludePatterns: string[];
	totalFiles?: number;
}

interface FileAnalysis {
	filePath: string;
	analysis: string | { error: string };
	timestamp: string;
	similarChunks?: string[];
}

interface ProgressCallback {
	(progress: { currentFile: string; progress: number; analyzed: number; total: number }): void;
}

export class AnalysisAgent {
	private llmProvider: LLMProvider;
	private validator: LLMOutputValidator;
	private state: AnalysisState;
	private baseDir: string;
	private statePath: string;
	private resultsDir: string;
	private opinions: string;
	private progressCallback?: ProgressCallback;
	private documentAnalysis?: DocumentAnalysis;
	private logger: Logger;
	constructor(
		opinions: string,
		excludePatterns: string[],
		baseDir: string = "results/analysis",
		progressCallback?: ProgressCallback
	) {
		this.llmProvider = LLMFactory.createProvider(LLMProviderType.Gemini);
		this.validator = new LLMOutputValidator(this.llmProvider);
		this.baseDir = baseDir;
		this.statePath = join(this.baseDir, "state.json");
		this.resultsDir = join(this.baseDir, "results");
		this.opinions = opinions;
		this.progressCallback = progressCallback;
		this.logger = new Logger("AnalysisAgent");

		this.state = {
			analyzedFiles: [],
			excludePatterns,
		};
	}

	public setDocumentAnalysis(analysis: DocumentAnalysis) {
		this.documentAnalysis = analysis;
	}

	private async loadState(): Promise<void> {
		this.logger.info("Loading state...");
		try {
			const content = await readFile(this.statePath, "utf-8");
			this.state = JSON.parse(content);
		} catch (error) {
			// If file doesn't exist or is invalid, start fresh
			this.state = {
				analyzedFiles: [],
				excludePatterns: this.state.excludePatterns,
			};
		}
	}

	private async saveState(): Promise<void> {
		try {
			await mkdir(join(this.statePath, ".."), { recursive: true });
			await writeFile(this.statePath, JSON.stringify(this.state, null, 2));
		} catch (error) {
			console.error("Error saving state:", error);
		}
	}

	private async saveFileAnalysis(
		filePath: string,
		analysis: string | { error: string },
		similarChunks?: string[]
	): Promise<void> {
		try {
			await mkdir(this.resultsDir, { recursive: true });
			const fileAnalysis: FileAnalysis = {
				filePath,
				analysis,
				timestamp: new Date().toISOString(),
				similarChunks,
			};

			// Create a safe filename from the file path
			const safeFileName = filePath.replace(/[^a-zA-Z0-9]/g, "_") + ".json";
			await writeFile(join(this.resultsDir, safeFileName), JSON.stringify(fileAnalysis, null, 2));
		} catch (error) {
			console.error(`Error saving analysis for ${filePath}:`, error);
		}
	}

	private async analyzeFile(filePath: string): Promise<void> {
		try {
			const content = await readFile(filePath, "utf-8");

			// Get similar code chunks if document analysis is available
			let similarChunks: string[] | undefined;
			if (this.documentAnalysis) {
				similarChunks = await this.documentAnalysis.retriever.retrieve(content, 3);
				this.logger.info(`Found ${similarChunks?.length ?? 0} similar code chunks for ${filePath}`);
			}

			const prompt = PROMPTS.CODE_DEBT_ANALYSIS(this.opinions, filePath, content, similarChunks);

			// Use the validator to ensure the response matches our schema
			const validatedResponse = await this.validator.validateWithRetry(prompt, CodeDebtAnalysisSchema, {
				maxRetries: 3,
				retryDelay: 2000,
				transformOutput: (output: string) => {
					try {
						// Try to extract JSON from the response if it's embedded in text
						const jsonMatch = output.match(/\{[\s\S]*\}/);
						return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(output);
					} catch {
						throw new Error("Failed to parse LLM output as JSON");
					}
				},
			});

			this.state.analyzedFiles.push(filePath);
			await this.saveFileAnalysis(filePath, JSON.stringify(validatedResponse, null, 2), similarChunks);
			await this.saveState();

			this.logger.info("Saved the validated response to the file system.");

			// Report progress
			if (this.progressCallback && this.state.totalFiles) {
				this.progressCallback({
					currentFile: filePath,
					progress: (this.state.analyzedFiles.length / this.state.totalFiles) * 100,
					analyzed: this.state.analyzedFiles.length,
					total: this.state.totalFiles,
				});
			}
		} catch (error) {
			this.logger.error(`Error analyzing file ${filePath}:`, error);
			this.state.analyzedFiles.push(filePath);
			await this.saveFileAnalysis(filePath, { error: error instanceof Error ? error.message : "Unknown error" });
			await this.saveState();

			this.logger.info("Saved the error to the file system.");

			// Report progress even if analysis fails
			if (this.progressCallback && this.state.totalFiles) {
				this.progressCallback({
					currentFile: filePath,
					progress: (this.state.analyzedFiles.length / this.state.totalFiles) * 100,
					analyzed: this.state.analyzedFiles.length,
					total: this.state.totalFiles,
				});
			}
		}
	}

	private async *getNextFile(input: { directory: string; excludePatterns: string[] }): AsyncGenerator<string> {
		const files = await glob(`${input.directory}/**/*.{ts,tsx,js,jsx}`, {
			ignore: ["node_modules/**", "dist/**", ...input.excludePatterns],
		});

		// Store total files count for progress reporting
		this.state.totalFiles = files.length;

		for (const file of files) {
			if (!this.state.analyzedFiles.includes(file)) {
				yield file;
			}
		}
	}

	public async analyze(input: { directory: string; excludePatterns: string[] }): Promise<void> {
		// Load existing state
		await this.loadState();

		// Report initial progress
		if (this.progressCallback && this.state.totalFiles) {
			this.progressCallback({
				currentFile: "",
				progress: (this.state.analyzedFiles.length / this.state.totalFiles) * 100,
				analyzed: this.state.analyzedFiles.length,
				total: this.state.totalFiles,
			});
		}

		this.logger.log("Starting to analyze files...");
		for await (const file of this.getNextFile(input)) {
			this.logger.info(`Analyzing file: ${file}`);
			await this.analyzeFile(file);
		}
		this.logger.info("Analysis complete");
	}

	public async getResults(): Promise<Record<string, any>> {
		try {
			const files = await readdir(this.resultsDir);
			const results: Record<string, any> = {};

			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await readFile(join(this.resultsDir, file), "utf-8");
					const analysis: FileAnalysis = JSON.parse(content);
					results[analysis.filePath] = analysis.analysis;
				}
			}

			return results;
		} catch (error) {
			console.error("Error reading results:", error);
			return {};
		}
	}
}
