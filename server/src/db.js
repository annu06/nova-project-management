import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nova';

// Set USE_MEMORY_DB=1 to spin up an ephemeral in-memory MongoDB.
// Handy for local dev / demos when no real MongoDB is available.
const USE_MEMORY_DB = process.env.USE_MEMORY_DB === '1';

let memoryServer = null;

async function startMemoryServer() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  console.log(`[db] connected to in-memory MongoDB at ${uri}`);
  return true;
}

export async function connectDB() {
  mongoose.set('strictQuery', true);

  if (USE_MEMORY_DB) {
    try {
      return await startMemoryServer();
    } catch (err) {
      console.error('[db] failed to start in-memory MongoDB:', err.message);
      return false;
    }
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      // Fail fast instead of buffering for the default 30s when Mongo is down.
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[db] connected to MongoDB at ${MONGODB_URI}`);
    return true;
  } catch (err) {
    console.error('[db] failed to connect to MongoDB:', err.message);
    console.error(
      '[db] Is MongoDB running? Set MONGODB_URI in server/.env ' +
        '(e.g. a MongoDB Atlas connection string), start a local mongod, ' +
        'or run with USE_MEMORY_DB=1 for an ephemeral in-memory database.'
    );
    return false;
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export default mongoose;
