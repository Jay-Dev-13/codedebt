import { RunnableSequence } from "@langchain/core/runnables";
import fs from "fs";
import path from "path";
import { AnalysisAgent } from "./agents/analysisAgent";
import { AnalysisMetrics, CodeDebtScore, CombinedAnalysis, FileAnalysis } from "./types";
export class MasterAgent {
	private analysisAgent: AnalysisAgent;
	private workflow: RunnableSequence;

	constructor() {
		const opinions = fs.readFileSync(path.join(process.cwd(), "opinions.md"), "utf8");
		this.analysisAgent = new AnalysisAgent(opinions, []);
		this.workflow = this.buildWorkflow();
	}

	private buildWorkflow(): RunnableSequence {
		return RunnableSequence.from([
			// Step 1: Analyze files
			async (input: { directory: string; excludePatterns: string[] }) => {
				console.log("Step 1: Analyzing files...");
				await this.analysisAgent.analyze(input);
			},
			// Step 2: Combine analyses
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
			}) => {
				console.log("Step 2: Combining analyses...");
				const analysisResults = await this.analysisAgent.getResults();
				// TODO: Call the CombineAnalyses agent here
			},
			// Step 3: Compute metrics
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
				combinedAnalysis: CombinedAnalysis;
			}) => {
				console.log("Step 3: Computing metrics...");
				// TODO: Call the ComputeMetrics agent here
			},
			// Step 4: Compute scores
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
				combinedAnalysis: CombinedAnalysis;
				metrics: AnalysisMetrics;
			}) => {
				console.log("Step 4: Computing scores...");
				//
			},
		]);
	}

	public async analyzeCodebase({
		directory,
		excludePatterns,
	}: {
		directory: string;
		excludePatterns: string[];
	}): Promise<{
		combinedAnalysis: CombinedAnalysis;
		metrics: AnalysisMetrics;
		scores: CodeDebtScore;
	}> {
		// Execute the workflow
		const result = await this.workflow.invoke({
			directory,
			excludePatterns,
		});

		return {
			combinedAnalysis: result?.combinedAnalysis,
			metrics: result?.metrics,
			scores: result?.scores,
		};
	}
}
