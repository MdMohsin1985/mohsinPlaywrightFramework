import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 8080;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!fs.existsSync("./input")) fs.mkdirSync("./input");
if (!fs.existsSync("./output")) fs.mkdirSync("./output");

app.use(express.static("public"));
app.use("/output", express.static("output"));

const upload = multer({ dest: "input/" });

app.post("/generate", upload.single("requirementFile"), async (req, res) => {
  try {
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.json({
        success: false,
        message: "No file uploaded",
      });
    }

    const originalName = uploadedFile.originalname;
    const ext = path.extname(originalName).toLowerCase();

    let requirementText = "";

    if (ext === ".txt") {
      requirementText = fs.readFileSync(uploadedFile.path, "utf-8");
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.readFile(uploadedFile.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      requirementText = rows
        .flat()
        .filter(Boolean)
        .join("\n");
    } else {
      return res.json({
        success: false,
        message: "Only TXT, XLSX, and XLS files are supported",
      });
    }
    console.log("Uploaded requirement text:");
console.log(requirementText);

if (!requirementText || requirementText.trim().length < 50) {
  return res.json({
    success: false,
    message: "Uploaded file does not contain enough requirement details.",
  });
}

const prompt = `
You are a Senior QA Test Manager.

Generate manual test cases ONLY from the requirement provided below.

Rules:
- Do not require selectors for manual test case generation.
- Do not generate Playwright code.
- Do not assume missing business flows.
- Use only the provided id, module, url, and requirement.
- If id, module, or requirement is missing, return:
[
  {
    "error": "Invalid or insufficient requirement. Please provide id, module, and requirement."
  }
]

Requirement:
${requirementText}

Return ONLY valid JSON array.

Each object should have:
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
    const aiResponse = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: prompt,
    });

    const outputText = aiResponse.output_text;

    let testCases;

    try {
      testCases = JSON.parse(outputText);
    } catch (err) {
      return res.json({
        success: false,
        message: "AI response was not valid JSON",
        rawOutput: outputText,
      });
    }

    const timestamp = Date.now();

    const txtFileName = `test-cases-${timestamp}.txt`;
    const xlsxFileName = `test-cases-${timestamp}.xlsx`;

    const txtPath = `./output/${txtFileName}`;
    const xlsxPath = `./output/${xlsxFileName}`;

    fs.writeFileSync(txtPath, JSON.stringify(testCases, null, 2));

    const worksheet = XLSX.utils.json_to_sheet(testCases);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "TestCases");
    XLSX.writeFile(workbook, xlsxPath);

    res.json({
      success: true,
      txtFile: `/output/${txtFileName}`,
      xlsxFile: `/output/${xlsxFileName}`,
    });
  } catch (error) {
    console.error(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}`);
});