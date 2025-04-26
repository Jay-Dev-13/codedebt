import * as path from "path";
import * as fs from "fs";
import CodeDebtAgent from "./agent";
import { LLMProviderType } from "./llm/LLMFactory";

function writeResultsToFile(results: string, filename: string) {
	const resultsDir = path.join(process.cwd(), "results");
	if (!fs.existsSync(resultsDir)) {
		fs.mkdirSync(resultsDir);
	}
	const filePath = path.join(resultsDir, filename);
	fs.writeFileSync(filePath, results);
	return filePath;
}

async function analyzeSingleFile(filePath: string) {
	try {
		const agent = new CodeDebtAgent(LLMProviderType.Gemini);
		console.log(`Analyzing demo file: ${filePath}`);

		const analysis = await agent.analyzeFile(filePath);

		const results = [
			"Code Debt Analysis Results:",
			"==========================\n",
			`File: ${path.relative(process.cwd(), filePath)}`,
			"------------------------",
			analysis
		].join("\n");

		const outputPath = writeResultsToFile(results, "single_file_analysis.md");
		console.log(`Analysis results have been saved to: ${outputPath}`);
	} catch (error) {
		console.error("Error analyzing demo file:", error);
		process.exit(1);
	}
}

async function analyzeCodebase(directory: string) {
	try {
		const agent = new CodeDebtAgent();
		console.log(`Analyzing codebase in: ${directory}`);
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

		const outputPath = writeResultsToFile(output.join("\n"), "codebase_analysis.txt");
		console.log(`Analysis results have been saved to: ${outputPath}`);
	} catch (error) {
		console.error("Error running code debt analysis:", error);
		process.exit(1);
	}
}

const demoFile = path.join(__dirname, "demo", "calculator.ts");

if (process.argv[2] === "--demo") {
	analyzeSingleFile(demoFile);
} else {
	const targetDirectory = process.argv[2] || process.cwd();
	analyzeCodebase(targetDirectory);
}
