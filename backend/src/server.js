const app = require('./app');
const { initDb } = require('./database');

const PORT = process.env.PORT || 8000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`BookEase API server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
