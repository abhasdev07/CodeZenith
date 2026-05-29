import { chatClient, streamClient } from "../lib/stream.js";
import crypto from "crypto";
import { ENV } from "../lib/env.js";
import { questionSessionSummary, sanitizeQuestion } from "../lib/questionSerializer.js";
import { resolveRoleInSession } from "../middleware/sessionAccessMiddleware.js";
import Question from "../models/Question.js";
import Session from "../models/Session.js";

async function normalizeProblems(payload) {
  const incomingProblems = Array.isArray(payload?.questions) ? payload.questions : payload?.problems;
  const incomingQuestionIds = Array.isArray(payload?.questionIds) ? payload.questionIds : [];

  if (incomingQuestionIds.length > 0) {
    const questions = await Question.find({ _id: { $in: incomingQuestionIds } });
    const ordered = incomingQuestionIds
      .map((questionId) => questions.find((question) => question._id.toString() === questionId.toString()))
      .filter(Boolean);
    return ordered.map(questionSessionSummary);
  }

  if (Array.isArray(incomingProblems) && incomingProblems.length > 0) {
    const hydrated = await Promise.all(
      incomingProblems.map(async (problem) => {
        const questionId = problem?.questionId || problem?._id;
        const query = [];
        if (questionId) query.push({ _id: questionId });
        if (problem?.slug) query.push({ slug: problem.slug });
        if (problem?.title) query.push({ title: problem.title.trim() });
        const question = query.length ? await Question.findOne({ $or: query }) : null;
        if (question) return questionSessionSummary(question);

        return {
          questionId: problem?.questionId || null,
          slug: problem?.slug || "",
          title: problem?.title?.trim(),
          difficulty: problem?.difficulty?.toLowerCase(),
          visibleTestCaseCount: Number(problem?.visibleTestCaseCount || 0),
          totalTestCaseCount: Number(problem?.totalTestCaseCount || 0),
        };
      })
    );

    return hydrated
      .filter((problem) => problem.title && ["easy", "medium", "hard"].includes(problem.difficulty));
  }

  if (payload?.problem && payload?.difficulty) {
    return [
      {
        title: payload.problem.trim(),
        difficulty: payload.difficulty.toLowerCase(),
      },
    ];
  }

  return [];
}

function withInviteLink(sessionDoc) {
  const session = sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc;
  if (session?.inviteToken) {
    const clientUrl = ENV.CLIENT_URL?.replace(/\/$/, "");
    session.inviteLink = clientUrl
      ? `${clientUrl}/session/join/${session.inviteToken}`
      : `/session/join/${session.inviteToken}`;
  }
  if (!session.questions?.length && session.problems?.length) session.questions = session.problems;
  if (session.currentQuestionIndex === undefined) {
    session.currentQuestionIndex = session.activeProblemIndex || 0;
  }
  return session;
}

async function hydrateSessionQuestions(sessionDoc) {
  const session = withInviteLink(sessionDoc);
  const summaries = session.problems || [];
  const ids = summaries.map((problem) => problem.questionId).filter(Boolean);
  if (!ids.length) return session;

  const questions = await Question.find({ _id: { $in: ids } });
  const byId = new Map(questions.map((question) => [question._id.toString(), sanitizeQuestion(question)]));
  session.problems = summaries.map((summary) => {
    const question = summary.questionId ? byId.get(summary.questionId.toString()) : null;
    return question ? { ...summary, ...question, questionId: summary.questionId, question } : summary;
  });
  session.questions = session.problems;
  return session;
}

async function getSessionPayload(sessionDoc, user) {
  const session = await hydrateSessionQuestions(sessionDoc);
  const sessionRole = resolveRoleInSession(session, user);

  console.log("Session role assigned", {
    sessionId: session?._id?.toString?.(),
    userId: user?._id?.toString?.() || user?.toString?.(),
    clerkId: user?.clerkId,
    sessionRole,
  });

  return {
    session,
    roleInSession: sessionRole,
    sessionRole,
  };
}

function isEndedSession(session) {
  return ["ended", "completed", "cancelled"].includes(session.status);
}

