import axiosInstance from "./axios";

export async function executeCode({
  sessionId,
  language,
  sourceCode,
  problemTitle,
  questionId,
  problemSlug,
  mode = "run",
}) {
  try {
    const payload = {
      language,
      sourceCode,
      problemTitle,
      questionId,
      problemSlug,
      mode,
    };
    if (sessionId) payload.sessionId = sessionId;

    const { data } = await axiosInstance.post("/code/execute", payload);
    return data;
  } catch (error) {
    const data = error.response?.data || {};

    return {
      success: false,
      type: data.type || "provider_error",
      verdict: data.verdict || "Execution Failed",
      message: data.message || "Failed to execute code",
      error: data.error || data.message || "Failed to execute code",
      output: data.output || "",
      mode,
      passedCount: data.passedCount ?? 0,
      totalCases: data.totalCases ?? 0,
      visiblePassedCount: data.visiblePassedCount ?? 0,
      visibleCaseCount: data.visibleCaseCount ?? 0,
      hiddenPassedCount: data.hiddenPassedCount ?? 0,
      hiddenCaseCount: data.hiddenCaseCount ?? 0,
      hiddenSummary: data.hiddenSummary || null,
      cases: data.cases || [],
    };
  }
}
