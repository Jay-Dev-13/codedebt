import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { PROMPTS } from "../common/prompts";
import { FileUtils } from "../common/utils";
import { LLMFactory, LLMProviderType } from "../llm/LLMFactory";
import { LLMProvider } from "../llm/LLMProvider";
import { AnalysisMetrics } from "../types";
import { FolderStructure } from "../types/index";
import { CodeDebtSummarySchema } from "../types/schemas";
import { LLMOutputValidator } from "../utils/validator";
import { SummaryState } from "./types";

export class SummaryAgent {
	private llmProvider: LLMProvider;
	private validator: LLMOutputValidator;
	private state: SummaryState;
	private baseDir: string;
	private statePath: string;
	private resultsDir: string;

	constructor(baseDir: string = "results/analysis") {
		this.llmProvider = LLMFactory.createProvider(LLMProviderType.Gemini);
		this.validator = new LLMOutputValidator(this.llmProvider);
		this.baseDir = baseDir;
		this.statePath = join(this.baseDir, "summary_state.json");
		this.resultsDir = join(this.baseDir, "results");
		this.state = {};
	}

	private async loadState(): Promise<void> {
		try {
			const content = await readFile(this.statePath, "utf-8");
			this.state = JSON.parse(content);
		} catch (error) {
			// If file doesn't exist or is invalid, start fresh
			this.state = {};
		}
	}

	private async saveState(): Promise<void> {
		try {
			await writeFile(this.statePath, JSON.stringify(this.state, null, 2));
		} catch (error) {
			console.error("Error saving state:", error);
		}
	}

	private async getAnalysisResults(): Promise<Record<string, any>> {
		try {
			const files = await readdir(this.resultsDir);
			const results: Record<string, any> = {};

			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await readFile(join(this.resultsDir, file), "utf-8");
					const analysis = JSON.parse(content);
					results[analysis.filePath] = analysis.analysis;
				}
			}

			return results;
		} catch (error) {
			console.error("Error reading analysis results:", error);
			return {};
		}
	}

	public async generateSummary(metrics: AnalysisMetrics, folderStructure: FolderStructure): Promise<string> {
		// Load existing state
		await this.loadState();

		// Get analysis results
		const analysisResults = await this.getAnalysisResults();

		// Generate summary using LLM with validation
		const prompt = PROMPTS.CODE_DEBT_SUMMARY({
			analysisResults,
			metrics,
			folderStructure,
		});

		try {
			const validatedSummary = await this.validator.validateWithRetry(prompt, CodeDebtSummarySchema, {
				maxRetries: 3,
				retryDelay: 2000,
			});

			// Update state
			this.state.lastSummaryTimestamp = new Date().toISOString();
			await this.saveState();

			// Save summary to file (as markdown)
			const summaryPath = FileUtils.writeResultsToFile(validatedSummary, "summary.md");

			return summaryPath;
		} catch (error) {
			console.error("Failed to generate and validate summary:", error);
			throw error;
		}
	}
}
