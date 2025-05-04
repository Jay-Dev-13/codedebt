import { AnalysisMetrics } from "../types";

interface FolderStructure {
	name: string;
	type: "file" | "directory";
	children?: FolderStructure[];
	metrics?: {
		totalFiles: number;
		totalIssues: number;
		issuesByType: Record<string, number>;
		issuesBySeverity: Record<string, number>;
	};
}

export const PROMPTS = {
	CODE_DEBT_ANALYSIS: (opinions: string, filePath: string, content: string, similarChunks?: string[]) =>
		`
      You are a code debt analyzer. Analyze the following code based on these project opinions and standards:
      ${opinions}

      File: ${filePath}

      ${
			similarChunks
				? `
      Here are some similar code chunks from the codebase that might be relevant:
      ${similarChunks.map((chunk, i) => `\nSimilar Chunk ${i + 1}:\n${chunk}`).join("\n")}
      `
				: ""
		}

      Provide a list of issues found in the code.
      1. Number of total issues found.
      2. Number of issues per severity.
      3. For each issue, provide the following properties:
      - Type of issue
      - Frequency
      - Severity (1 [Lowest] - 10 [Highest])
      - Function/Class Names that are affected
      - How confident are you that this is an issue? (1 [Not confident] - 10 [Very confident])

      Do's:
      - Highlight any violations of the project opinions and standards.
      - Frame the output in a way that is easy to consume by another LLM model.
      - Consider patterns from similar code chunks when analyzing issues.
      
      Don'ts:
      - Suggest improvements.
      - Suggest fixes.
      - Suggest code changes.
      - Have human like language.
      - Be verbose.
      - Mention the project opinions and standards in your output.

      Notes:
      - The original code will not be accessible in the next step. So make sure to provide enough information so that the original code can be reconstructed.
      - If similar code chunks are provided, use them to identify patterns and potential issues that might be common across the codebase.

      Here's the code to analyze:
      ${content}`,

	CODE_DEBT_SUMMARY: (input: {
		analysisResults: Record<string, any>;
		metrics: AnalysisMetrics;
		folderStructure: FolderStructure;
	}) =>
		`
      You are a code debt summary generator. Based on the following analysis results, metrics, and folder structure, generate a comprehensive summary of the code debt in the project.

      The summary should include:
      1. Overall code debt score and health
      2. Most common types of issues
      3. Files with the most issues
      4. Severity distribution of issues
      5. Recommendations for improvement
      6. Folder structure analysis and its impact on code quality

      The summary should be in markdown format.
      It should include:
      1. Overall code quality and health in quantitative terms.
      2. List of all the issues found in the codebase with the following properties:
        - Type of issue
        - Frequency
        - Severity
        - A dropdown list of files that have the issue
        - Example on how this issue manifests in the code
        - Example of how to fix the issue
        - Example on how this issue can lead to a bug/failure.
        - Links to the relevant sections of the code
      3. Folder structure analysis:
        - Most problematic directories
        - Distribution of issues across the codebase
        - Impact of folder structure on code quality
        - Recommendations for improving code organization

      Make the summary comprehensive and informative.

      Here are the analysis results:
      ${JSON.stringify(input, null, 2)}`,
};
