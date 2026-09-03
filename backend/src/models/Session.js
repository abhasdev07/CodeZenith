import mongoose from "mongoose";

const sessionProblemSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      default: null,
    },
    slug: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    visibleTestCaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTestCaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    problem: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    problems: {
      type: [sessionProblemSchema],
      default: [],
    },
    questions: {
      type: [sessionProblemSchema],
      default: [],
    },
    activeProblemIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["waiting", "active", "ended", "completed", "cancelled"],
      default: "waiting",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    candidateCode: {
      type: Map,
      of: String,
      default: {},
    },
    interviewNotes: {
      type: String,
      default: "",
      trim: true,
    },
    feedback: {
      type: String,
      default: "",
      trim: true,
    },
    inviteToken: {
      type: String,
      default: "",
      index: true,
    },
    // stream video call ID
    callId: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

sessionSchema.pre("validate", function syncRoleFields(next) {
  if (!this.interviewer && this.host) this.interviewer = this.host;
  if (!this.host && this.interviewer) this.host = this.interviewer;

  if (!this.candidate && this.participant) this.candidate = this.participant;
  if (!this.participant && this.candidate) this.participant = this.candidate;

  if ((!this.problems || this.problems.length === 0) && this.questions?.length > 0) {
    this.problems = this.questions;
  }

  if ((!this.questions || this.questions.length === 0) && this.problems?.length > 0) {
    this.questions = this.problems;
  }

  if ((!this.problems || this.problems.length === 0) && this.problem && this.difficulty) {
    this.problems = [{ title: this.problem, difficulty: this.difficulty }];
    this.questions = this.problems;
  }

  if (this.problems && this.problems.length > 0) {
    const rawIndex = this.isModified("currentQuestionIndex")
      ? this.currentQuestionIndex
      : this.activeProblemIndex;
    const safeIndex = Math.min(
      Math.max(Number(rawIndex || 0), 0),
      this.problems.length - 1
    );
    this.activeProblemIndex = safeIndex;
    this.currentQuestionIndex = safeIndex;
    this.questions = this.problems;
    this.problem = this.problems[safeIndex]?.title || this.problem;
    this.difficulty = this.problems[safeIndex]?.difficulty || this.difficulty;
  }

  next();
});

const Session = mongoose.model("Session", sessionSchema);

export default Session;
