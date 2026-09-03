export function normalizeExpectedField(testCase = {}) {
  return {
    input: Array.isArray(testCase.input) ? testCase.input : [],
    expectedOutput:
      testCase.expectedOutput !== undefined ? testCase.expectedOutput : testCase.expected,
  };
}

export function normalizeTestCases(testCases = []) {
  return Array.isArray(testCases)
    ? testCases
        .map(normalizeExpectedField)
        .filter((testCase) => testCase.expectedOutput !== undefined)
    : [];
}

export function sanitizeQuestion(question) {
  if (!question) return null;

  const data = question.toObject ? question.toObject({ virtuals: true }) : question;
  const visibleTestCases = normalizeTestCases(data.visibleTestCases);
  const hiddenCount = Array.isArray(data.hiddenTestCases) ? data.hiddenTestCases.length : 0;

  return {
    _id: data._id?.toString?.() || data._id,
    id: data.slug || data._id?.toString?.(),
    slug: data.slug,
    title: data.title,
    difficulty: data.difficulty,
    category: data.category || "",
    description: data.description || { text: "", notes: [] },
    constraints: data.constraints || [],
    examples: data.examples || [],
    tags: data.tags || [],
    supportedLanguages: data.supportedLanguages || [],
    functionName: data.functionName,
    returnType: data.returnType,
    parameterSignature: data.parameterSignature || [],
    boilerplates: data.boilerplates || {},
    starterCode: data.boilerplates || {},
    visibleTestCases,
    visibleTestCaseCount: visibleTestCases.length,
    hiddenTestCaseCount: hiddenCount,
    totalTestCaseCount: visibleTestCases.length + hiddenCount,
    timeLimitMs: data.timeLimitMs || 3000,
    memoryLimitMb: data.memoryLimitMb || 128,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function questionSessionSummary(question) {
  const data = sanitizeQuestion(question);
  if (!data) return null;
  return {
    questionId: data._id,
    slug: data.slug,
    title: data.title,
    difficulty: data.difficulty,
    visibleTestCaseCount: data.visibleTestCaseCount,
    totalTestCaseCount: data.totalTestCaseCount,
  };
}
