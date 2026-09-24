import express from "express";

const app = express();

// Negative Fixture 1: Explicit GET method
app.get("/api/users", (req, res) => {
  res.json({ ok: true });
});

export default app;
