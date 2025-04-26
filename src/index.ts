import * as path from "path";
import CodeDebtAgent from "./agent";
import { LLMProviderType } from "./llm/LLMFactory";
import { FileUtils } from "./utils";



async function analyzeSingleFile(filePath: string) {
	try {
		const agent = new CodeDebtAgent(LLMProviderType.Gemini);
		
		console.info(`Analyzing demo file: ${filePath}`);
		const analysis = await agent.analyzeFile(filePath);
		console.info(`Analysis complete for: ${filePath}`);

		const outputPath = FileUtils.writeResultsToFile(analysis, filePath, "single_file_analysis.md");
		console.info(`Analysis results have been saved to: ${outputPath}`);
	} catch (error) {
		console.error("Error analyzing demo file:", error);
		process.exit(1);
	}
}

// Note: This function is not used in the current implementation
// TODO: Output from each file should be saved to a separate file
async function analyzeCodebase(directory: string) {
	try {
		const agent = new CodeDebtAgent(LLMProviderType.Gemini);

		console.info(`Analyzing codebase in: ${directory}`);
		const results = await agent.analyzeCodebase(directory);

		const output = ["Code Debt Analysis Results:", "==========================\n"];

		for (const [filePath, analysis] of results) {
			output.push(
				`File: ${path.relative(process.cwd(), filePath)}`,
				"------------------------",
				analysis,
				"\n"
			);
		}

		const outputPath = FileUtils.writeResultsToFile(output.join("\n"), directory, "codebase_analysis.txt");
		console.info(`Analysis results have been saved to: ${outputPath}`);
	} catch (error) {
		console.error("Error running code debt analysis:", error);
		process.exit(1);
	}
}


if (process.argv[2] === "--demo") {
	const demoFile = path.join(__dirname, "demo", "calculator.ts");
	analyzeSingleFile(demoFile);
} else {
	const targetDirectory = process.argv[2] || process.cwd();
	analyzeCodebase(targetDirectory);
}
