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
Do not include markdown.
Do not include explanation.

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

  const text = response.output_text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(text);
}

async function generatePlaywrightScript(moduleName, testCasesForModule, relatedRequirements) {
  const importLine = getPlaywrightImportLine();
  const moduleType = getModuleType();

  const selectorMappings = relatedRequirements.reduce((acc, req) => {
    acc[req.id] = {
      url: req.url,
      selectors: req.selectors || {},
      expectedNavigation: req.expectedNavigation || {},
    };
    return acc;
  }, {});

  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: `
Generate a complete Playwright test script.

Project module type:
${moduleType}

MANDATORY FIRST LINE:
${importLine}

Module:
${moduleName}

Requirement data:
${JSON.stringify(selectorMappings, null, 2)}

Use these generated QA test cases:
${JSON.stringify(testCasesForModule, null, 2)}

Important:
- Define a selector mapping object in the generated test file using the requirement data.
- Use the requirementId from each test case to select the correct URL and selector set.
- Example pattern:
  const requirementSelectors = {
    "REQ-001": {
      url: "https://www.jiosaavn.com",
      selectors: {
        logo: "[id='logo']",
        proLink: "[id='go_pro']",
        ...
      }
    }
  };
- Use page.locator(requirementSelectors[requirementId].selectors.logo) instead of page.locator('logo').

Rules:
- Return only JavaScript code.
- Do not include markdown.
- Do not include explanation.
- The first line must be exactly:
${importLine}
- Do not use any other import style.
- If project module type is "module", do NOT use require().
- If project module type is "commonjs", do NOT use import.
- Use @playwright/test.
- Create one Playwright test for each test case where automationCandidate is true.
- Use the testCaseId and scenario in the test name.
- Use test.describe for the module.
- Add comments for each test step.
- Include assertions for expectedResult.
- Use stable locators where possible.
- If selectors are available in the requirement data, use those selectors exactly.
- Do not guess selectors.
- Do not create new selectors.
- Map any selector name mentioned in the test case text to the exact selector value from requirement data.
- If requirementId is present in a test case, use its associated URL and selectors.
- Use the expectedNavigation data to determine where navigation should lead
- For example, if expectedNavigation.getStarted is "/docs/", wait for URL to contain "/docs/"
- Use generic navigation detection: wait for URL change, then verify expected pattern
- Do not hardcode URL patterns like /.*docs.*/ - use the expectedNavigation data
`,
  });

  const playwrightCode = response.output_text
    .replace(/```javascript/g, "")
    .replace(/```js/g, "")
    .replace(/```/g, "")
    .trim();

  return playwrightCode;
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

function getSafeFileName(name) {
  return name.toLowerCase().replaceAll(" ", "-");
}

async function main() {
  let allTestCases = [];

  for (const req of requirements) {
    console.log(`Generating test cases for ${req.id} - ${req.module}`);

    const testCases = await generateTestCases(req);

    allTestCases = allTestCases.concat(testCases);
  }

  fs.writeFileSync(
    "./test-cases.json",
    JSON.stringify(allTestCases, null, 2),
    "utf-8"
  );

  console.log("test-cases.json created");

  const worksheet = XLSX.utils.json_to_sheet(allTestCases);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");

  XLSX.writeFile(workbook, "./output/test-cases.xlsx");

  const csv = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync("./output/test-cases.csv", csv);

  fs.mkdirSync("./output/playwright", { recursive: true });

  const modules = [...new Set(allTestCases.map((tc) => tc.module))];

  for (const moduleName of modules) {
    console.log(`Generating Playwright script for module: ${moduleName}`);

    const relatedRequirements = requirements.filter(
      (req) => req.module === moduleName
    );

    const testCasesForModule = allTestCases.filter(
      (tc) => tc.module === moduleName && tc.automationCandidate === true
    );

    if (testCasesForModule.length === 0) {
      console.log(`Skipping module ${moduleName} because no automationCandidate tests were generated.`);
      continue;
    }

    const playwrightCode = await generatePlaywrightScript(
      moduleName,
      testCasesForModule,
      relatedRequirements
    );

    fs.writeFileSync(
      `./output/playwright/${getSafeFileName(moduleName)}.spec.js`,
      playwrightCode,
      "utf-8"
    );
  }

  console.log("\nDone!");
  console.log("JSON created: test-cases.json");
  console.log("Excel created: output/test-cases.xlsx");
  console.log("CSV created: output/test-cases.csv");
  console.log("Playwright specs created in output/playwright folder");
}

main().catch((error) => {
  console.error("Error:", error.message);
});