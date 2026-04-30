import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import XLSX from "xlsx";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const requirements = JSON.parse(
  fs.readFileSync("./input/requirements.json", "utf-8")
);

if (!fs.existsSync("./output")) {
  fs.mkdirSync("./output");
}

async function generateTestCases(requirementObj) {
  const prompt = `
You are a senior QA Test Manager and Test Automation Lead.

Generate test cases for this requirement.

Requirement ID: ${requirementObj.id}
Module: ${requirementObj.module}
Requirement: ${requirementObj.requirement}

Return ONLY valid JSON array.
Each item should have:
- requirementId
- module
- testCaseId
- scenario
- testType
- priority
- preCondition
- testSteps
- testData
- expectedResult
- automationCandidate
`;

  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: prompt,
  });

  const text = response.output_text;

  return JSON.parse(text);
}

async function generatePlaywrightScript(req) {
  const importLine = getPlaywrightImportLine();
  const moduleType = getModuleType();

  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: `
Generate a complete Playwright test script.

Project module type:
${moduleType}

MANDATORY FIRST LINE:
${importLine}

Use this data:
${JSON.stringify(req, null, 2)}

Rules:
- Return only JavaScript code.
- The first line must be exactly:
${importLine}
- Do not use any other import style.
- If project module type is "module", do NOT use require().
- If project module type is "commonjs", do NOT use import.
- Use @playwright/test.
- Use given selectors only.
- Before checking selectors, capture response from page.goto().
- Assert response.status() is less than 400.
- If page returns 403, 404, or 500, fail clearly before selector validation.
- Include assertions for expected result.
- Do not add explanation.
`
  });

  return response.output_text;
}

function getModuleType() {
  const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
  return packageJson.type === "module" ? "module" : "commonjs";
}

function getPlaywrightImportLine() {
  return getModuleType() === "module"
    ? "import { test, expect } from '@playwright/test';"
    : "const { test, expect } = require('@playwright/test');";
}

async function main() {
  let allTestCases = [];

  for (const req of requirements) {
    console.log(`Generating test cases for ${req.id} - ${req.module}`);

    const testCases = await generateTestCases(req);
    allTestCases = allTestCases.concat(testCases);
  }

  const worksheet = XLSX.utils.json_to_sheet(allTestCases);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");

  XLSX.writeFile(workbook, "./output/test-cases.xlsx");

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync("./output/test-cases.csv", csv);

fs.mkdirSync("./output/playwright", { recursive: true });

for (const req of requirements) {
  const playwrightCode = await generatePlaywrightScript(req);
  fs.writeFileSync(
    `./output/playwright/${req.module.toLowerCase().replaceAll(" ", "-")}.spec.js`,
    playwrightCode
  );

}
  console.log("\nDone!");
  console.log("Excel created: output/test-cases.xlsx");
  console.log("CSV created: output/test-cases.csv");
  console.log("playWright: spec created in output/playwright folder");
}

main().catch((error) => {
  console.error("Error:", error.message);
});