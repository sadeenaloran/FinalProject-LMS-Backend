import express from "express";
import questionController from "../controllers/questionController.js";
import { authenticateJWT, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/:quiz_id",
  authenticateJWT,
  authorize(["instructor", "admin"]),
  questionController.createQuestion
);

router.get("/:id", authenticateJWT, questionController.getQuestion);

router.put(
  "/:id",
  authenticateJWT,
  authorize(["instructor", "admin"]),
  questionController.updateQuestion
);

router.delete(
  "/:id",
  authenticateJWT,
  authorize(["instructor", "admin"]),
  questionController.deleteQuestion
);

router.get(
  "/quiz/:quiz_id",
  authenticateJWT,
  questionController.getQuestionsByQuiz
);

export default router;
