import { RunnableSequence } from "@langchain/core/runnables";
import fs from "fs";
import path from "path";
import { AnalysisAgent } from "./agents/analysisAgent";
import { MetricsCompute } from "./agents/metricsCompute";
import { SummaryAgent } from "./agents/summaryAgent";
import { DocumentAnalysis } from "./rag/vector";
import { AnalysisMetrics, CodeDebtScore, CombinedAnalysis, FileAnalysis } from "./types";

export class MasterAgent {
	private analysisAgent: AnalysisAgent;
	private metricsCompute: MetricsCompute;
	private summaryAgent: SummaryAgent;
	private workflow: RunnableSequence;
	private documentAnalysis?: DocumentAnalysis;

	constructor() {
		const opinions = fs.readFileSync(path.join(process.cwd(), "opinions.md"), "utf8");
		this.analysisAgent = new AnalysisAgent(opinions, []);
		this.metricsCompute = new MetricsCompute();
		this.summaryAgent = new SummaryAgent();
		this.workflow = this.buildWorkflow();
	}

	public setDocumentAnalysis(analysis: DocumentAnalysis) {
		this.documentAnalysis = analysis;
		this.analysisAgent.setDocumentAnalysis(analysis);
	}

	private buildWorkflow(): RunnableSequence {
		return RunnableSequence.from([
			// Step 1: Analyze files
			async (input: { directory: string; excludePatterns: string[] }) => {
				console.log("Step 1: Analyzing files...");
				await this.analysisAgent.analyze(input);
				return {
					...input,
					fileAnalyses: new Map<string, FileAnalysis>(),
				};
			},
			// Step 2: Combine analyses
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
			}) => {
				console.log("Step 2: Combining analyses...");
				const analysisResults = await this.analysisAgent.getResults();
				return {
					...state,
					combinedAnalysis: {
						files: new Map(Object.entries(analysisResults)),
						totalProblems: 0,
						problemTypes: new Map(),
						severityDistribution: new Map(),
					},
				};
			},
			// Step 3: Compute metrics
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
				combinedAnalysis: CombinedAnalysis;
			}) => {
				console.log("Step 3: Computing metrics...");
				const metrics = await this.metricsCompute.computeMetrics();
				return {
					...state,
					metrics: metrics,
					folderStructure: metrics.folderStructure,
				};
			},
			// Step 4: Compute scores
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
				combinedAnalysis: CombinedAnalysis;
				metrics: AnalysisMetrics;
				folderStructure: any;
			}) => {
				console.log("Step 4: Computing scores...");
				// TODO: Call the ComputeScores agent here
				// For now, return a dummy score
				const scores: CodeDebtScore = {
					fileScores: new Map(),
					projectScore: {
						score: 0,
						priority: "low",
						factors: {
							totalIssues: 0,
							averageSeverity: 0,
							averageDensity: 0,
							averageDiversity: 0,
						},
					},
				};
				return {
					...state,
					scores,
				};
			},
			// Step 5: Generate summary
			async (state: {
				directory: string;
				excludePatterns: string[];
				fileAnalyses: Map<string, FileAnalysis>;
				combinedAnalysis: CombinedAnalysis;
				metrics: AnalysisMetrics;
				folderStructure: any;
				scores: CodeDebtScore;
			}) => {
				console.log("Step 5: Generating summary...");
				const summaryPath = await this.summaryAgent.generateSummary(state.metrics, state.folderStructure);
				return {
					...state,
					summaryPath,
				};
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
		folderStructure: any;
		scores: CodeDebtScore;
		summaryPath: string;
	}> {
		if (!this.documentAnalysis) {
			throw new Error("Document analysis not set. Call setDocumentAnalysis first.");
		}

		// Clean the results directory
		fs.rmSync(path.join(process.cwd(), "results"), { recursive: true, force: true });

		// Execute the workflow with vector analysis
		const result = await this.workflow.invoke({
			directory,
			excludePatterns,
			documentAnalysis: this.documentAnalysis,
		});

		return {
			combinedAnalysis: result?.combinedAnalysis,
			metrics: result?.metrics,
			folderStructure: result?.folderStructure,
			scores: result?.scores,
			summaryPath: result?.summaryPath,
		};
	}
}
