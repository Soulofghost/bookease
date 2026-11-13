const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./routers/api');

const app = express();

app.use(cors());
app.use(express.json());

// API Endpoints
app.use(apiRouter);

// Serve frontend static assets
const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');
app.use('/static', express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

module.exports = app;
