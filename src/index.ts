import { config } from "dotenv";
import path from "path";
import { MasterAgent } from "./masterAgent";
import { loadDocuments } from "./rag/vector";

config();
async function main() {
	try {
		const targetDirectory = process.argv[2] ?? path.join(process.cwd(), "demo");

		if (!targetDirectory) {
			console.error("Please provide a target directory");
			process.exit(1);
		}

		// Load and process documents
		const documentAnalysis = await loadDocuments(targetDirectory, ["node_modules", "dist"]);
		console.log(`Loaded ${documentAnalysis.chunks.length} code chunks`);

		const masterAgent = new MasterAgent();
		masterAgent.setDocumentAnalysis(documentAnalysis);

		await masterAgent.analyzeCodebase({
			directory: targetDirectory,
			excludePatterns: ["node_modules", "dist"],
		});
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
