export interface Student {
  id: string;
  name: string;
  studentId: string; // Matriculation number as main lookup handle
  matricNo: string;
  regNo: string;
  college: string;
  hall: string;
  department: string;
  passwordKey: string;
  faceVectors: number[][]; // Multiple 32x32 = 1024 pixel vectors
  enrolledAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  name: string;
  date: string;
  time: string;
  status: 'Present' | 'Absent';
  method: 'PCA' | 'LDA';
  confidence: number; // Projection similarity percentage (0-100)
}

export interface PCAProjectionResult {
  weights: number[]; // Coordinate vector in face space
  distance: number; // Euclidean distance
  closestStudentId?: string;
  confidence: number;
}

export interface LDAProjectionResult {
  weights: number[];
  distance: number;
  closestStudentId?: string;
  confidence: number;
}

export interface FaceSpaceCoordinates {
  studentId: string;
  name: string;
  x: number; // PC1 weight
  y: number; // PC2 weight
  z?: number; // PC3 weight
  ldaX: number; // LDA Dim 1
  ldaY: number; // LDA Dim 2
}
