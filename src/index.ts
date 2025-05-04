import path from "path";
import { Logger } from "./logger";
import { MasterAgent } from "./masterAgent";
import { buildVectorStore } from "./rag/vector";

async function main() {
	const logger = new Logger("Configuration");
	try {
		const targetDirectory = process.argv[2] ?? path.join(process.cwd(), "demo");

		if (!targetDirectory) {
			logger.error("Please provide a target directory");
			process.exit(1);
		}

		logger.log("Building vector store...");
		const { chunks, vectors, retrieve } = await buildVectorStore(targetDirectory, ["node_modules", "dist"]);

		logger.info(`Total processed: ${chunks.length} chunks`);

		const documentAnalysis = {
			chunks,
			vectors,
			retriever: { retrieve },
		};

		logger.log("Initializing master agent...");
		const masterAgent = new MasterAgent();
		masterAgent.setDocumentAnalysis(documentAnalysis);

		logger.log("Analyzing codebase...");
		await masterAgent.analyzeCodebase({
			directory: targetDirectory,
			excludePatterns: ["node_modules", "dist"],
		});
	} catch (error) {
		logger.error("Error:", error);
		process.exit(1);
	}
}

main();
