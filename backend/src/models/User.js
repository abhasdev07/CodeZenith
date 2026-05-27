import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    // Role-based access control for interviews
    // interviewer: Can create/manage interview sessions
    // candidate: Can join interview sessions and solve problems
    role: {
      type: String,
      enum: ["interviewer", "candidate"],
      default: "candidate",
      index: true,
    },
    // Future extensibility for role hierarchy, permissions, etc.
  },
  { timestamps: true } // createdAt, updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;
