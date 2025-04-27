import * as fs from "fs";
import * as path from "path";
import CodeDebtAgent from "../agent";
import { CombinedAnalysis, FileAnalysis } from "../analysis/types";
import { FileUtils } from "../common/utils";
import { LLMProviderType } from "../llm/LLMFactory";

export class AnalysisService {
  private agent: CodeDebtAgent;

  constructor() {
    this.agent = new CodeDebtAgent(LLMProviderType.Gemini);
  }

  async analyzeSingleFile(filePath: string): Promise<void> {
    try {
      console.info(`Analyzing file: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const rawAnalysis = await this.agent.analyzeFile(filePath, fileContent);
      console.info(`Analysis complete for: ${filePath}`);

      const lineCount = fileContent.split("\n").length;

      const analysis: FileAnalysis = {
        filePath,
        problems: this.agent["parseProblems"](rawAnalysis, filePath),
        lineCount,
      };

      const output = this.formatFileAnalysis(analysis, filePath);
      const outputPath = FileUtils.writeResultsToFile(
        output,
        filePath,
        "single_file_analysis.md"
      );
      console.info(`Analysis results have been saved to: ${outputPath}`);
    } catch (error) {
      console.error("Error analyzing file:", error);
      throw error;
    }
  }

  async analyzeCodebase(directory: string): Promise<void> {
    try {
      console.info(`Analyzing codebase in: ${directory}`);
      const result = await this.agent.analyzeCodebase(directory);
      console.info("Analysis complete!");

      const output = this.formatCodebaseAnalysis(result.combinedAnalysis);
      const outputPath = FileUtils.writeResultsToFile(
        output,
        directory,
        "codebase_analysis.md"
      );
      console.info(`Analysis results have been saved to: ${outputPath}`);
    } catch (error) {
      console.error("Error analyzing codebase:", error);
      throw error;
    }
  }

  private formatFileAnalysis(analysis: FileAnalysis, filePath: string): string {
    return [
      `File: ${path.relative(process.cwd(), filePath)}`,
      "------------------------",
      `Line Count: ${analysis.lineCount}`,
      `Problems: ${analysis.problems.length}`,
      "------------------------",
      ...analysis.problems.map((p) => `- ${p.type}: ${p.description}`),
      "\n",
    ].join("\n");
  }

  private formatCodebaseAnalysis(analysis: CombinedAnalysis): string {
    const output = [
      "Code Debt Analysis Results:",
      "==========================\n",
    ];

    for (const [filePath, fileAnalysis] of analysis.files) {
      output.push(
        `File: ${path.relative(process.cwd(), filePath)}`,
        "------------------------",
        `Line Count: ${fileAnalysis.lineCount}`,
        `Problems: ${fileAnalysis.problems.length}`,
        "------------------------",
        ...fileAnalysis.problems.map((p) => `- ${p.type}: ${p.description}`),
        "\n"
      );
    }

    return output.join("\n");
  }
}
