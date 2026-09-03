import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { setUserRole, getCurrentUser } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", protectRoute, getCurrentUser);
router.patch("/role", protectRoute, setUserRole);

export default router;
