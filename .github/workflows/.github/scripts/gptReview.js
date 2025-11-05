import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import { execSync } from "child_process";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const prNumber = process.env.GITHUB_REF_NAME?.match(/\d+/)?.[0];

if (!prNumber) {
  console.error("❌ Pull request number not found.");
  process.exit(1);
}

// Get the code diff for this PR
const diff = execSync("git diff HEAD^ HEAD", { encoding: "utf-8" });

// Skip if no code changes
if (!diff.trim()) {
  console.log("No code changes detected, skipping review.");
  process.exit(0);
}

const prompt = `
You are a senior software performance engineer.
Review the following code diff and provide ONLY optimization suggestions 
if they are meaningful. Focus on:
1. Algorithmic or conditional logic improvements
2. Memory usage reductions
3. Execution speed enhancements

If you find no real optimization opportunities, reply ONLY with:
"NO_OPTIMIZATION_NEEDED"

Code diff:
${diff}
`;

(async () => {
  const res = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [{ role: "user", content: prompt }],
  });

  const message = res.choices[0].message.content.trim();

  if (message === "NO_OPTIMIZATION_NEEDED") {
    console.log("✅ No optimizations detected — no PR comment posted.");
    return;
  }

  // Post GPT suggestions as a PR comment
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: `### 🤖 GPT Optimization Review\n${message}`,
  });

  console.log("💬 Optimization suggestions posted to PR.");
})();
