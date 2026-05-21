import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from "mongoose";
import { MongoClient } from 'mongodb';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable large JSON bodies for facial capture vectors
app.use(express.json({ limit: '20mb' }));

// --- IN-MEMORY TEMPORARY STORAGE ---
// These act as a fully functional local development state if MongoDB is not connected
let localStudents: any[] = [];
let localAttendance: any[] = [];
let localAdmins: any[] = [
  { username: 'admin', passwordKey: 'password' }
];
const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing");
}

mongoose.connect(uri);
// --- MONGODB CONNECTION POOL COUPLER ---
const dbName = 'attendance_db';
let mongoClient: MongoClient | null = null;
let isMongoConnected = false;
let mongoError: string | null = null;

// Mask real MongoDB password parts for UI diagnostics
function maskUri(uri: string): string {
  try {
    const matches = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (matches) {
      const [, proto, user, , rest] = matches;
      return `${proto}${user}:******@${rest}`;
    }
    return "mongodb+srv://******... (Configured)";
  } catch (e) {
    return "Configured URI (Masked)";
  }
}

let activeUri: string | null = null;
let mongoConnectionPromise: Promise<MongoClient | null> | null = null;

async function connectToMongo(uri: string): Promise<MongoClient | null> {
  try {
    console.log("Attempting background connection to MongoDB...");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    
    // Seed default admin if none exists
    const db = client.db(dbName);
    const count = await db.collection('admins').countDocuments();
    if (count === 0) {
      await db.collection('admins').insertOne({ username: 'admin', passwordKey: 'password' });
    }
    
    mongoClient = client;
    isMongoConnected = true;
    mongoError = null;
    console.log("Successfully connected to MongoDB Cluster.");
    return client;
  } catch (err: any) {
    isMongoConnected = false;
    mongoError = err?.message || String(err);
    console.error("Failed to connect to MongoDB:", err);
    mongoConnectionPromise = null; // reset promise so next request attempts connection
    return null;
  }
}

async function getMongoClient() {
  if (!process.env.VERCEL) {
    try {
      dotenv.config({ override: true });
    } catch (e) {
      console.warn("Failed to dynamically reload dotenv:", e);
    }
  }

  let currentUri = process.env.MONGODB_URI;
  if (currentUri) {
    currentUri = currentUri.trim().replace(/^['"]|['"]$/g, '').trim();
  }

  if (currentUri !== activeUri) {
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (e) {}
      mongoClient = null;
    }
    isMongoConnected = false;
    mongoConnectionPromise = null;
    activeUri = currentUri || null;
  }

  if (isMongoConnected && mongoClient) {
    return mongoClient;
  }
  if (!currentUri) {
    isMongoConnected = false;
    mongoError = 'MONGODB_URI environment variable is not defined';
    return null;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = connectToMongo(currentUri);
  }

  return mongoConnectionPromise;
}

// Fire initial connection test in the background
getMongoClient().catch(err => {
  console.log("Initial connection attempt parsed. Operating in memory sandbox until loaded.");
});

// --- API ENDPOINTS ---

// GET unified database payload
app.get('/api/data', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const students = await db.collection('students').find({}).toArray();
      const attendance = await db.collection('attendance').find({}).toArray();
      const admins = await db.collection('admins').find({}).toArray();
      res.json({
        success: true,
        students,
        attendance,
        admins,
        mongoConnected: true,
        usingMemory: false
      });
    } else {
      res.json({
        success: true,
        students: localStudents,
        attendance: localAttendance,
        admins: localAdmins,
        mongoConnected: false,
        usingMemory: true
      });
    }
  } catch (error: any) {
    console.error('Error fetching unified dataset:', error);
    res.status(500).json({ success: false, error: 'Database unified retrieval failed', details: error.message });
  }
});

