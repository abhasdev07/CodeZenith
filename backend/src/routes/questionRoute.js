import express from "express";
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
} from "../controllers/questionController.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

router.get("/", protectRoute, listQuestions);
router.get("/:id", protectRoute, getQuestion);
router.post("/", protectRoute, createQuestion);
router.put("/:id", protectRoute, updateQuestion);
router.delete("/:id", protectRoute, deleteQuestion);

export default router;
