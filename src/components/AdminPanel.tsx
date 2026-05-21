import { useState } from 'react';
import {
  getStudents,
  getAttendance,
  generateAttendanceCSV,
  generateThematicCSS,
  deleteStudent,
  clearAllStudents,
  clearAttendance,
  retrainFaceModel
} from '../lib/db';
import {
  FileText,
  Download,
  Users,
  CalendarCheck,
  Percent,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Layers,
  Cpu,
  ShieldAlert
} from 'lucide-react';
import FaceCanvas from './FaceCanvas';

interface AdminPanelProps {
  onRefresh: () => void;
}

export default function AdminPanel({ onRefresh }: AdminPanelProps) {
  const students = getStudents();
  const attendance = getAttendance();

  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearAttendanceConfirm, setShowClearAttendanceConfirm] = useState(false);

  // Download logic helpers
  const triggerCSVDownload = () => {
    const csvContent = generateAttendanceCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Log_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerCSSDownload = () => {
    const cssContent = generateThematicCSS();
    const blob = new Blob([cssContent], { type: 'text/css;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Facial_Attendance_Theme.css`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteStudent = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteStudent(deleteTarget.id);
      setDeleteTarget(null);
      onRefresh();
    }
  };

  const handleClearAllStudents = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    clearAllStudents();
    setShowClearConfirm(false);
    onRefresh();
  };

  const confirmClearAttendance = () => {
    clearAttendance();
    setShowClearAttendanceConfirm(false);
    onRefresh();
  };

  // Metric computations
  const totalEnrolled = students.length;
  const todayPresent = attendance.filter(
    a => a.date === new Date().toLocaleDateString() && a.status === 'Present'
  ).length;
  const averageConfidence = attendance.length
    ? Math.round(attendance.reduce((sum, a) => sum + a.confidence, 0) / attendance.length)
    : 0;

  return (
    <div id="admin-panel" className="space-y-6">
      {/* Top Banner Metric Summary - Bento Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm flex items-center gap-4 hover:border-indigo-200 transition-all">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner shadow-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider font-semibold">Enrolled Classes</p>
            <h4 className="text-2xl font-bold font-sans tracking-tight text-slate-900 mt-0.5">
              {totalEnrolled} Active
            </h4>
          </div>
        </div>

        <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm flex items-center gap-4 hover:border-emerald-200 transition-all">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner shadow-emerald-50">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider font-semibold">Verified Today</p>
            <h4 className="text-2xl font-bold font-sans tracking-tight text-slate-900 mt-0.5">
              {todayPresent} Present
            </h4>
          </div>
        </div>

        <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-sm flex items-center gap-4 hover:border-amber-200 transition-all">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-inner shadow-amber-50">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider font-semibold">Mean Similarity</p>
            <h4 className="text-2xl font-bold font-sans tracking-tight text-slate-900 mt-0.5">
              {averageConfidence ? `${averageConfidence}%` : 'N/A'}
            </h4>
          </div>
        </div>
      </div>

      {/* Main split work space */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side: Student Directory - Bento Card */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-fit space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-500" /> Student biometric Roster
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-1">Registered mathematical face arrays</p>
            </div>
            {students.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllStudents}
                className="flex items-center gap-1 text-[10px] font-bold text-red-650 hover:text-red-800 bg-red-50 hover:bg-red-100/50 px-2 py-1.5 rounded-lg border border-red-200/50 transition-all cursor-pointer whitespace-nowrap"
                title="Clear all registered students"
              >
                <Trash2 className="w-3 h-3 text-red-500" /> Clear All
              </button>
            )}
          </div>

          <div className="divide-y max-h-96 overflow-y-auto pr-1">
            {students.map(student => {
              const isExpanded = expandedStudentId === student.id;
              // Compute an average thumbnail face vector
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
                <div key={student.id} className="py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FaceCanvas vector={avgVector} className="w-8 h-8" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{student.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">{student.studentId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                      className="p-1 border text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md cursor-pointer transition-all"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-700 space-y-2 animate-fade-in">
                      <p><strong>Matriculation No:</strong> <span className="font-mono">{student.matricNo || student.studentId}</span></p>
                      <p><strong>Registration No:</strong> <span className="font-mono">{student.regNo || "N/A"}</span></p>
                      <p><strong>College:</strong> {student.college || "N/A"}</p>
                      <p><strong>Hall of Residence:</strong> {student.hall || "N/A"}</p>
                      <p><strong>Department:</strong> {student.department || "N/A"}</p>
                      <p><strong>Enrolled stamp:</strong> {new Date(student.enrolledAt).toLocaleString()}</p>
                      
                      <div className="pt-2 border-t flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100/50 px-2.5 py-1.5 rounded-lg border border-red-200/50 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" /> Remove Student Profile
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t">
                        <p className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">Captured calibration matrices (Samples 1-5):</p>
                        <div className="flex items-center gap-1">
                          {student.faceVectors.map((vec, idx) => (
                            <FaceCanvas key={idx} vector={vec} className="w-6 h-6" title={`S${idx + 1}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side: Attendance Logs + Downloads (Bento Block) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Attendance Ledger Log
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1">Real-time biometrics registration entries</p>
              </div>

              {/* Download actions */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={triggerCSVDownload}
                  className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm transition-all tracking-tight"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-100" /> Download Attendance .CSV
                </button>
                <button
                  type="button"
                  onClick={triggerCSSDownload}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer shadow-sm transition-all tracking-tight"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-300" /> Download Theme .CSS
                </button>
              </div>
            </div>

            {/* Attendance list table */}
            {attendance.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-sans text-xs">
                No attendance logs entered for today. Trigger Verification on the Student Board.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-100">
                  <thead className="bg-slate-50/50 font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3">Student ID</th>
                      <th className="py-3 px-3">Logged stamp</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Algorithm</th>
                      <th className="py-3 px-3 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-800">
                    {attendance.map(r => {
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-3 font-semibold text-slate-900">{r.name}</td>
                          <td className="py-3.5 px-3 font-mono text-slate-600">{r.studentId}</td>
                          <td className="py-3.5 px-3 font-mono text-slate-500">{r.date} · {r.time}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold font-mono border border-emerald-100">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-medium">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold ${
                              r.method === 'LDA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-105' : 'bg-blue-50 text-blue-700 border border-blue-105'
                            }`}>
                              {r.method} Space
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">{r.confidence}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {attendance.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowClearAttendanceConfirm(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-red-650 hover:text-red-800 cursor-pointer bg-red-50 hover:bg-red-100/80 px-3.5 py-2 rounded-xl border border-red-200/50 transition-all select-none"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" /> Clear Attendance History
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Modal Confirmation for Individual Student Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setDeleteTarget(null)}
          ></div>
          {/* Modal box */}
          <div className="relative bg-white border border-slate-200 shadow-xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl w-fit">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 font-sans">Remove Student Profile?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Are you absolutely sure you want to permanently delete student <strong className="text-slate-800">{deleteTarget.name}</strong> and all of their registered face biometric coordinates from the database?
              </p>
            </div>
            <div className="flex gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all cursor-pointer font-sans"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal Confirmation for Clearing All Students */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowClearConfirm(false)}
          ></div>
          {/* Modal box */}
          <div className="relative bg-white border border-slate-200 shadow-xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl w-fit">
              <ShieldAlert className="w-6 h-6 animate-bounce text-red-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 font-sans">Clear All Students?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                This action is <strong className="text-red-700">completely irreversible</strong>. You will permanently purge all enrolled students, delete all registered face biometric mathematical vectors, and retrain the face model.
              </p>
            </div>
            <div className="flex gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all cursor-pointer font-sans"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal Confirmation for Clearing Attendance History */}
      {showClearAttendanceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowClearAttendanceConfirm(false)}
          ></div>
          {/* Modal box */}
          <div className="relative bg-white border border-slate-200 shadow-xl rounded-3xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl w-fit">
              <ShieldAlert className="w-6 h-6 animate-bounce text-red-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 font-sans">Clear Attendance History?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Are you absolutely sure you want to permanently delete all attendance ledger logs? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowClearAttendanceConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAttendance}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all cursor-pointer font-sans"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
