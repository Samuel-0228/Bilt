import express from "express";

const app = express();

// Positive Fixture 2: Express billing deletion without auth
app.delete("/api/billing/subscription", (req, res) => {
  res.json({ cancelled: true });
});

export default app;
