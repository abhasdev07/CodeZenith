import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sessionApi } from "../api/sessions";

export const useCreateSession = () => {
  const result = useMutation({
    mutationKey: ["createSession"],
    mutationFn: sessionApi.createSession,
    onSuccess: () => toast.success("Session created successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to create room"),
  });

  return result;
};

export const useActiveSessions = () => {
  const result = useQuery({
    queryKey: ["activeSessions"],
    queryFn: sessionApi.getActiveSessions,
  });

  return result;
};

export const useMyRecentSessions = () => {
  const result = useQuery({
    queryKey: ["myRecentSessions"],
    queryFn: sessionApi.getMyRecentSessions,
  });

  return result;
};

export const useSessionById = (id) => {
  const result = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getSessionById(id),
    enabled: !!id,
    refetchInterval: 5000, // refetch every 5 seconds to detect session status changes
  });

  return result;
};

export const useJoinSession = () => {
  const result = useMutation({
    mutationKey: ["joinSession"],
    mutationFn: sessionApi.joinSession,
    onSuccess: () => toast.success("Joined session successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useJoinSessionWithInvite = () => {
  const result = useMutation({
    mutationKey: ["joinSessionWithInvite"],
    mutationFn: sessionApi.joinSessionWithInvite,
    onSuccess: () => toast.success("Joined session successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useJoinSessionByToken = () => {
  const result = useMutation({
    mutationKey: ["joinSessionByToken"],
    mutationFn: sessionApi.joinSessionByToken,
    onSuccess: () => toast.success("Joined session successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useEndSession = () => {
  const result = useMutation({
    mutationKey: ["endSession"],
    mutationFn: sessionApi.endSession,
    onSuccess: () => toast.success("Session ended successfully!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to end session"),
  });

  return result;
};

export const useUpdateActiveProblem = () => {
  const result = useMutation({
    mutationKey: ["updateActiveProblem"],
    mutationFn: sessionApi.updateActiveProblem,
    onError: (error) =>
      toast.error(error.response?.data?.message || "Failed to switch active question"),
  });

  return result;
};

export const useUpdateCodeState = () => {
  const result = useMutation({
    mutationKey: ["updateCodeState"],
    mutationFn: sessionApi.updateCodeState,
    onError: (error) => toast.error(error.response?.data?.message || "Failed to save code state"),
  });

  return result;
};
