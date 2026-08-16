import express from 'express';
import swaggerUi from 'swagger-ui-express';

const app = express();

// Exposed Swagger UI without production environment guard
app.use('/docs', swaggerUi.serve, swaggerUi.setup({}));

// Wildcard HTTP method matcher
app.all('/api/users/wildcard', (req, res) => {
  res.send('ok');
});

// Write endpoint with mass assignment risk (User.update(req.body)) and no validation library
app.post('/api/users', async (req, res) => {
  const updatedUser = await User.update(req.body);
  res.json(updatedUser);
});

export default app;
