import { Router } from "express";

const router = Router();
const requireAuth = (req: any, res: any, next: any) => next();

// Negative Fixture 1: Express admin route protected by requireAuth
router.post("/admin/reset-password", requireAuth, (req, res) => {
  res.json({ status: "password reset" });
});

export default router;
