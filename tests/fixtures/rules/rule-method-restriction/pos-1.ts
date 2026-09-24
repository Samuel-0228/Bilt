import express from "express";

const app = express();

// Positive Fixture 1: Express app.all wildcard
app.all("/api/users", (req, res) => {
  res.json({ ok: true });
});

export default app;
