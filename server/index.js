const express = require('express');
const app = express();
const port = 5000; // Choose a different port than React's default 3000

app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from Node.js Express Backend!' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
