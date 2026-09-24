import { Router } from "express";

const router = Router();

// Negative Fixture 2: Explicit POST method
router.post("/webhook", (req, res) => {
  res.send("webhook handled");
});

export default router;
