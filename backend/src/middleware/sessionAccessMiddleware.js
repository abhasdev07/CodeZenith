import Session from "../models/Session.js";

const SESSION_MEMBER_POPULATE = [
  { path: "host", select: "name email profileImage clerkId" },
  { path: "participant", select: "name email profileImage clerkId" },
];

export const resolveRoleInSession = (session, userId) => {
  const normalizedUserId = userId?.toString();
  const hostId = session?.host?._id?.toString?.() || session?.host?.toString?.();
  const participantId = session?.participant?._id?.toString?.() || session?.participant?.toString?.();
  const isInterviewer = hostId === normalizedUserId;
  const isCandidate = participantId === normalizedUserId;

  if (isInterviewer) return "interviewer";
  if (isCandidate) return "candidate";
  return "viewer";
};

export const loadSessionAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id).populate(SESSION_MEMBER_POPULATE);

    if (!session) return res.status(404).json({ message: "Session not found" });

    const roleInSession = resolveRoleInSession(session, req.user._id);
    req.sessionDoc = session;
    req.roleInSession = roleInSession;
    next();
  } catch (error) {
    console.log("Error in loadSessionAccess middleware:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const requireSessionParticipant = (req, res, next) => {
  if (req.roleInSession === "interviewer" || req.roleInSession === "candidate") return next();
  return res.status(403).json({ message: "Only session participants can access this action" });
};

export const requireSessionInterviewer = (req, res, next) => {
  if (req.roleInSession === "interviewer") return next();
  return res.status(403).json({ message: "Only the session interviewer can access this action" });
};

export const requireSessionCandidate = (req, res, next) => {
  if (req.roleInSession === "candidate") return next();
  return res.status(403).json({ message: "Only the session candidate can access this action" });
};
