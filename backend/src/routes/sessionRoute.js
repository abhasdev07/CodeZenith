import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  loadSessionAccess,
  requireSessionCandidate,
  requireSessionInterviewer,
  requireSessionParticipant,
} from "../middleware/sessionAccessMiddleware.js";
import {
  createSession,
  endSession,
  getActiveSessions,
  getMyRecentSessions,
  getSessionById,
  joinSession,
  joinSessionByInviteToken,
  ensureSessionChatAccess,
  updateActiveProblem,
  updateCandidateCode,
} from "../controllers/sessionController.js";

const router = express.Router();

/**
 * Session Routes with Role-Based Access Control
 *
 * Interviewer Routes:
 * - POST / - Create new interview session
 * - POST /:id/end - End an interview
 *
 * Candidate Routes:
 * - POST /:id/join - Join an interview session
 *
 * Public (Authenticated) Routes:
 * - GET /active - List active sessions
 * - GET /my-recent - Get user's recent sessions
 * - GET /:id - Get specific session details
 */

// Session creator automatically becomes interviewer for that session.
router.post("/", protectRoute, createSession);

router.post("/:id/end", protectRoute, loadSessionAccess, requireSessionInterviewer, endSession);
router.patch(
  "/:id/active-problem",
  protectRoute,
  loadSessionAccess,
  requireSessionInterviewer,
  updateActiveProblem
);
router.patch("/:id/code-state", protectRoute, loadSessionAccess, requireSessionCandidate, updateCandidateCode);
router.post(
  "/:id/chat-access",
  protectRoute,
  loadSessionAccess,
  requireSessionParticipant,
  ensureSessionChatAccess
);

// Joining user automatically becomes candidate for that session.
router.post("/join/:inviteToken", protectRoute, joinSessionByInviteToken);
router.post("/:id/join", protectRoute, joinSession);

// Public (authenticated) routes - accessible to all authenticated users
router.get("/active", protectRoute, getActiveSessions);
router.get("/my-recent", protectRoute, getMyRecentSessions);
router.get("/:id", protectRoute, getSessionById);

export default router;
