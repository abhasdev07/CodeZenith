import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { PROBLEMS } from "../data/problems";
import {
  useCreateQuestion,
  useDeleteQuestion,
  useQuestions,
  useUpdateQuestion,
} from "../hooks/useQuestions";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Edit3Icon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";

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

function JsonField({ label, value, onChange, rows = 5 }) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <textarea
        className="textarea textarea-bordered font-mono text-xs"
        rows={rows}
        value={JSON.stringify(value ?? [], null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            onChange(event.target.value);
          }
        }}
      />
    </label>
  );
}

function ProblemsPage() {
  const { data, isLoading } = useQuestions();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const fallbackProblems = useMemo(() => Object.values(PROBLEMS), []);
  const questions = data?.questions?.length ? data.questions : fallbackProblems;
  const [editingQuestion, setEditingQuestion] = useState(null);

  const startCreate = () => setEditingQuestion(toEditableQuestion(emptyQuestion));
  const startEdit = (question) => setEditingQuestion(toEditableQuestion(question));
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

  const saveQuestion = () => {
    const payload = toEditableQuestion(editingQuestion);
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
          <button className="btn btn-primary gap-2" onClick={startCreate}>
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
                    {question.totalTestCaseCount ?? question.visibleTestCases?.length ?? 0} total
                  </td>
                  <td>{(question.supportedLanguages || ["javascript", "cpp", "python", "java"]).join(", ")}</td>
                  <td className="text-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(question)}>
                      <Edit3Icon className="size-4" />
                    </button>
                    {question._id && (
                      <button
                        className="btn btn-ghost btn-sm text-error"
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
              <button className="btn btn-ghost btn-sm" onClick={closeEditor}>
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
              <input className="input input-bordered" placeholder="Title" value={editingQuestion.title} onChange={(e) => updateField("title", e.target.value)} />
              <input className="input input-bordered" placeholder="Slug" value={editingQuestion.slug || ""} onChange={(e) => updateField("slug", e.target.value)} />
              <select className="select select-bordered" value={editingQuestion.difficulty} onChange={(e) => updateField("difficulty", e.target.value)}>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
              <input className="input input-bordered" placeholder="Category" value={editingQuestion.category || ""} onChange={(e) => updateField("category", e.target.value)} />
              <input className="input input-bordered" placeholder="Function name" value={editingQuestion.functionName || ""} onChange={(e) => updateField("functionName", e.target.value)} />
              <select className="select select-bordered" value={editingQuestion.returnType} onChange={(e) => updateField("returnType", e.target.value)}>
                <option value="int">int</option>
                <option value="intArray">intArray</option>
                <option value="string">string</option>
                <option value="boolean">boolean</option>
              </select>
              <textarea className="textarea textarea-bordered lg:col-span-2" rows={4} placeholder="Description" value={editingQuestion.description?.text || ""} onChange={(e) => updateDescriptionText(e.target.value)} />
              <JsonField label="Parameter Signature" value={editingQuestion.parameterSignature} onChange={(value) => updateField("parameterSignature", value)} />
              <JsonField label="Examples" value={editingQuestion.examples} onChange={(value) => updateField("examples", value)} />
              <JsonField label="Constraints" value={editingQuestion.constraints} onChange={(value) => updateField("constraints", value)} />
              <JsonField label="Tags" value={editingQuestion.tags} onChange={(value) => updateField("tags", value)} />
              <JsonField label="Visible Testcases" value={editingQuestion.visibleTestCases} onChange={(value) => updateField("visibleTestCases", value)} rows={8} />
              <JsonField label="Hidden Testcases" value={editingQuestion.hiddenTestCases} onChange={(value) => updateField("hiddenTestCases", value)} rows={8} />
              <JsonField label="Boilerplates" value={editingQuestion.boilerplates} onChange={(value) => updateField("boilerplates", value)} rows={10} />
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeEditor}>Cancel</button>
              <button className="btn btn-primary gap-2" onClick={saveQuestion} disabled={createQuestion.isPending || updateQuestion.isPending}>
                <SaveIcon className="size-4" />
                Save
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
