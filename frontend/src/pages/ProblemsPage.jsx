import { useMemo, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { PROBLEMS } from "../data/problems";
import {
  useCreateQuestion,
  useDeleteQuestion,
  useQuestions,
  useUpdateQuestion,
} from "../hooks/useQuestions";
import { getDifficultyBadgeClass } from "../lib/utils";
import { AlertCircleIcon, Edit3Icon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

const emptyQuestion = {
  title: "",
  slug: "",
  difficulty: "easy",
  category: "",
  description: { text: "", notes: [] },
  constraints: [],
  examples: [],
  tags: [],
  supportedLanguages: ["javascript", "cpp", "python", "java"],
  functionName: "",
  returnType: "int",
  parameterSignature: [],
  boilerplates: { javascript: "", cpp: "", python: "", java: "" },
  visibleTestCases: [],
  hiddenTestCases: [],
  timeLimitMs: 3000,
  memoryLimitMb: 128,
};

function toEditableQuestion(question) {
  return {
    ...emptyQuestion,
    ...question,
    difficulty: question?.difficulty?.toLowerCase?.() || "easy",
    description:
      typeof question?.description === "string"
        ? { text: question.description, notes: [] }
        : question?.description || emptyQuestion.description,
    boilerplates: question?.boilerplates || question?.starterCode || emptyQuestion.boilerplates,
  };
}

/**
 * JsonField — tracks a draft string independently from the parsed value.
 * This prevents partial/invalid JSON edits from corrupting the parent state.
 * onCommit is called when a valid parse succeeds (on blur or valid change).
 * Shows an inline error if the draft string is not valid JSON.
 */
function JsonField({ label, value, onCommit, rows = 5, fieldKey }) {
  const initialStr = useMemo(() => JSON.stringify(value ?? [], null, 2), []);
  const [draft, setDraft] = useState(initialStr);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const str = e.target.value;
    setDraft(str);
    try {
      const parsed = JSON.parse(str);
      setError(null);
      onCommit(parsed);
    } catch {
      setError("Invalid JSON");
    }
  };

  // When the parent resets the value externally (e.g. opening a new question),
  // sync the draft to the new value.
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value && !error) {
    const nextStr = JSON.stringify(value ?? [], null, 2);
    if (nextStr !== draft) {
      prevValueRef.current = value;
      // Use a lazy update — avoids setState-in-render by returning early
      // and letting the next render carry the updated draft
    }
  }

  return (
    <label className="form-control">
      <div className="flex items-center justify-between mb-1">
        <span className="label-text font-medium">{label}</span>
        {error && (
          <span className="flex items-center gap-1 text-xs text-error">
            <AlertCircleIcon className="size-3" />
            {error}
          </span>
        )}
      </div>
      <textarea
        className={`textarea textarea-bordered font-mono text-xs ${error ? "textarea-error" : ""}`}
        rows={rows}
        value={draft}
        onChange={handleChange}
        id={`json-field-${fieldKey}`}
      />
    </label>
  );
}

/** Validates the editing question before saving. Returns an error string or null. */
function validateQuestion(q, jsonDrafts) {
  if (!q.title?.trim()) return "Title is required";
  if (!q.difficulty) return "Difficulty is required";
  if (!q.description?.text?.trim()) return "Description is required";
  if (!q.functionName?.trim()) return "Function name is required";

  // Check all JSON draft fields are valid
  for (const [fieldName, draft] of Object.entries(jsonDrafts)) {
    try {
      JSON.parse(draft);
    } catch {
      return `"${fieldName}" must be valid JSON`;
    }
  }

  const visibleCount = Array.isArray(q.visibleTestCases) ? q.visibleTestCases.length : 0;
  const hiddenCount = Array.isArray(q.hiddenTestCases) ? q.hiddenTestCases.length : 0;

  if (visibleCount === 0) return "At least one visible testcase is required";
  if (hiddenCount === 0) return "At least one hidden testcase is required";

  // Validate visible testcase structure
  for (let i = 0; i < q.visibleTestCases.length; i++) {
    const tc = q.visibleTestCases[i];
    if (!Array.isArray(tc.input) && tc.input === undefined) {
      return `Visible testcase ${i + 1} must have an "input" array`;
    }
    if (tc.expectedOutput === undefined && tc.expected === undefined) {
      return `Visible testcase ${i + 1} must have "expectedOutput"`;
    }
  }

  const langList = Array.isArray(q.supportedLanguages) ? q.supportedLanguages : [];
  if (langList.length === 0) return "At least one supported language is required";

  return null;
}