async function joinSessionAsCandidate(session, user, clerkId) {
  if (isEndedSession(session)) {
    const error = new Error("This invite belongs to an ended session");
    error.statusCode = 410;
    throw error;
  }

  if (session.host.toString() === user._id.toString()) {
    return session;
  }

  if (session.participant?.toString() === user._id.toString()) {
    return session;
  }

  const alreadyInAnotherActiveSession = await Session.findOne({
    _id: { $ne: session._id },
    participant: user._id,
    status: { $in: ["waiting", "active"] },
  }).select("_id");

  if (alreadyInAnotherActiveSession) {
    const error = new Error("You are already participating in another active session");
    error.statusCode = 409;
    throw error;
  }

  if (session.participant) {
    const error = new Error("Session is full");
    error.statusCode = 409;
    throw error;
  }

  session.participant = user._id;
  session.status = "active";
  await session.save();

  const channel = chatClient.channel("messaging", session.callId);
  await channel.addMembers([clerkId]);

  console.log("Candidate joined session", {
    sessionId: session._id.toString(),
    candidateId: user._id.toString(),
    candidateClerkId: clerkId,
    callId: session.callId,
  });

  return session;
}

export async function createSession(req, res) {
  try {
    const problems = await normalizeProblems(req.body);
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (problems.length === 0) {
      return res.status(400).json({ message: "At least one valid problem is required" });
    }

    const firstProblem = problems[0];
    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inviteToken = crypto.randomBytes(16).toString("hex");

    // create session in db - creator becomes host (interviewer)
    const session = await Session.create({
      problem: firstProblem.title,
      difficulty: firstProblem.difficulty,
      problems,
      questions: problems,
      activeProblemIndex: 0,
      currentQuestionIndex: 0,
      host: userId,
      callId,
      inviteToken,
      startedAt: new Date(),
      status: "waiting",
    });

    console.log("Session created with invite", {
      sessionId: session._id.toString(),
      hostId: userId.toString(),
      inviteToken,
      inviteLink: withInviteLink(session).inviteLink,
      callId,
    });

    // create stream video call
    try {
      await streamClient.video.call("default", callId).getOrCreate({
        data: {
          created_by_id: clerkId,
          custom: {
            problem: firstProblem.title,
            difficulty: firstProblem.difficulty,
            problems,
            questions: problems,
            activeProblemIndex: 0,
            currentQuestionIndex: 0,
            sessionId: session._id.toString(),
          },
        },
      });
      console.log("Stream video call created successfully:", callId);
    } catch (streamError) {
      console.error("Error creating Stream video call:", {
        callId,
        error: streamError.message,
        details: streamError,
      });
      throw new Error(`Failed to create video room: ${streamError.message}`);
    }

    // chat messaging
    try {
      const channel = chatClient.channel("messaging", callId, {
        name: `${firstProblem.title} Session`,
        created_by_id: clerkId,
        members: [clerkId],
      });

      await channel.create();
      console.log("Stream chat channel created successfully:", callId);
    } catch (chatError) {
      console.error("Error creating Stream chat channel:", {
        callId,
        error: chatError.message,
        details: chatError,
      });
      throw new Error(`Failed to create chat channel: ${chatError.message}`);
    }

    res.status(201).json(await getSessionPayload(session, req.user));
  } catch (error) {
    console.error("Error in createSession controller:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    res.status(500).json({
      message: error.response?.data?.message || error.message || "Failed to create session",
    });
  }
}

