import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },
    expectedOutput: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const boilerplateSchema = new mongoose.Schema(
  {
    javascript: { type: String, default: "" },
    cpp: { type: String, default: "" },
    python: { type: String, default: "" },
    java: { type: String, default: "" },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
      default: "easy",
    },
    category: { type: String, default: "", trim: true },
    description: {
      text: { type: String, default: "" },
      notes: { type: [String], default: [] },
    },
    constraints: { type: [String], default: [] },
    examples: {
      type: [
        {
          input: { type: String, default: "" },
          output: { type: String, default: "" },
          explanation: { type: String, default: "" },
        },
      ],
      default: [],
    },
    tags: { type: [String], default: [] },
    supportedLanguages: {
      type: [String],
      enum: ["javascript", "cpp", "python", "java"],
      default: ["javascript", "cpp", "python", "java"],
    },
    functionName: { type: String, required: true, trim: true },
    returnType: {
      type: String,
      enum: ["int", "intArray", "string", "boolean"],
      required: true,
      default: "int",
    },
    parameterSignature: {
      type: [
        {
          name: { type: String, required: true },
          type: {
            type: String,
            enum: ["int", "intArray", "string", "boolean"],
            required: true,
          },
        },
      ],
      default: [],
    },
    boilerplates: { type: boilerplateSchema, default: () => ({}) },
    visibleTestCases: { type: [testCaseSchema], default: [] },
    hiddenTestCases: { type: [testCaseSchema], default: [] },
    timeLimitMs: { type: Number, default: 3000 },
    memoryLimitMb: { type: Number, default: 128 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

questionSchema.virtual("totalTestCaseCount").get(function getTotalTestCaseCount() {
  return (this.visibleTestCases?.length || 0) + (this.hiddenTestCases?.length || 0);
});

questionSchema.set("toJSON", { virtuals: true });
questionSchema.set("toObject", { virtuals: true });

const Question = mongoose.model("Question", questionSchema);

export default Question;
