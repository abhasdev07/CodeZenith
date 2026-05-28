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
    return {
      success: false,
      type: "provider_error",
      error: error.response?.data?.message || "Failed to execute code",
    };
  }
}