export async function getActiveSessions(req, res) {
  try {
    const sessions = await Session.find({ status: { $in: ["waiting", "active"] } })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    const sessionsWithRole = sessions.map((session) => {
      const sessionData = withInviteLink(session);
      return {
        ...sessionData,
        roleInSession: resolveRoleInSession(sessionData, req.user),
        sessionRole: resolveRoleInSession(sessionData, req.user),
      };
    });
    res.status(200).json({ sessions: sessionsWithRole });
  } catch (error) {
    console.log("Error in getActiveSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyRecentSessions(req, res) {
  try {
    const userId = req.user._id;

    // get sessions where user is either host or participant
    const sessions = await Session.find({
      status: { $in: ["ended", "completed"] },
      $or: [{ host: userId }, { participant: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecentSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getSessionById(req, res) {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.status(200).json(await getSessionPayload(session, req.user));
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function joinSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;
    const inviteToken = req.body?.inviteToken || req.query?.inviteToken;

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.host.toString() === userId.toString()) {
      // Host rejoining - return with interviewer role
      return res.status(200).json(await getSessionPayload(session, req.user));
    }

    if (session.participant?.toString() === userId.toString()) {
      // Already joined as participant - return with candidate role
      return res.status(200).json(await getSessionPayload(session, req.user));
    }

    if (session.inviteToken && session.inviteToken !== inviteToken) {
      return res.status(403).json({ message: "Invalid or missing invite token" });
    }

    await joinSessionAsCandidate(session, req.user, clerkId);

    res.status(200).json(await getSessionPayload(session, req.user));
  } catch (error) {
    console.log("Error in joinSession controller:", error.message);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Internal Server Error" });
  }
}

export async function joinSessionByInviteToken(req, res) {
  try {
    const { inviteToken } = req.params;
    if (!inviteToken) return res.status(400).json({ message: "Invite token is required" });

    const session = await Session.findOne({ inviteToken });
    if (!session) return res.status(404).json({ message: "Invalid invite token" });

    await joinSessionAsCandidate(session, req.user, req.user.clerkId);

    const populatedSession = await Session.findById(session._id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    return res.status(200).json(await getSessionPayload(populatedSession, req.user));
  } catch (error) {
    console.log("Error in joinSessionByInviteToken controller:", error.message);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const session = req.sessionDoc || (await Session.findById(id));
    if (!session) return res.status(404).json({ message: "Session not found" });

    // check if session is already completed
    if (isEndedSession(session)) {
      return res.status(400).json({ message: "Session is already ended" });
    }

    // delete stream video call
    const call = streamClient.video.call("default", session.callId);
    await call.delete({ hard: true });

    // delete stream chat channel
    const channel = chatClient.channel("messaging", session.callId);
    await channel.delete();

    session.status = "ended";
    session.endedAt = new Date();
    await session.save();

    console.log("Session ended", {
      sessionId: session._id.toString(),
      endedBy: req.user._id.toString(),
      callId: session.callId,
    });

    res.status(200).json({
      ...(await getSessionPayload(session, req.user)),
      message: "Session ended successfully",
    });
  } catch (error) {
    console.log("Error in endSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function ensureSessionChatAccess(req, res) {
  try {
    const { id } = req.params;
    const session = req.sessionDoc || (await Session.findById(id).populate("host", "clerkId"));

    if (!session) return res.status(404).json({ message: "Session not found" });

    const currentClerkId = req.user.clerkId;
    const hostClerkId = session.host?.clerkId;

    const channel = chatClient.channel("messaging", session.callId, {
      name: `${session.problem} Session`,
      created_by_id: hostClerkId,
      members: [hostClerkId].filter(Boolean),
    });

    try {
      await channel.create();
    } catch (error) {
      // channel may already exist
      if (!String(error?.message || "").toLowerCase().includes("already exists")) {
        throw error;
      }
    }

    await channel.addMembers([currentClerkId]);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.log("Error in ensureSessionChatAccess controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateActiveProblem(req, res) {
  try {
    const { activeProblemIndex } = req.body;
    const session = req.sessionDoc || (await Session.findById(req.params.id));
    if (!session) return res.status(404).json({ message: "Session not found" });

    const parsedIndex = Number(activeProblemIndex);
    if (!Number.isInteger(parsedIndex)) {
      return res.status(400).json({ message: "activeProblemIndex must be an integer" });
    }

    const availableProblems = session.problems?.length
      ? session.problems
      : [{ title: session.problem, difficulty: session.difficulty }];

    if (parsedIndex < 0 || parsedIndex >= availableProblems.length) {
      return res.status(400).json({ message: "activeProblemIndex out of bounds" });
    }

    session.activeProblemIndex = parsedIndex;
    session.currentQuestionIndex = parsedIndex;
    session.problem = availableProblems[parsedIndex].title;
    session.difficulty = availableProblems[parsedIndex].difficulty;
    await session.save();

    res.status(200).json(await getSessionPayload(session, req.user));
  } catch (error) {
    console.log("Error in updateActiveProblem controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateCandidateCode(req, res) {
  try {
    const { codeKey, code } = req.body;

    if (!codeKey || typeof code !== "string") {
      return res.status(400).json({ message: "codeKey and code are required" });
    }

    const session = req.sessionDoc || (await Session.findById(req.params.id));
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.candidateCode.set(codeKey, code);
    await session.save();

    res.status(200).json({ message: "Code state updated" });
  } catch (error) {
    console.log("Error in updateCandidateCode controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
