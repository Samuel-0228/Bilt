import express from "express";
import { exec } from "child_process";
import OpenAI from "openai";
import { Client } from "pg";

const app = express();
app.use(express.json());

const db = new Client({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Vulnerability 1: Plaintext password comparison
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ token: "fake-token" });
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// Vulnerability 2: SQL Injection
app.get("/users/:id", async (req, res) => {
  const result = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
  res.json(result.rows);
});

// Vulnerability 3: Command Injection
app.post("/ping", (req, res) => {
  exec(`ping -c 1 ${req.query.host}`, (err, stdout) => {
    res.send(stdout);
  });
});

// Vulnerability 4: Client-controlled admin assignment
app.post("/profile", (req, res) => {
  const isAdmin = req.body.isAdmin;
  res.json({ updated: true, isAdmin });
});

// Vulnerability 5: Unauthenticated expensive AI call without rate limiting
app.post("/api/ai/generate", async (req, res) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: req.body.prompt }],
  });
  res.json(completion.choices[0]);
});

app.listen(3000);