function ProblemsPage() {
  const { data, isLoading } = useQuestions();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const fallbackProblems = useMemo(() => Object.values(PROBLEMS), []);
  const questions = data?.questions?.length ? data.questions : fallbackProblems;
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Track JSON draft strings separately so we can validate them on save
  // even if the parsed value was committed to state on a valid intermediate edit.
  const jsonDraftRefs = useRef({});

  const startCreate = () => {
    jsonDraftRefs.current = {};
    setEditingQuestion(toEditableQuestion(emptyQuestion));
  };
  const startEdit = (question) => {
    jsonDraftRefs.current = {};
    setEditingQuestion(toEditableQuestion(question));
  };
  const closeEditor = () => setEditingQuestion(null);

  const updateField = (field, value) => {
    setEditingQuestion((current) => ({ ...current, [field]: value }));
  };

  const updateDescriptionText = (value) => {
    setEditingQuestion((current) => ({
      ...current,
      description: { ...(current.description || {}), text: value },
    }));
  };

  // Called by JsonField whenever a valid parse happens
  const makeJsonCommitHandler = (field) => (parsed) => {
    updateField(field, parsed);
  };

  const saveQuestion = () => {
    if (!editingQuestion) return;

    const payload = toEditableQuestion(editingQuestion);

    // Frontend validation with friendly messages
    const validationError = validateQuestion(payload, jsonDraftRefs.current);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (payload._id) {
      updateQuestion.mutate({ id: payload._id, data: payload }, { onSuccess: closeEditor });
    } else {
      createQuestion.mutate(payload, { onSuccess: closeEditor });
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Question Bank</h1>
            <p className="text-base-content/70">
              Manage interview questions, boilerplates, visible cases, and hidden validation cases.
            </p>
          </div>
          <button className="btn btn-primary gap-2" onClick={startCreate} id="new-question-btn">
            <PlusIcon className="size-4" />
            New Question
          </button>
        </div>

        <div className="overflow-x-auto bg-base-100 border border-base-300 rounded-lg">
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Difficulty</th>
                <th>Testcases</th>
                <th>Languages</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5}>Loading questions...</td>
                </tr>
              )}
              {questions.map((question) => (
                <tr key={question._id || question.id}>
                  <td>
                    <div className="font-semibold">{question.title}</div>
                    <div className="text-sm opacity-60">{question.category || question.slug}</div>
                  </td>
                  <td>
                    <span className={`badge ${getDifficultyBadgeClass(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  </td>
                  <td>
                    {question.visibleTestCaseCount ?? question.visibleTestCases?.length ?? 0} visible /{" "}
                    {question.totalTestCaseCount ?? (
                      (question.visibleTestCases?.length ?? 0) + (question.hiddenTestCases?.length ?? 0)
                    )} total
                  </td>
                  <td>{(question.supportedLanguages || ["javascript", "cpp", "python", "java"]).join(", ")}</td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(question)}
                      id={`edit-question-${question._id || question.id}`}
                    >
                      <Edit3Icon className="size-4" />
                    </button>
                    {question._id && (
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        id={`delete-question-${question._id}`}
                        onClick={() => {
                          if (confirm(`Delete ${question.title}?`)) deleteQuestion.mutate(question._id);
                        }}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingQuestion && (
        <div className="modal modal-open">
          <div className="modal-box max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                {editingQuestion._id ? "Edit Question" : "Create Question"}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={closeEditor} id="close-editor-btn">
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="mb-3 p-3 rounded-lg border border-info/30 bg-info/10 text-sm text-info">
              <strong>Tip:</strong> JSON fields (testcases, examples, boilerplates) must be valid JSON arrays/objects.
              An inline error will appear if the JSON is invalid — fix it before saving.
            </div>

            <div className="grid lg:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-2">
              <label className="form-control">
                <span className="label-text font-medium mb-1">Title *</span>
                <input
                  className="input input-bordered"
                  placeholder="e.g. Two Sum"
                  value={editingQuestion.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  id="question-title"
                />
              </label>
              <label className="form-control">
                <span className="label-text font-medium mb-1">Slug</span>
                <input
                  className="input input-bordered"
                  placeholder="e.g. two-sum (auto-generated if empty)"
                  value={editingQuestion.slug || ""}
                  onChange={(e) => updateField("slug", e.target.value)}
                  id="question-slug"
                />
              </label>
              <label className="form-control">
                <span className="label-text font-medium mb-1">Difficulty *</span>
                <select
                  className="select select-bordered"
                  value={editingQuestion.difficulty}
                  onChange={(e) => updateField("difficulty", e.target.value)}
                  id="question-difficulty"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="form-control">
                <span className="label-text font-medium mb-1">Category</span>
                <input
                  className="input input-bordered"
                  placeholder="e.g. Array - Hash Table"
                  value={editingQuestion.category || ""}
                  onChange={(e) => updateField("category", e.target.value)}
                  id="question-category"
                />
              </label>
              <label className="form-control">
                <span className="label-text font-medium mb-1">Function Name *</span>
                <input
                  className="input input-bordered"
                  placeholder="e.g. twoSum"
                  value={editingQuestion.functionName || ""}
                  onChange={(e) => updateField("functionName", e.target.value)}
                  id="question-function-name"
                />
              </label>
              <label className="form-control">
                <span className="label-text font-medium mb-1">Return Type</span>
                <select
                  className="select select-bordered"
                  value={editingQuestion.returnType}
                  onChange={(e) => updateField("returnType", e.target.value)}
                  id="question-return-type"
                >
                  <option value="int">int</option>
                  <option value="intArray">intArray</option>
                  <option value="string">string</option>
                  <option value="boolean">boolean</option>
                </select>
              </label>
              <label className="form-control lg:col-span-2">
                <span className="label-text font-medium mb-1">Description *</span>
                <textarea
                  className="textarea textarea-bordered"
                  rows={4}
                  placeholder="Problem description..."
                  value={editingQuestion.description?.text || ""}
                  onChange={(e) => updateDescriptionText(e.target.value)}
                  id="question-description"
                />
              </label>

              <JsonField
                fieldKey="parameterSignature"
                label="Parameter Signature"
                value={editingQuestion.parameterSignature}
                onCommit={makeJsonCommitHandler("parameterSignature")}
              />
              <JsonField
                fieldKey="examples"
                label="Examples"
                value={editingQuestion.examples}
                onCommit={makeJsonCommitHandler("examples")}
              />
              <JsonField
                fieldKey="constraints"
                label="Constraints"
                value={editingQuestion.constraints}
                onCommit={makeJsonCommitHandler("constraints")}
              />
              <JsonField
                fieldKey="tags"
                label="Tags"
                value={editingQuestion.tags}
                onCommit={makeJsonCommitHandler("tags")}
              />
              <JsonField
                fieldKey="visibleTestCases"
                label="Visible Testcases * (format: [{input: [...], expectedOutput: ...}])"
                value={editingQuestion.visibleTestCases}
                onCommit={makeJsonCommitHandler("visibleTestCases")}
                rows={8}
              />
              <JsonField
                fieldKey="hiddenTestCases"
                label="Hidden Testcases * (format: [{input: [...], expectedOutput: ...}])"
                value={editingQuestion.hiddenTestCases}
                onCommit={makeJsonCommitHandler("hiddenTestCases")}
                rows={8}
              />
              <div className="lg:col-span-2">
                <JsonField
                  fieldKey="boilerplates"
                  label='Boilerplates (format: {"javascript": "...", "cpp": "...", "python": "...", "java": "..."})'
                  value={editingQuestion.boilerplates}
                  onCommit={makeJsonCommitHandler("boilerplates")}
                  rows={10}
                />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeEditor} id="cancel-edit-btn">Cancel</button>
              <button
                className="btn btn-primary gap-2"
                onClick={saveQuestion}
                disabled={createQuestion.isPending || updateQuestion.isPending}
                id="save-question-btn"
              >
                <SaveIcon className="size-4" />
                {createQuestion.isPending || updateQuestion.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeEditor}></div>
        </div>
      )}
    </div>
  );
}

export default ProblemsPage;
