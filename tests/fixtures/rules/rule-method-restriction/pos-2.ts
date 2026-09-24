import { Router } from "express";

const router = Router();

// Positive Fixture 2: Router.all wildcard
router.all("/webhook", (req, res) => {
  res.send("webhook handled");
});

export default router;
