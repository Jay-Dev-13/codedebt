import fs from "fs";
import path from "path";

export class FileUtils {
	static writeResultsToFile(analysis: string, sourceFilePath: string, filename: string) {
		const results = [
			"Code Debt Analysis Results:",
			"==========================\n",
			`File: ${path.relative(process.cwd(), sourceFilePath)}`,
			"------------------------",
			analysis
		].join("\n");
		const resultsDir = path.join(process.cwd(), "results");
	if (!fs.existsSync(resultsDir)) {
		fs.mkdirSync(resultsDir);
		}
		const outputFilePath = path.join(resultsDir, filename);
		fs.writeFileSync(outputFilePath, results);
		return outputFilePath;
	}
}

