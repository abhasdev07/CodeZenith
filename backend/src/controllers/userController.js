import User from "../models/User.js";

export async function setUserRole(req, res) {
  try {
    const { role } = req.body;
    const userId = req.user._id;

    if (!["interviewer", "candidate"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'interviewer' or 'candidate'" });
    }

    // Update role in MongoDB
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Note: Clerk metadata sync requires Clerk SDK which may not be installed
    // For now, we update MongoDB role and frontend will check backend for role
    console.log(`✅ User role updated in MongoDB: ${user.email} -> ${role}`);

    res.status(200).json({ 
      message: `Role updated to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) {
    console.log("Error in setUserRole controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("name email role clerkId profileImage");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.log("Error in getCurrentUser controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
