export const PROMPTS = {
  CODE_DEBT_ANALYSIS: (opinions: string, filePath: string, content: string) =>
    `
      You are a code debt analyzer. Analyze the following code based on these project opinions and standards:
      ${opinions}

      Provide a summary of the code in ${filePath}, highlighting any violations of these standards.
      Make sure to be concise and to the point. No need to suggest improvements.

      Here's the code to analyze:
      ${content}
`,
};
