import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const outputDir = "./output";
const resultsPathCandidates = [
  "./output/playwright-results.json",
  "../output/playwright-results.json"
];
const resultsPath = resultsPathCandidates.find(fs.existsSync);
const testsDir = "./output/playwright";
const testResultsDir = "./test-results";
const reportPath = "./output/ai-failure-analysis.md";

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

function hasTestFailures(suite) {
  if (!suite || typeof suite !== "object") return false;

  if (Array.isArray(suite.tests)) {
    for (const test of suite.tests) {
      if (Array.isArray(test.results) && test.results.some(result =>
        ["failed", "timedOut", "interrupted"].includes(result.status)
      )) {
        return true;
      }
    }
  }

  return Array.isArray(suite.suites) && suite.suites.some(hasTestFailures);
}

function createNoIssuesReport() {
  return `# AI Failure Analysis

## 1. Final Classification
No issues — all tests passed.

## 2. Symptom
No test failures were reported by Playwright.

## 3. Actual Root Cause
Not applicable. The test run completed without failures.

## 4. Evidence
Playwright reported no failed, timed-out, or interrupted test results.

## 5. Why It Is Not Just a Selector Issue
No selector or other test failure occurred in this run.

## 6. Recommended Fix
No fix is needed for this run.

## 7. Suggested Code Improvement
No code change is suggested because the tests passed.

## 8. Prevention
No issue was identified to prevent. Keep running the suite and review this report when a test fails.
`;
}

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function getGeneratedTests() {
  if (!fs.existsSync(testsDir)) return "";

  return fs.readdirSync(testsDir)
    .filter(file => file.endsWith(".js") || file.endsWith(".ts"))
    .map(file => {
      const fullPath = path.join(testsDir, file);
      return `\n\n===== GENERATED TEST FILE: ${file} =====\n${readFileIfExists(fullPath)}`;
    })
    .join("\n");
}

function getErrorContextFiles() {
  const files = walkDir(testResultsDir);

  return files
    .filter(file => file.endsWith("error-context.md"))
    .map(file => {
      return `\n\n===== ERROR CONTEXT FILE: ${file} =====\n${readFileIfExists(file)}`;
    })
    .join("\n");
}

function getArtifactSummary() {
  const files = walkDir(testResultsDir);

  const screenshots = files.filter(file =>
    file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")
  );

  const traces = files.filter(file => file.endsWith(".zip"));
  const videos = files.filter(file => file.endsWith(".webm"));

  return `
Screenshots:
${screenshots.length ? screenshots.join("\n") : "None"}

Traces:
${traces.length ? traces.join("\n") : "None"}

Videos:
${videos.length ? videos.join("\n") : "None"}
`;
}

if (!resultsPath) {
  console.log("No Playwright result file found.");
  process.exit(0);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const playwrightResults = readFileIfExists(resultsPath);
let parsedResults;
try {
  parsedResults = JSON.parse(playwrightResults);
} catch (error) {
  console.error(`Could not parse Playwright results at ${resultsPath}: ${error.message}`);
  process.exit(1);
}

const stats = parsedResults.stats || {};
const hasFailures = Number(stats.unexpected || 0) > 0 ||
  Number(stats.flaky || 0) > 0 ||
  hasTestFailures(parsedResults);

if (!hasFailures) {
  fs.writeFileSync(reportPath, createNoIssuesReport());
  console.log("No Playwright failures found. No-issues analysis created:");
  console.log(reportPath);
  process.exit(0);
}

const generatedTests = getGeneratedTests();
const errorContexts = getErrorContextFiles();
const artifactSummary = getArtifactSummary();

const response = await openai.responses.create({
  model: "gpt-5.4-mini",
  input: `
You are an expert Playwright QA Automation Architect.

Analyze the Playwright failure using ALL available evidence.

VERY IMPORTANT RULES:
- Do NOT classify the issue as selector issue only because the failed assertion says element not found.
- First check whether the expected page actually loaded.
- Give highest priority to Page snapshot in error-context.md.
- If the page snapshot shows 403, 404, 500, login page, access denied, captcha, blocked page, or unexpected page, classify as environment/access/application issue.
- Treat selector failure as secondary when the page itself is wrong.
- Mention the difference between "symptom" and "root cause".
- Be concise and practical.
- Provide fix suggestions.

PLAYWRIGHT JSON RESULTS:
${playwrightResults}

ERROR CONTEXT FROM PLAYWRIGHT:
${errorContexts}

GENERATED TEST FILES:
${generatedTests}

ARTIFACT SUMMARY:
${artifactSummary}

Create the report in this format:

# AI Failure Analysis

## 1. Final Classification
Choose one:
- Selector issue
- Test data issue
- Assertion issue
- Application issue
- Environment/access issue
- Timing/wait issue
- Authentication/session issue

## 2. Symptom
What failed in Playwright?

## 3. Actual Root Cause
What is the real reason?

## 4. Evidence
Quote the key evidence from error details, page snapshot, and test source.

## 5. Why It Is Not Just a Selector Issue
Explain briefly.

## 6. Recommended Fix
Give practical fixes.

## 7. Suggested Code Improvement
Give improved Playwright code snippet.

## 8. Prevention
How to avoid this issue in future automation.
`
});

fs.writeFileSync(reportPath, response.output_text);

console.log("AI failure analysis created:");
console.log(reportPath);
