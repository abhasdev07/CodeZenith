import { ENV } from "../lib/env.js";
import Session from "../models/Session.js";

const JUDGE0_LANGUAGES = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
};

// Fallback Judge0 API endpoints
const JUDGE0_API_ENDPOINTS = [
  ENV.JUDGE0_API_URL || "https://ce.judge0.com",
  "https://emkc.org/api/v2/piston",
];

export async function executeCode(req, res) {
  try {
    const { sessionId, language, sourceCode, stdin = "" } = req.body;

    if (!language || !sourceCode) {
      return res.status(400).json({ message: "language and sourceCode are required" });
    }

    const languageId = JUDGE0_LANGUAGES[language];
    if (!languageId) {
      return res.status(400).json({ message: `Unsupported language: ${language}` });
    }

    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });

      if (session.status !== "active") {
        return res.status(400).json({ message: "Cannot execute code on inactive session" });
      }

      // Session-based permission: only participant (candidate) can run code
      const isParticipant = session.participant?.toString() === req.user._id.toString();
      if (!isParticipant) {
        return res.status(403).json({ message: "Only the session participant can run code" });
      }
    }

    // Try each endpoint until one works
    let lastError = null;
    for (const endpoint of JUDGE0_API_ENDPOINTS) {
      try {
        const isPiston = endpoint.includes("piston");
        const apiUrl = isPiston 
          ? `${endpoint}/execute`
          : `${endpoint}/submissions?base64_encoded=false&wait=true`;

        const body = isPiston
          ? {
              language: language === "javascript" ? "javascript" : language,
              version: language === "javascript" ? "18.15.0" : language === "python" ? "3.10.0" : "15.0.2",
              files: [{ name: `main.${language === "javascript" ? "js" : language}`, content: sourceCode }],
            }
          : {
              language_id: languageId,
              source_code: sourceCode,
              stdin,
            };

        console.log(`🔧 Executing code on ${endpoint}:`, { language, isPiston });
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `${endpoint} returned ${response.status}: ${errorText}`;
          console.warn(`⚠️ Code execution endpoint ${endpoint} failed: ${response.status}`, errorText);
          continue;
        }

        const result = await response.json();
        console.log(`✅ Code execution success on ${endpoint}:`, result);

        // Handle different response formats
        let output, compileError, runtimeError, message;

        if (isPiston) {
          output = result.run?.output || "";
          compileError = result.run?.stderr || "";
          runtimeError = result.run?.stderr || "";
          message = result.message || "";
        } else {
          output = result.stdout || "";
          compileError = result.compile_output || "";
          runtimeError = result.stderr || "";
          message = result.message || "";
        }

        if (compileError) {
          return res.status(200).json({
            success: false,
            type: "compile_error",
            output,
            error: compileError,
          });
        }

        if (runtimeError || message) {
          return res.status(200).json({
            success: false,
            type: "runtime_error",
            output,
            error: runtimeError || message,
          });
        }

        return res.status(200).json({
          success: true,
          type: "success",
          output: output || "No output",
        });
      } catch (endpointError) {
        lastError = `${endpoint} failed: ${endpointError.message}`;
        console.warn(`⚠️ Code execution endpoint ${endpoint} error: ${endpointError.message}`);
        continue;
      }
    }

    // All endpoints failed
    return res.status(502).json({
      message: "All code execution providers failed",
      error: lastError || "Unknown error",
    });
  } catch (error) {
    console.log("Error in executeCode controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
