import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

// Load environment variables (local dev only)
dotenv.config();

const app = express();
const PORT = 3000;

// Enable large JSON bodies for facial capture vectors
app.use(express.json({ limit: '20mb' }));

// --- IN-MEMORY FALLBACK (local dev only) ---
let localStudents: any[] = [];
let localAttendance: any[] = [];
let localAdmins: any[] = [
  { username: 'admin', passwordKey: 'password' }
];

const dbName = 'attendance_db';

// --- MONGODB CONNECTION ---
// Cached across warm Vercel invocations
let mongoClient: MongoClient | null = null;
let mongoConnectionPromise: Promise<MongoClient | null> | null = null;

function getUri(): string | null {
  const raw = process.env.MONGODB_URI;
  if (!raw) return null;
  return raw.trim().replace(/^['"]|['"]$/g, '').trim() || null;
}

function maskUri(uri: string): string {
  try {
    const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (m) return `${m[1]}${m[2]}:******@${m[4]}`;
    return 'mongodb+srv://******... (Configured)';
  } catch {
    return 'Configured URI (Masked)';
  }
}

async function connectToMongo(uri: string): Promise<MongoClient | null> {
  try {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000, // 10s — gives Vercel cold starts enough time
      connectTimeoutMS: 10000,
    });
    await client.connect();

    // Verify the connection is actually alive
    await client.db('admin').command({ ping: 1 });

    // Seed default admin if none exists
    const db = client.db(dbName);
    const adminCount = await db.collection('admins').countDocuments();
    if (adminCount === 0) {
      await db.collection('admins').insertOne({ username: 'admin', passwordKey: 'password' });
    }

    mongoClient = client;
    console.log('Successfully connected to MongoDB.');
    return client;
  } catch (err: any) {
    console.error('MongoDB connection failed:', err?.message || err);
    mongoClient = null;
    mongoConnectionPromise = null; // Allow retry on next request
    return null;
  }
}

async function getMongoClient(): Promise<MongoClient | null> {
  const uri = getUri();

  if (!uri) {
    console.error('MONGODB_URI is not set.');
    return null;
  }

  // Return cached client if alive
  if (mongoClient) {
    try {
      await mongoClient.db('admin').command({ ping: 1 });
      return mongoClient;
    } catch {
      // Client died — reset and reconnect
      console.warn('MongoDB client ping failed, reconnecting...');
      mongoClient = null;
      mongoConnectionPromise = null;
    }
  }

  // Deduplicate concurrent connection attempts
  if (!mongoConnectionPromise) {
    mongoConnectionPromise = connectToMongo(uri);
  }

  return mongoConnectionPromise;
}

// Warm up connection at startup (non-Vercel)
if (!process.env.VERCEL) {
  getMongoClient().catch(() => {
    console.warn('Startup connection failed. Will retry per-request.');
  });
}

// Helper: true if we have a live DB client
function isConnected(client: MongoClient | null): client is MongoClient {
  return client !== null;
}

// --- API ENDPOINTS ---

// GET unified database payload
app.get('/api/data', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      const db = client.db(dbName);
      const [students, attendance, admins] = await Promise.all([
        db.collection('students').find({}).toArray(),
        db.collection('attendance').find({}).toArray(),
        db.collection('admins').find({}).toArray(),
      ]);
      res.json({ success: true, students, attendance, admins, mongoConnected: true, usingMemory: false });
    } else {
      res.json({
        success: true,
        students: localStudents,
        attendance: localAttendance,
        admins: localAdmins,
        mongoConnected: false,
        usingMemory: true,
      });
    }
  } catch (error: any) {
    console.error('Error fetching unified dataset:', error);
    res.status(500).json({ success: false, error: 'Database retrieval failed', details: error.message });
  }
});

// Check database connection status
app.get('/api/db-status', async (req, res) => {
  const uri = getUri();
  const client = uri ? await getMongoClient() : null;
  const connected = isConnected(client);
  res.json({
    connected,
    provider: connected ? 'MongoDB Atlas (Live)' : 'Local In-Memory Cache',
    hasUri: !!uri,
    uriMasked: uri ? maskUri(uri) : null,
  });
});

// GET all students
app.get('/api/students', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      const students = await client.db(dbName).collection('students').find({}).toArray();
      res.json(students);
    } else {
      res.json(localStudents);
    }
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to retrieve students' });
  }
});

