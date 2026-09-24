import { Router } from "express";

const router = Router();

// Positive Fixture 1: Express admin route without auth middleware
router.post("/admin/reset-password", (req, res) => {
  res.json({ status: "password reset" });
});

export default router;
