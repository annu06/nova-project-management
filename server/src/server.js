import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 4000;

// Start the HTTP listener regardless of DB state so the API is reachable and
// its health endpoint is diagnosable. Data routes will error until Mongo is up.
app.listen(PORT, () => {
  console.log(`[server] NOVA API listening on http://localhost:${PORT}`);
});

connectDB().then((ok) => {
  if (!ok) {
    console.warn(
      '[server] Running without a database connection. ' +
        'Auth and data endpoints will not work until MongoDB is reachable.'
    );
  }
});
