import { Code2Icon, LoaderIcon, PlusIcon } from "lucide-react";
import { PROBLEMS } from "../data/problems";

function CreateSessionModal({
  isOpen,
  onClose,
  roomConfig,
  setRoomConfig,
  onCreateRoom,
  isCreating,
}) {
  const problems = Object.values(PROBLEMS);
  const selectedProblems = roomConfig.selectedProblems || [];

  const toggleProblemSelection = (problem) => {
    const exists = selectedProblems.some((p) => p.title === problem.title);
    if (exists) {
      setRoomConfig({
        selectedProblems: selectedProblems.filter((p) => p.title !== problem.title),
      });
      return;
    }

    setRoomConfig({
      selectedProblems: [
        ...selectedProblems,
        { title: problem.title, difficulty: problem.difficulty.toLowerCase() },
      ],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-2xl mb-6">Create New Session</h3>

        <div className="space-y-8">
          {/* PROBLEM SELECTION */}
          <div className="space-y-2">
            <label className="label">
              <span className="label-text font-semibold">Select Problems</span>
              <span className="label-text-alt text-error">*</span>
            </label>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-base-300 rounded-xl p-3 bg-base-200">
              {problems.map((problem) => {
                const isChecked = selectedProblems.some((p) => p.title === problem.title);
                return (
                  <label
                    key={problem.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={isChecked}
                      onChange={() => toggleProblemSelection(problem)}
                    />
                    <span className="font-medium">{problem.title}</span>
                    <span className="badge badge-sm badge-ghost ml-auto">{problem.difficulty}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ROOM SUMMARY */}
          {selectedProblems.length > 0 && (
            <div className="alert alert-success">
              <Code2Icon className="size-5" />
              <div>
                <p className="font-semibold">Room Summary:</p>
                <p>
                  Problems: <span className="font-medium">{selectedProblems.length}</span>
                </p>
                <p>
                  Max Participants: <span className="font-medium">2 (1-on-1 session)</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>

          <button
            className="btn btn-primary gap-2"
            onClick={onCreateRoom}
            disabled={isCreating || selectedProblems.length === 0}
          >
            {isCreating ? (
              <LoaderIcon className="size-5 animate-spin" />
            ) : (
              <PlusIcon className="size-5" />
            )}

            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
export default CreateSessionModal;