// Check database connection status live
app.get('/api/db-status', async (req, res) => {
  let currentUri = process.env.MONGODB_URI;
  if (currentUri) {
    currentUri = currentUri.trim().replace(/^['"]|['"]$/g, '').trim();
  }
  if (currentUri && !isMongoConnected) {
    await getMongoClient();
  }
  res.json({
    connected: isMongoConnected,
    provider: isMongoConnected ? 'MongoDB Atlas (Live Cluster)' : 'Local In-Memory Cache',
    hasUri: !!currentUri,
    error: mongoError,
    uriMasked: currentUri ? maskUri(currentUri) : null
  });
});

// GET all students
app.get('/api/students', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const students = await db.collection('students').find({}).toArray();
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
    if (!student || !student.studentId) {
      res.status(400).json({ error: 'Invalid student schema' });
      return;
    }
    const studentIdNormalized = student.studentId.trim().toUpperCase();

    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const duplicate = await db.collection('students').findOne({
        studentId: { $regex: new RegExp(`^${studentIdNormalized}$`, 'i') }
      });
      if (duplicate) {
        res.status(400).json({ error: 'Matriculation number already registered' });
        return;
      }
      await db.collection('students').insertOne(student);
      res.status(201).json({ success: true, student });
    } else {
      const duplicate = localStudents.some(
        s => s.studentId.toUpperCase() === studentIdNormalized
      );
      if (duplicate) {
        res.status(400).json({ error: 'Matriculation number already registered' });
        return;
      }
      localStudents.push(student);
      res.status(201).json({ success: true, student });
    }
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ error: 'Failed to write student data' });
  }
});

// DELETE standard student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const idToDelete = req.params.id;
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      await db.collection('students').deleteOne({ id: idToDelete });
      res.json({ success: true });
    } else {
      localStudents = localStudents.filter(s => s.id !== idToDelete);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// POST clear all students
app.post('/api/students/clear', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      await db.collection('students').deleteMany({});
      res.json({ success: true });
    } else {
      localStudents = [];
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error clearing students:', error);
    res.status(500).json({ error: 'Error clearing students' });
  }
});

// GET all attendance logs
app.get('/api/attendance', async (req, res) => {
  try {
    let attendance = [];
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      attendance = await db.collection('attendance').find({}).toArray();
    } else {
      attendance = localAttendance;
    }
    const sorted = [...attendance].sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.time || '').localeCompare(a.time || '');
    });
    res.json(sorted);
  } catch (e) {
    console.error('Error fetching attendance logs:', e);
    res.status(500).json([]);
  }
});

// POST add attendance record
app.post('/api/attendance', async (req, res) => {
  try {
    const record = req.body;
    if (!record || !record.studentId) {
      res.status(400).json({ error: 'Invalid attendance schema' });
      return;
    }

    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const isDuplicate = await db.collection('attendance').findOne({
        studentId: record.studentId,
        date: record.date
      });
      if (isDuplicate) {
        res.json({ success: true, info: 'Attendance already recorded for today' });
        return;
      }
      await db.collection('attendance').insertOne(record);
      res.status(201).json({ success: true, record });
    } else {
      const isDuplicate = localAttendance.some(
        r => r.studentId === record.studentId && r.date === record.date
      );
      if (isDuplicate) {
        res.json({ success: true, info: 'Attendance already recorded for today' });
        return;
      }
      localAttendance.unshift(record);
      res.status(201).json({ success: true, record });
    }
  } catch (error) {
    console.error('Error logging attendance:', error);
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// POST clear all attendance records
app.post('/api/attendance/clear', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      await db.collection('attendance').deleteMany({});
      res.json({ success: true });
    } else {
      localAttendance = [];
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error clearing attendance:', error);
    res.status(500).json({ error: 'Error clearing logs' });
  }
});

// GET admins
app.get('/api/admins', async (req, res) => {
  try {
    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const admins = await db.collection('admins').find({}).toArray();
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
      res.status(400).json({ error: 'Missing required credentials' });
      return;
    }
    const usernameNorm = username.trim().toLowerCase();

    const client = await getMongoClient();
    if (isMongoConnected && client) {
      const db = client.db(dbName);
      const duplicate = await db.collection('admins').findOne({
        username: { $regex: new RegExp(`^${usernameNorm}$`, 'i') }
      });
      if (duplicate) {
        res.status(400).json({ error: 'Administrator username already exists' });
        return;
      }
      const newAdmin = { username: username.trim(), passwordKey };
      await db.collection('admins').insertOne(newAdmin);
      res.status(201).json({ success: true, admin: newAdmin });
    } else {
      const duplicate = localAdmins.some(a => a.username.toLowerCase() === usernameNorm);
      if (duplicate) {
        res.status(400).json({ error: 'Administrator username already exists' });
        return;
      }
      const newAdmin = { username: username.trim(), passwordKey };
      localAdmins.push(newAdmin);
      res.status(201).json({ success: true, admin: newAdmin });
    }
  } catch (error) {
    console.error('Error adding administrator account:', error);
    res.status(500).json({ error: 'Error adding administrator account' });
  }
});

// Start server and mount Vite
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if not running in the Vercel backend serverless function
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Express server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
