import axiosInstance from "../lib/axios";

export const sessionApi = {
  createSession: async (data) => {
    const response = await axiosInstance.post("/sessions", data);
    return response.data;
  },

  getActiveSessions: async () => {
    const response = await axiosInstance.get("/sessions/active");
    return response.data;
  },
  getMyRecentSessions: async () => {
    const response = await axiosInstance.get("/sessions/my-recent");
    return response.data;
  },

  getSessionById: async (id) => {
    const response = await axiosInstance.get(`/sessions/${id}`);
    return response.data;
  },
  ensureSessionChatAccess: async (id) => {
    const response = await axiosInstance.post(`/sessions/${id}/chat-access`);
    return response.data;
  },

  joinSession: async (id) => {
    const response = await axiosInstance.post(`/sessions/${id}/join`);
    return response.data;
  },
  joinSessionWithInvite: async ({ id, inviteToken }) => {
    const response = await axiosInstance.post(`/sessions/${id}/join`, { inviteToken });
    return response.data;
  },
  joinSessionByToken: async (inviteToken) => {
    const response = await axiosInstance.post(`/sessions/join/${inviteToken}`);
    return response.data;
  },
  endSession: async (id) => {
    const response = await axiosInstance.post(`/sessions/${id}/end`);
    return response.data;
  },
  updateActiveProblem: async ({ id, activeProblemIndex }) => {
    const response = await axiosInstance.patch(`/sessions/${id}/active-problem`, {
      activeProblemIndex,
    });
    return response.data;
  },
  updateCodeState: async ({ id, codeKey, code }) => {
    const response = await axiosInstance.patch(`/sessions/${id}/code-state`, {
      codeKey,
      code,
    });
    return response.data;
  },
  getStreamToken: async () => {
    const response = await axiosInstance.get(`/chat/token`);
    return response.data;
  },
};
