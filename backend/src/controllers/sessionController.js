import { chatClient, streamClient } from "../lib/stream.js";
import crypto from "crypto";
import { ENV } from "../lib/env.js";
import { resolveRoleInSession } from "../middleware/sessionAccessMiddleware.js";
import Session from "../models/Session.js";

function normalizeProblems(payload) {
  if (Array.isArray(payload?.problems) && payload.problems.length > 0) {
    return payload.problems
      .map((problem) => ({
        title: problem?.title?.trim(),
        difficulty: problem?.difficulty?.toLowerCase(),
      }))
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
    session.inviteLink = `${ENV.CLIENT_URL}/session/${session._id}?invite=${session.inviteToken}`;
  }
  return session;
}

function getSessionPayload(sessionDoc, userId) {
  const session = withInviteLink(sessionDoc);
  return {
    session,
    roleInSession: resolveRoleInSession(session, userId),
  };
}

export async function createSession(req, res) {
  try {
    const problems = normalizeProblems(req.body);
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (problems.length === 0) {
      return res.status(400).json({ message: "At least one valid problem is required" });
    }

    const firstProblem = problems[0];
    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const inviteToken = crypto.randomBytes(16).toString("hex");

    // create session in db
    const session = await Session.create({
      problem: firstProblem.title,
      difficulty: firstProblem.difficulty,
      problems,
      activeProblemIndex: 0,
      host: userId,
      interviewer: userId,
      callId,
      inviteToken,
      startedAt: new Date(),
      status: "waiting",
    });

    // create stream video call
    await streamClient.video.call("default", callId).getOrCreate({
      data: {
        created_by_id: clerkId,
        custom: {
          problem: firstProblem.title,
          difficulty: firstProblem.difficulty,
          problems,
          activeProblemIndex: 0,
          sessionId: session._id.toString(),
        },
      },
    });

    // chat messaging
    const channel = chatClient.channel("messaging", callId, {
      name: `${firstProblem.title} Session`,
      created_by_id: clerkId,
      members: [clerkId],
    });

    await channel.create();

    res.status(201).json(getSessionPayload(session, userId));
  } catch (error) {
    console.log("Error in createSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
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
        roleInSession: resolveRoleInSession(sessionData, req.user._id),
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
      status: "completed",
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

    res.status(200).json(getSessionPayload(session, req.user._id));
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

    if (session.status === "completed" || session.status === "cancelled") {
      return res.status(400).json({ message: "Cannot join an ended session" });
    }

    if (session.host.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot join their own session as participant" });
    }

    if (session.participant?.toString() === userId.toString()) {
      return res.status(200).json(getSessionPayload(session, userId));
    }

    const alreadyInAnotherActiveSession = await Session.findOne({
      _id: { $ne: session._id },
      participant: userId,
      status: { $in: ["waiting", "active"] },
    }).select("_id");

    if (alreadyInAnotherActiveSession) {
      return res.status(409).json({
        message: "You are already participating in another active session",
      });
    }

    if (session.inviteToken && session.inviteToken !== inviteToken) {
      return res.status(403).json({ message: "Invalid or missing invite token" });
    }

    // check if session is already full - has a participant
    if (session.participant) return res.status(409).json({ message: "Session is full" });

    session.participant = userId;
    session.candidate = userId;
    session.status = "active";
    await session.save();

    const channel = chatClient.channel("messaging", session.callId);
    await channel.addMembers([clerkId]);

    res.status(200).json(getSessionPayload(session, userId));
  } catch (error) {
    console.log("Error in joinSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const session = req.sessionDoc || (await Session.findById(id));
    if (!session) return res.status(404).json({ message: "Session not found" });

    // check if session is already completed
    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }

    // delete stream video call
    const call = streamClient.video.call("default", session.callId);
    await call.delete({ hard: true });

    // delete stream chat channel
    const channel = chatClient.channel("messaging", session.callId);
    await channel.delete();

    session.status = "completed";
    session.endedAt = new Date();
    await session.save();

    res.status(200).json({
      ...getSessionPayload(session, req.user._id),
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
    session.problem = availableProblems[parsedIndex].title;
    session.difficulty = availableProblems[parsedIndex].difficulty;
    await session.save();

    res.status(200).json(getSessionPayload(session, req.user._id));
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
