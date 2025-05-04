import { AnalysisMetrics } from "../types";
import { FolderStructure } from "../types/index";

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

      IMPORTANT: Your response MUST be a valid JSON object with the following schema:
      {
          "totalIssues": number,
          "issuesBySeverity": { [severity: string]: {score: number, issues: string[]} },
          "issues": [
              {
                  "type": string,
                  "frequency": number,
                  "severity": number (1-10),
                  "affectedComponents": string[],
                  "confidence": number (1-10)
              }
          ]
      }

      Do's:
      - Ensure your response is VALID JSON matching the schema above
      - Highlight any violations of the project opinions and standards
      - Consider patterns from similar code chunks when analyzing issues
      
      Don'ts:
      - Include any text outside the JSON object
      - Suggest improvements or fixes
      - Use human-like language
      - Be verbose
      - Mention the project opinions and standards in your output

      Here's the code to analyze:
      ${content}`,

	CODE_DEBT_SUMMARY: ({
		analysisResults,
		metrics,
		folderStructure,
	}: {
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

      Analysis Results:
      ${JSON.stringify(analysisResults, null, 2)}

      Metrics:
      ${JSON.stringify(metrics, null, 2)}

      Folder Structure:
      ${JSON.stringify(folderStructure, null, 2)}
      `,
};
