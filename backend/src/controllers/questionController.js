import { DEFAULT_PROBLEMS, getProblemBySlug, getProblemByTitle } from "../data/problemRegistry.js";
import { buildBoilerplates } from "../lib/boilerplates.js";
import { normalizeTestCases, sanitizeQuestion } from "../lib/questionSerializer.js";
import Question from "../models/Question.js";

function slugify(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDifficulty(value = "easy") {
  const difficulty = String(value).toLowerCase();
  return ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy";
}

function normalizeQuestionPayload(payload = {}, userId = null) {
  const title = payload.title?.trim();
  const slug = payload.slug?.trim() || slugify(title);
  const visibleTestCases = normalizeTestCases(payload.visibleTestCases);
  const hiddenTestCases = normalizeTestCases(payload.hiddenTestCases);
  const question = {
    title,
    slug,
    difficulty: normalizeDifficulty(payload.difficulty),
    category: payload.category || "",
    description:
      typeof payload.description === "string"
        ? { text: payload.description, notes: [] }
        : payload.description || { text: "", notes: [] },
    constraints: Array.isArray(payload.constraints) ? payload.constraints : [],
    examples: Array.isArray(payload.examples) ? payload.examples : [],
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    supportedLanguages: Array.isArray(payload.supportedLanguages) && payload.supportedLanguages.length
      ? payload.supportedLanguages
      : ["javascript", "cpp", "python", "java"],
    functionName: payload.functionName?.trim(),
    returnType: payload.returnType || "int",
    parameterSignature: Array.isArray(payload.parameterSignature) ? payload.parameterSignature : [],
    visibleTestCases,
    hiddenTestCases,
    timeLimitMs: Number(payload.timeLimitMs) || 3000,
    memoryLimitMb: Number(payload.memoryLimitMb) || 128,
    updatedBy: userId,
  };

  question.boilerplates = {
    ...buildBoilerplates(question),
    ...(payload.boilerplates || {}),
  };

  return question;
}

function validateQuestionPayload(question) {
  if (!question.title) return "title is required";
  if (!question.slug) return "slug is required";
  if (!question.functionName) return "functionName is required";
  if (!question.visibleTestCases.length) return "At least one visible testcase is required";
  if (!question.hiddenTestCases.length) return "At least one hidden testcase is required";
  return null;
}

async function ensureDefaultQuestions() {
  const count = await Question.estimatedDocumentCount();
  if (count > 0) return;

  const defaults = Object.values(DEFAULT_PROBLEMS).map((problem) => {
    const normalized = normalizeQuestionPayload(problem);
    normalized.createdBy = null;
    normalized.updatedBy = null;
    return normalized;
  });
  await Question.insertMany(defaults, { ordered: false });
}

export async function listQuestions(req, res) {
  try {
    await ensureDefaultQuestions();
    const questions = await Question.find({}).sort({ createdAt: 1 });
    res.status(200).json({ questions: questions.map(sanitizeQuestion) });
  } catch (error) {
    console.log("Error in listQuestions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getQuestion(req, res) {
  try {
    await ensureDefaultQuestions();
    const { id } = req.params;
    const query = [{ slug: id }];
    if (id.match(/^[a-f\d]{24}$/i)) query.push({ _id: id });
    const question = await Question.findOne({ $or: query });

    if (!question) {
      const fallback = getProblemBySlug(id) || getProblemByTitle(id);
      if (fallback) return res.status(200).json({ question: sanitizeQuestion(fallback) });
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({ question: sanitizeQuestion(question) });
  } catch (error) {
    console.log("Error in getQuestion controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function createQuestion(req, res) {
  try {
    const questionPayload = normalizeQuestionPayload(req.body, req.user._id);
    questionPayload.createdBy = req.user._id;
    const validationError = validateQuestionPayload(questionPayload);
    if (validationError) return res.status(400).json({ message: validationError });

    const question = await Question.create(questionPayload);
    res.status(201).json({ question: sanitizeQuestion(question) });
  } catch (error) {
    console.log("Error in createQuestion controller:", error.message);
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "A question with this title or slug already exists" : "Internal Server Error",
    });
  }
}

export async function updateQuestion(req, res) {
  try {
    const questionPayload = normalizeQuestionPayload(req.body, req.user._id);
    const validationError = validateQuestionPayload(questionPayload);
    if (validationError) return res.status(400).json({ message: validationError });

    const question = await Question.findByIdAndUpdate(req.params.id, questionPayload, {
      new: true,
      runValidators: true,
    });

    if (!question) return res.status(404).json({ message: "Question not found" });
    res.status(200).json({ question: sanitizeQuestion(question) });
  } catch (error) {
    console.log("Error in updateQuestion controller:", error.message);
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "A question with this title or slug already exists" : "Internal Server Error",
    });
  }
}

export async function deleteQuestion(req, res) {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    console.log("Error in deleteQuestion controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function resolveQuestionForExecution({ questionId, problemTitle, slug }) {
  await ensureDefaultQuestions();
  const query = [];
  if (questionId?.match?.(/^[a-f\d]{24}$/i)) query.push({ _id: questionId });
  if (slug) query.push({ slug });
  if (problemTitle) query.push({ title: problemTitle });

  if (query.length) {
    const question = await Question.findOne({ $or: query });
    if (question) return question;
  }

  return getProblemByTitle(problemTitle) || getProblemBySlug(slug);
}
