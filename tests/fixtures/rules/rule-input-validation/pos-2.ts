import express from "express";

const app = express();
const UserModel: any = {};

// Positive Fixture 2: Express endpoint passing req.body directly to UserModel
app.post("/api/register", async (req, res) => {
  const result = await UserModel.create(req.body);
  res.json(result);
});

export default app;