// POST register student
app.post('/api/students', async (req, res) => {
  try {
    const student = req.body;
    if (!student?.studentId) {
      res.status(400).json({ error: 'Invalid student schema' });
      return;
    }
    const idNorm = student.studentId.trim().toUpperCase();

    const client = await getMongoClient();
    if (isConnected(client)) {
      const col = client.db(dbName).collection('students');
      const duplicate = await col.findOne({ studentId: { $regex: new RegExp(`^${idNorm}$`, 'i') } });
      if (duplicate) { res.status(400).json({ error: 'Matriculation number already registered' }); return; }
      await col.insertOne(student);
      res.status(201).json({ success: true, student });
    } else {
      if (localStudents.some(s => s.studentId.toUpperCase() === idNorm)) {
        res.status(400).json({ error: 'Matriculation number already registered' }); return;
      }
      localStudents.push(student);
      res.status(201).json({ success: true, student });
    }
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ error: 'Failed to write student data' });
  }
});

// DELETE student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      await client.db(dbName).collection('students').deleteOne({ id: req.params.id });
    } else {
      localStudents = localStudents.filter(s => s.id !== req.params.id);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// POST clear all students
app.post('/api/students/clear', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      await client.db(dbName).collection('students').deleteMany({});
    } else {
      localStudents = [];
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing students:', error);
    res.status(500).json({ error: 'Error clearing students' });
  }
});

// GET all attendance logs
app.get('/api/attendance', async (req, res) => {
  try {
    let attendance: any[] = [];
    const client = await getMongoClient();
    if (isConnected(client)) {
      attendance = await client.db(dbName).collection('attendance').find({}).toArray();
    } else {
      attendance = localAttendance;
    }
    const sorted = [...attendance].sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '');
      return d !== 0 ? d : (b.time || '').localeCompare(a.time || '');
    });
    res.json(sorted);
  } catch (e) {
    console.error('Error fetching attendance:', e);
    res.status(500).json([]);
  }
});

// POST add attendance record
app.post('/api/attendance', async (req, res) => {
  try {
    const record = req.body;
    if (!record?.studentId) {
      res.status(400).json({ error: 'Invalid attendance schema' }); return;
    }

    const client = await getMongoClient();
    if (isConnected(client)) {
      const col = client.db(dbName).collection('attendance');
      const isDuplicate = await col.findOne({ studentId: record.studentId, date: record.date });
      if (isDuplicate) { res.json({ success: true, info: 'Attendance already recorded for today' }); return; }
      await col.insertOne(record);
      res.status(201).json({ success: true, record });
    } else {
      if (localAttendance.some(r => r.studentId === record.studentId && r.date === record.date)) {
        res.json({ success: true, info: 'Attendance already recorded for today' }); return;
      }
      localAttendance.unshift(record);
      res.status(201).json({ success: true, record });
    }
  } catch (error) {
    console.error('Error logging attendance:', error);
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// POST clear all attendance
app.post('/api/attendance/clear', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      await client.db(dbName).collection('attendance').deleteMany({});
    } else {
      localAttendance = [];
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing attendance:', error);
    res.status(500).json({ error: 'Error clearing logs' });
  }
});

// GET admins
app.get('/api/admins', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isConnected(client)) {
      const admins = await client.db(dbName).collection('admins').find({}).toArray();
      res.json(admins);
    } else {
      res.json(localAdmins);
    }
  } catch (e) {
    console.error('Error retrieving admins:', e);
    res.status(500).json([]);
  }
});

// POST register admin
app.post('/api/admins', async (req, res) => {
  try {
    const { username, passwordKey } = req.body;
    if (!username || !passwordKey) {
      res.status(400).json({ error: 'Missing required credentials' }); return;
    }
    const usernameNorm = username.trim().toLowerCase();

    const client = await getMongoClient();
    if (isConnected(client)) {
      const col = client.db(dbName).collection('admins');
      const duplicate = await col.findOne({ username: { $regex: new RegExp(`^${usernameNorm}$`, 'i') } });
      if (duplicate) { res.status(400).json({ error: 'Administrator username already exists' }); return; }
      const newAdmin = { username: username.trim(), passwordKey };
      await col.insertOne(newAdmin);
      res.status(201).json({ success: true, admin: newAdmin });
    } else {
      if (localAdmins.some(a => a.username.toLowerCase() === usernameNorm)) {
        res.status(400).json({ error: 'Administrator username already exists' }); return;
      }
      const newAdmin = { username: username.trim(), passwordKey };
      localAdmins.push(newAdmin);
      res.status(201).json({ success: true, admin: newAdmin });
    }
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({ error: 'Error adding administrator account' });
  }
});

// --- START SERVER ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
