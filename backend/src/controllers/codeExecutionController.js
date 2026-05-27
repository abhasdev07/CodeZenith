import { ENV } from "../lib/env.js";
import Session from "../models/Session.js";

const JUDGE0_LANGUAGES = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
};

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

      const isCandidateInSession = session.participant?.toString() === req.user._id.toString();
      if (!isCandidateInSession) {
        return res.status(403).json({ message: "Only the session candidate can run code" });
      }
    }

    const response = await fetch(
      `${ENV.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language_id: languageId,
          source_code: sourceCode,
          stdin,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({
        message: "Execution provider failed",
        providerStatus: response.status,
        error: errorText,
      });
    }

    const result = await response.json();

    const output = result.stdout || "";
    const compileError = result.compile_output || "";
    const runtimeError = result.stderr || "";
    const message = result.message || "";

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
  } catch (error) {
    console.log("Error in executeCode controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
