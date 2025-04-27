import { RunnableSequence } from "@langchain/core/runnables";
import CodeDebtAgent from "./agent";
import {
  AnalysisMetrics,
  CodeDebtScore,
  CombinedAnalysis,
  FileAnalysis,
} from "./analysis/types";
import { LLMProviderType } from "./llm/LLMFactory";

export class MasterAgent {
  private agent: CodeDebtAgent;
  private workflow: RunnableSequence;

  constructor(providerType: LLMProviderType = LLMProviderType.Gemini) {
    this.agent = new CodeDebtAgent(providerType);
    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow(): RunnableSequence {
    return RunnableSequence.from([
      // Step 1: Analyze files
      async (input: { directory: string; excludePatterns: string[] }) => {
        console.log("Step 1: Analyzing files...");
        const result = await this.agent.analyzeCodebase(
          input.directory,
          input.excludePatterns
        );
        return {
          ...input,
          fileAnalyses: result.combinedAnalysis.files,
        };
      },
      // Step 2: Combine analyses
      async (state: {
        directory: string;
        excludePatterns: string[];
        fileAnalyses: Map<string, FileAnalysis>;
      }) => {
        console.log("Step 2: Combining analyses...");
        const result = await this.agent.analyzeCodebase(
          state.directory,
          state.excludePatterns
        );
        return {
          ...state,
          combinedAnalysis: result.combinedAnalysis,
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
        const result = await this.agent.analyzeCodebase(
          state.directory,
          state.excludePatterns
        );
        return {
          ...state,
          metrics: result.metrics,
        };
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
        const result = await this.agent.analyzeCodebase(
          state.directory,
          state.excludePatterns
        );
        return {
          ...state,
          scores: result.scores,
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
    scores: CodeDebtScore;
  }> {
    // Execute the workflow
    const result = await this.workflow.invoke({
      directory,
      excludePatterns,
    });

    return {
      combinedAnalysis: result.combinedAnalysis,
      metrics: result.metrics,
      scores: result.scores,
    };
  }
}
