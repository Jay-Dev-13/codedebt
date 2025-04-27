import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { CodeDebtScorer } from "./analysis/CodeDebtScorer";
import { CombinedAnalyzer } from "./analysis/CombinedAnalyzer";
import { MetricsAnalyzer } from "./analysis/MetricsAnalyzer";
import { CombinedAnalysis, FileAnalysis } from "./analysis/types";
import { PROMPTS } from "./common/prompts";
import { LLMFactory, LLMProviderType } from "./llm/LLMFactory";
import { LLMProvider } from "./llm/LLMProvider";

dotenv.config();

class CodeDebtAgent {
  private llmProvider: LLMProvider;
  private opinions: string;
  private totalFiles: number = 0;
  private processedFiles: number = 0;

  constructor(
    providerType: LLMProviderType = LLMProviderType.Ollama,
    options: any = {}
  ) {
    this.llmProvider = LLMFactory.createProvider(providerType, options);
    this.opinions = this.loadOpinions();
  }

  private loadOpinions(): string {
    try {
      return fs.readFileSync(path.join(process.cwd(), "opinions.md"), "utf-8");
    } catch (error) {
      console.error("Error loading opinions file:", error);
      return "";
    }
  }

  public async analyzeFile(
    filePath: string,
    fileContent?: string
  ): Promise<string> {
    try {
      const content = fileContent
        ? fileContent
        : fs.readFileSync(filePath, "utf-8");
      const prompt = PROMPTS.CODE_DEBT_ANALYSIS(
        this.opinions,
        filePath,
        content
      );

      const response = await this.llmProvider.generateResponse(prompt);
      return response.response;
    } catch (error: any) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return `Error analyzing file ${filePath}: ${
        error?.message || "Unknown error"
      }`;
    }
  }

  private reportProgress(): void {
    const percentage = Math.round(
      (this.processedFiles / this.totalFiles) * 100
    );
    process.stdout.write(
      `\rProgress: ${percentage}% (${this.processedFiles}/${this.totalFiles} files)`
    );
  }

  private countFiles(directory: string, excludePatterns: string[]): number {
    let count = 0;
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!excludePatterns.some((pattern) => filePath.includes(pattern))) {
          count += this.countFiles(filePath, excludePatterns);
        }
      } else if (file.endsWith(".ts") || file.endsWith(".js")) {
        count++;
      }
    }

    return count;
  }

  public async analyzeCodebase(
    directory: string,
    excludePatterns: string[] = ["node_modules", "dist"]
  ): Promise<{
    combinedAnalysis: CombinedAnalysis;
    metrics: any;
    scores: any;
  }> {
    // Initialize analyzers
    const combinedAnalyzer = new CombinedAnalyzer();
    this.totalFiles = this.countFiles(directory, excludePatterns);
    this.processedFiles = 0;
    console.log(`Found ${this.totalFiles} files to analyze.`);

    // Step 1: Analyze individual files
    const processDirectory = async (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (!excludePatterns.some((pattern) => filePath.includes(pattern))) {
            await processDirectory(filePath);
          }
        } else if (file.endsWith(".ts") || file.endsWith(".js")) {
          console.log(`\nAnalyzing ${filePath}...`);
          const rawAnalysis = await this.analyzeFile(filePath);
          const content = fs.readFileSync(filePath, "utf-8");
          const lineCount = content.split("\n").length;

          // Create file analysis
          const fileAnalysis: FileAnalysis = {
            filePath,
            problems: this.parseProblems(rawAnalysis, filePath),
            lineCount,
          };

          combinedAnalyzer.addFileAnalysis(fileAnalysis);
          this.processedFiles++;
          this.reportProgress();
        }
      }
    };

    await processDirectory(directory);
    console.log("\nAnalysis complete!");

    // Step 2: Combine analyses
    const combinedAnalysis = combinedAnalyzer.getCombinedAnalysis();

    // Step 3: Compute metrics
    const metricsAnalyzer = new MetricsAnalyzer(combinedAnalysis);
    const metrics = metricsAnalyzer.computeMetrics();

    // Step 4: Compute scores
    const codeDebtScorer = new CodeDebtScorer(combinedAnalysis, metrics);
    const scores = codeDebtScorer.computeScores();

    return {
      combinedAnalysis,
      metrics,
      scores,
    };
  }

  private parseProblems(rawAnalysis: string, filePath: string): any[] {
    const problems: any[] = [];
    const lines = rawAnalysis.split("\n");
    let currentProblem: any = null;

    for (const line of lines) {
      if (line.startsWith("Problem Type:")) {
        if (currentProblem) {
          problems.push(currentProblem);
        }
        currentProblem = {
          type: line.replace("Problem Type:", "").trim(),
          location: { file: filePath },
          description: "",
        };
      } else if (line.startsWith("Location:")) {
        const location = line.replace("Location:", "").trim();
        if (currentProblem && currentProblem.location) {
          if (location.includes(":")) {
            const [functionName, lineRange] = location.split(":");
            currentProblem.location.functionName = functionName.trim();
            if (lineRange.includes("-")) {
              const [start, end] = lineRange
                .split("-")
                .map((n) => parseInt(n.trim()));
              currentProblem.location.lineNumbers = [start, end];
            }
          }
        }
      } else if (line.startsWith("Description:")) {
        if (currentProblem) {
          currentProblem.description = line.replace("Description:", "").trim();
        }
      } else if (line.startsWith("Severity:")) {
        if (currentProblem) {
          const severity = line.replace("Severity:", "").trim().toLowerCase();
          currentProblem.severity = severity as
            | "high"
            | "medium"
            | "low"
            | "unknown";
        }
      }
    }

    if (currentProblem) {
      problems.push(currentProblem);
    }

    return problems;
  }
}

export default CodeDebtAgent;
