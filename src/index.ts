import { FileUtils } from "./common/utils";
import { LLMProviderType } from "./llm/LLMFactory";
import { MasterAgent } from "./masterAgent";

async function main() {
  try {
    const masterAgent = new MasterAgent(LLMProviderType.Gemini);

    const targetDirectory = process.argv[2] || process.cwd();

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
