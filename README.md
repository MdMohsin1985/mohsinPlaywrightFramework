# AI Test Generator Framework (GPT-5.4-Mini)

This repository contains the `ai-test-generator` framework for generating and running Playwright tests using OpenAI's GPT-5.4-Mini model for intelligent test case generation and failure analysis.

## Prerequisites

- **Visual Studio Code**
  - Install from https://code.visualstudio.com/
  - Recommended extensions:
    - ESLint
    - Prettier
    - GitLens
    - Playwright Test for VS Code (optional)

- **Node.js**
  - Install Node.js LTS from https://nodejs.org/
  - Verify installation:

```bash
node --version
npm --version
```

## Install dependencies

From the `ai-test-generator` folder, run:

```bash
cd ai-test-generator
npm install
```

Install the Playwright test package for the project:

```bash
npm install @playwright/test --save-dev
```

## Install Playwright browsers

After installing dependencies, install Playwright browsers and drivers with:

```bash
npx playwright install
```

If you want to install only specific browsers, use:

```bash
npx playwright install chromium
```

## package.json scripts

The `scripts` section in `package.json` defines shortcut commands that you can run with `npm run <script-name>`. These scripts save you from typing long commands manually and help standardize how the project is executed.

### Scripts in this project

- `npm run start`
  - Runs `node create-cases-and-automate.js`
  - This is the main generator script for creating test cases and automation files.

- `npm run test:pw`
  - Runs `npx playwright test --config playwright.config.js`
  - Executes Playwright tests using the local Playwright configuration file.

- `npm run analyze:failures`
  - Runs `node analyze-failures.js`
  - Executes the failure analysis script, which reads Playwright results and produces AI-based analysis output.

- `npm run test:analyze`
  - Runs `node run-test-and-analyze.js`
  - This wrapper runs the Playwright tests first and then always runs failure analysis afterward.

- `npm run run:and:analyze`
  - Also runs `node run-test-and-analyze.js`
  - A duplicate alias for the same wrapper behavior.

- `npm run full:e2e`
  - Runs `node create-cases-and-automate.js && node run-test-and-analyze.js`
  - Generates automation artifacts first, then runs the test-and-analyze wrapper.

## Usage examples

Install dependencies and Playwright once:

```bash
cd ai-test-generator
npm install
npm install @playwright/test --save-dev
npx playwright install
```

Run Playwright tests:

```bash
npm run test:pw
```

Run the failure analysis wrapper:

```bash
npm run test:analyze
```

Run the full end-to-end flow:

```bash
npm run full:e2e
```

## Key Script Files

### `create-cases-and-automate.js`

This script generates test cases and Playwright test scripts using GPT-5.4-Mini.

**What it does:**
- Reads requirements from `input/requirements.json`
- Uses GPT-5.4-Mini to generate comprehensive test cases for each requirement
- Exports test cases to both Excel (`test-cases.xlsx`) and CSV (`test-cases.csv`)
- Generates Playwright test scripts in JavaScript (ES modules or CommonJS based on project configuration)
- Saves generated Playwright scripts to `output/playwright/` folder

**Run with:**
```bash
npm run start
```

### `analyze-failures.js`

This script analyzes Playwright test failures using GPT-5.4-Mini to provide AI-driven insights.

**What it does:**
- Reads Playwright test results from `output/playwright-results.json`
- Collects error context and screenshots from test failures
- Uses GPT-5.4-Mini to analyze the root causes of test failures
- Distinguishes between symptoms (what failed) and root causes (why it failed)
- Generates a detailed failure analysis report in Markdown format (`output/ai-failure-analysis.md`)
- Classifies issues as selector issues, test data issues, application issues, environment issues, timing issues, etc.
- Provides recommended fixes and suggested code improvements

**Run with:**
```bash
npm run analyze:failures
```

### `run-test-and-analyze.js`

This wrapper script orchestrates the full test execution and analysis pipeline.

**What it does:**
- Executes Playwright tests first (even if they fail)
- Automatically runs failure analysis afterward
- Ensures analysis always runs regardless of test pass/fail status
- Prevents script execution from stopping on test failures

**Run with:**
```bash
npm run test:analyze
```

## Notes

- The project uses **GPT-5.4-Mini** model for:
  - Generating test cases from requirements
  - Generating Playwright test scripts
  - Analyzing test failures and providing intelligent insights
- The project is configured as an ES module project via `type: "module"` in `package.json`.
- The local Playwright configuration file is `ai-test-generator/playwright.config.js`.
- If you change any scripts, update this README so the commands stay accurate.
- Ensure `OPENAI_API_KEY` environment variable is set in `.env` file for AI features to work.
