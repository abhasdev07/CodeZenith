import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { questionApi } from "../api/questions";

export const useQuestions = () =>
  useQuery({
    queryKey: ["questions"],
    queryFn: questionApi.listQuestions,
  });

export const useQuestion = (id) =>
  useQuery({
    queryKey: ["question", id],
    queryFn: () => questionApi.getQuestion(id),
    enabled: !!id,
  });

export const useCreateQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createQuestion"],
    mutationFn: questionApi.createQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success("Question created");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to create question"),
  });
};

export const useUpdateQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["updateQuestion"],
    mutationFn: questionApi.updateQuestion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["question", variables.id] });
      toast.success("Question updated");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to update question"),
  });
};

export const useDeleteQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deleteQuestion"],
    mutationFn: questionApi.deleteQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast.success("Question deleted");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to delete question"),
  });
};
