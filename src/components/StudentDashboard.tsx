import { useState } from 'react';
import { Student, AttendanceRecord } from '../types';
import { getAttendance, getTrainedModel } from '../lib/db';
import { Calendar, User, BookOpen, Clock, Fingerprint, CalendarCheck } from 'lucide-react';
import StudentAttendanceVerifier from './StudentAttendanceVerifier';
import FaceCanvas from './FaceCanvas';

interface StudentDashboardProps {
  student: Student;
  onLogout: () => void;
}

export default function StudentDashboard({ student, onLogout }: StudentDashboardProps) {
  const [successRecord, setSuccessRecord] = useState<AttendanceRecord | null>(null);
  
  // Load global logs, then filter for this student's records
  const allRecords = getAttendance();
  const studentRecords = allRecords.filter(r => r.studentId === student.studentId);
  const isPresentToday = studentRecords.some(r => r.date === new Date().toLocaleDateString());

  const handleVerifiedLog = (record: AttendanceRecord) => {
    setSuccessRecord(record);
  };

  const model = getTrainedModel();
  // Find this student's specific coordinates in Face Space to explain PCA live weights
  const thisProj = model?.studentProjections.find(p => p.studentId === student.studentId);

  // Compute a thumbnail from average of their 5 arrays
  const size = student.faceVectors[0].length;
  const avgVector = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    let sum = 0;
    student.faceVectors.forEach(v => {
      sum += v[i];
    });
    avgVector[i] = sum / student.faceVectors.length;
  }

  return (
    <div id="student-dashboard" className="space-y-6">
      {/* Top Welcome card / Profile info (Bento Style) */}
      <div className="bg-white border border-slate-202 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <FaceCanvas vector={avgVector} className="w-16 h-16 ring-4 ring-indigo-50 rounded-2xl" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{student.name}</h2>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono rounded-full border border-indigo-100">
                  Enrolled Profile
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono tracking-wide">
                Matric Component ID: <strong className="text-slate-800 font-semibold">{student.matricNo || student.studentId}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold rounded-xl text-xs cursor-pointer transition-all"
            >
              Log Out Account
            </button>
          </div>
        </div>

        {/* Detailed Profile Grid displaying All requested biometric profile details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs leading-relaxed">
          <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Matriculation No</p>
            <p className="font-semibold text-slate-800 font-mono mt-0.5">{student.matricNo || student.studentId}</p>
          </div>
          <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Registration No</p>
            <p className="font-semibold text-slate-800 font-mono mt-0.5">{student.regNo || "N/A"}</p>
          </div>
          <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 col-span-2 md:col-span-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">College</p>
            <p className="font-semibold text-slate-800 mt-0.5 line-clamp-1">{student.college || "N/A"}</p>
          </div>
          <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Hall & Department</p>
            <p className="font-semibold text-slate-800 mt-0.5 line-clamp-1">
              {student.hall || "N/A"} · {student.department || "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: Taking attendance Biometrics */}
        <div className="space-y-6">
          {isPresentToday ? (
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-emerald-900">Biometric Attendance Logged Today</h3>
                <p className="text-xs text-emerald-700">
                  You successfully verified your face on the PCA-LDA Fisher coordinates mesh for {new Date().toLocaleDateString()}.
                </p>
              </div>
              {studentRecords[0] && (
                <div className="max-w-xs mx-auto p-3 bg-white/80 border border-emerald-200 text-[11px] text-emerald-800 rounded-lg font-mono">
                  Verified: {studentRecords[0].time} via {studentRecords[0].method} (Confidence: {studentRecords[0].confidence}%)
                </div>
              )}
            </div>
          ) : (
            <StudentAttendanceVerifier
              currentStudent={student}
              onLoggedSuccess={handleVerifiedLog}
            />
          )}
          {/* Core Eigenvalue Weights Inspector (Bento Box) */}
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-indigo-500 animate-pulse" /> Biometric Identity Signatures
            </h4>
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
              Below are the actual linear weights of your signature projected onto the first 3 Eigenfaces of this academic model.
            </p>

            {thisProj ? (
              <div className="space-y-3 mt-4 font-mono text-[11px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Eigen-Component 1 (Luminance Weight):</span>
                    <span className="font-bold text-indigo-655 font-mono">{(thisProj.pcaWeights[0] || 0).toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, Math.min(95, 50 + (thisProj.pcaWeights[0] || 0) * 20))}%` }}
                      className="bg-indigo-600 h-full rounded"
                    ></div>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Eigen-Component 2 (Symmetry Contrast):</span>
                    <span className="font-bold text-indigo-655 font-mono">{(thisProj.pcaWeights[1] || 0).toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, Math.min(95, 50 + (thisProj.pcaWeights[1] || 0) * 25))}%` }}
                      className="bg-purple-600 h-full rounded"
                    ></div>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Eigen-Component 3 (Expansion ratio):</span>
                    <span className="font-bold text-indigo-655 font-mono">{(thisProj.pcaWeights[2] || 0).toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, Math.min(95, 50 + (thisProj.pcaWeights[2] || 0) * 30))}%` }}
                      className="bg-blue-650 h-full rounded"
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No linear projections compiled yet.</p>
            )}
          </div>
        </div>

        {/* Right side: Historical log cards (Bento Box) */}
        <div className="bg-white border border-slate-202 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Personal Biometric Logs
            </h3>
            <p className="text-[11px] text-slate-500 font-mono mt-1">Your past verification entries on this node</p>
          </div>

          {studentRecords.length === 0 ? (
            <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
              No historical entries captured on this system. Take attendance today!
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {studentRecords.map(record => (
                <div key={record.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-slate-500 border border-slate-200 shadow-sm">
                      <Clock className="w-4 h-4 text-indigo-550" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{record.date}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Logged at {record.time}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold font-mono rounded-full leading-none border border-emerald-200">
                      Present
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Matched: <strong className="text-slate-800">{record.confidence}%</strong> ({record.method})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
