import express from "express";

const app = express();

// Negative Fixture 2: Non-sensitive public health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

export default app;
