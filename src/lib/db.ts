import { Student, AttendanceRecord } from '../types';
import { trainModels, TrainedFaceSpace } from './faceMath';

export interface AdminAccount {
  username: string;
  passwordKey: string;
}

// Global cached state loaded from the Server Memory Cache
let cachedStudents: Student[] = [];
let cachedAttendance: AttendanceRecord[] = [];
let cachedAdmins: AdminAccount[] = [
  { username: 'admin', passwordKey: 'password' }
];
let cachedModel: TrainedFaceSpace | null = null;

// Simplistic application connection status (Clean Local-Only mode)
export let isMongoConnected = false;
export let isUsingMemory = true;
export let dbLoading = true;

// Pub/Sub observer listeners for live UI re-rendering
type DbChangeCallback = () => void;
const listeners = new Set<DbChangeCallback>();

export function subscribeToDb(callback: DbChangeCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function onDBSync(callback: DbChangeCallback): () => void {
  return subscribeToDb(callback);
}

function notifyListeners(): void {
  listeners.forEach(cb => cb());
}

// Initialize state by pulling local tables on the server
export async function initializeDB(): Promise<void> {
  try {
    dbLoading = true;
    notifyListeners();

    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const result = await response.json();
    
    if (result.success) {
      cachedStudents = result.students || [];
      cachedAttendance = result.attendance || [];
      cachedAdmins = result.admins || [
        { username: 'admin', passwordKey: 'password' }
      ];
      isMongoConnected = !!result.mongoConnected;
      isUsingMemory = !!result.usingMemory;
    }
  } catch (err) {
    console.error("Local server state unreachable, utilizing offline browser fallback:", err);
    isMongoConnected = false;
    isUsingMemory = true;
  } finally {
    dbLoading = false;
    retrainFaceModel();
    notifyListeners();
  }
}

// Get list of administrator accounts
export function getAdmins(): AdminAccount[] {
  return cachedAdmins;
}

// Register a new admin account
export function addAdmin(username: string, passwordKey: string): boolean {
  const normalizedUser = username.trim().toLowerCase();
  const exists = cachedAdmins.some(a => a.username.trim().toLowerCase() === normalizedUser);
  if (exists) {
    return false; // already exists
  }

  const payload = { username: username.trim(), passwordKey };
  
  cachedAdmins.push(payload);
  notifyListeners();

  // Persist to clean Local Server Memory
  fetch('/api/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(e => {
    console.error('Local server sync failed:', e);
  });

  return true;
}

export function getStudents(): Student[] {
  return cachedStudents;
}

export function getAttendance(): AttendanceRecord[] {
  return cachedAttendance;
}

export function addStudent(student: Student): void {
  cachedStudents.push(student);
  retrainFaceModel();
  notifyListeners();

  // Persist to clean Local Server Memory
  fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  }).catch(e => {
    console.error('Local server registration sync failed:', e);
  });
}

export function deleteStudent(id: string): void {
  cachedStudents = cachedStudents.filter(s => s.id !== id);
  retrainFaceModel();
  notifyListeners();

  // Persist delete to clean Local Server Memory
  fetch(`/api/students/${id}`, {
    method: 'DELETE'
  }).catch(e => {
    console.error('Local server student deletion sync failed:', e);
  });
}

export function clearAllStudents(): void {
  cachedStudents = [];
  retrainFaceModel();
  notifyListeners();

  // Clear in local server storage
  fetch('/api/students/clear', {
    method: 'POST'
  }).catch(e => {
    console.error('Local server students clear failed:', e);
  });
}

export function addAttendanceRecord(record: AttendanceRecord): void {
  // Prevent duplicate logs of same student on the same day
  const isDuplicate = cachedAttendance.some(
    r => r.studentId === record.studentId && r.date === record.date
  );
  if (isDuplicate) return;

  cachedAttendance.unshift(record);
  notifyListeners();

  // Post to local server storage
  fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  }).catch(e => {
    console.error('Local server attendance append failed:', e);
  });
}

export function clearAttendance(): void {
  cachedAttendance = [];
  notifyListeners();

  // Clear server storage
  fetch('/api/attendance/clear', {
    method: 'POST'
  }).catch(e => {
    console.error('Local server attendance clear failed:', e);
  });
}

export function retrainFaceModel(): void {
  cachedModel = trainModels(cachedStudents);
}

export function getTrainedModel(): TrainedFaceSpace | null {
  if (!cachedModel && cachedStudents.length > 0) {
    retrainFaceModel();
  }
  return cachedModel;
}

// Generate dynamic CSV reports
export function generateAttendanceCSV(): string {
  const records = getAttendance();
  const dateStr = new Date().toLocaleDateString();
  const metaRows = [
    `# Biometric Attendance System Report`,
    `# Export Date: ${dateStr}`,
    `# Total Present Sessions: ${records.filter(r => r.status === 'Present').length}`,
    `#`
  ];
  const headers = ['Record ID', 'Student ID', 'Student Name', 'Date', 'Time', 'Status', 'Algorithm Used', 'Confidence Score'];
  const rows = records.map(r => [
    r.id,
    r.studentId,
    r.name,
    r.date,
    r.time,
    r.status,
    r.method,
    `${r.confidence}%`
  ]);

  const csvContent = [
    ...metaRows,
    headers.join(','),
    ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

// Generates CSS stylesheet for interactive visualization settings
export function generateThematicCSS(): string {
  const dateStr = new Date().toLocaleDateString();
  const records = getAttendance();
  const presentCount = records.filter(r => r.status === 'Present').length;
  
  return `/* 
   * Facial Recognition System Theme Stylesheet
   * Generated Automatically on ${dateStr}
   * Current Attendance: ${presentCount} Present
   */

:root {
  --pca-primary: #3b82f6; /* Modern Blue */
  --lda-primary: #10b981; /* Fisher Green */
  --dashboard-bg: #f8fafc;
  --panel-active: rgb(240, 253, 250);
  --theme-brand: "Facial Algebra Attendance Console";
}

/* Custom indicator styles loaded from Admin Panel preferences */
.attendance-badge-present {
  background-color: rgb(209, 250, 229);
  color: rgb(6, 95, 70);
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
}

.pca-projection-point {
  fill: var(--pca-primary);
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4));
}

.lda-projection-point {
  fill: var(--lda-primary);
  filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4));
}
`;
}
