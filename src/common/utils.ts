import fs from "fs";
import path from "path";

export class FileUtils {
	static writeResultsToFile(analysis: string, filename: string) {
		const resultsDir = path.join(process.cwd(), "results");
		if (!fs.existsSync(resultsDir)) {
			fs.mkdirSync(resultsDir);
		}
		const outputFilePath = path.join(resultsDir, filename);
		fs.writeFileSync(outputFilePath, analysis);
		return outputFilePath;
	}

	static convertToHTML(markdown: string): string {
		return markdown.replace(/\\n/g, "\n").replace(/\\\*/g, "*");
	}
}
