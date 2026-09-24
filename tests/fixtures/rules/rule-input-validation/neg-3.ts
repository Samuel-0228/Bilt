import express from "express";

const app = express();
const db: any = {};

// Negative Fixture 3: Query without passing entire body
app.get("/api/items", async (req, res) => {
  const items = await db.query("SELECT * FROM items");
  res.json(items);
});

export default app;
