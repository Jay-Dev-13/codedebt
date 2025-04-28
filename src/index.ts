import { config } from "dotenv";
import path from "path";
import { FileUtils } from "./common/utils";
import { MasterAgent } from "./masterAgent";

config();
async function main() {
	try {
		const targetDirectory = process.argv[2] ?? path.join(process.cwd(), "demo");

		if (!targetDirectory) {
			console.error("Please provide a target directory");
			process.exit(1);
		}

		const masterAgent = new MasterAgent();

		const result = await masterAgent.analyzeCodebase({
			directory: targetDirectory,
			excludePatterns: ["node_modules", "dist"],
		});

		FileUtils.writeResultsToFile(result, targetDirectory, "results.md");
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
