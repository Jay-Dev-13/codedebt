import fs from "fs";
import path from "path";

export class FileUtils {
  static writeResultsToFile(
    analysis: Record<string, any>,
    sourceFilePath: string,
    filename: string
  ) {
    const results = [
      "Code Debt Analysis Results:",
      "==========================\n",
      `File: ${path.relative(process.cwd(), sourceFilePath)}`,
      "------------------------",
      JSON.stringify(analysis, null, 2),
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
