import React, { useState } from 'react';
import { getStudents, getAdmins, addAdmin } from '../lib/db';
import { Student } from '../types';
import { KeyRound, ShieldAlert, BookOpen, Smartphone, ShieldCheck, User, CheckCircle2, UserPlus, Eye, EyeOff } from 'lucide-react';
import StudentRegister from './StudentRegister';

interface AuthViewProps {
  onLoginSuccess: (user: { role: 'student' | 'admin'; studentData?: Student }) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginStudentId, setLoginStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  // Admin login states
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('password');

  // Admin registers states
  const [isAdminRegisterMode, setIsAdminRegisterMode] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');

  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [showConfirmAdminPassword, setShowConfirmAdminPassword] = useState(false);

  const students = getStudents();

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccessMessage(null);

    const queryId = loginStudentId.trim().toUpperCase();
    const matched = students.find(s => s.studentId === queryId);

    if (matched) {
      const dbPassword = matched.passwordKey || '';
      if (dbPassword && dbPassword !== studentPassword) {
        setLoginError('Incorrect password entered. Please verify your student profile passcode.');
        return;
      }
      onLoginSuccess({ role: 'student', studentData: matched });
    } else {
      setLoginError('Student ID not found in the face-biometric coordinate database. Please Enroll an Account first.');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccessMessage(null);

    const admins = getAdmins();
    const matched = admins.find(
      a => a.username.toLowerCase() === adminUsername.trim().toLowerCase() && a.passwordKey === adminPassword
    );

    if (matched) {
      onLoginSuccess({ role: 'admin' });
    } else {
      setLoginError('Invalid Administrator credentials. Please verify your system credentials.');
    }
  };

  const handleAdminRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccessMessage(null);

    if (!newAdminUsername.trim()) {
      setLoginError('Admin username cannot be blank.');
      return;
    }
    if (newAdminPassword.length < 4) {
      setLoginError('Admin passcode must be at least 4 characters for basic system security.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    const success = addAdmin(newAdminUsername, newAdminPassword);
    if (success) {
      setLoginSuccessMessage(`Administrator "${newAdminUsername}" enrolled successfully! You can now log in.`);
      setAdminUsername(newAdminUsername);
      setAdminPassword(newAdminPassword);
      setIsAdminRegisterMode(false);
      setNewAdminUsername('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } else {
      setLoginError('This administrator username is already taken.');
    }
  };

  const handleRegistrationSuccess = (newStudent: Student) => {
    setIsRegisterMode(false);
    setLoginStudentId(newStudent.studentId);
    setStudentPassword(newStudent.passwordKey || '');
    setLoginSuccessMessage(`Profile created successfully for ${newStudent.name}! Your credentials have been auto-filled below.`);
  };

  if (isRegisterMode) {
    return (
      <div className="py-6 animate-fade-in">
        <StudentRegister
          onSuccess={handleRegistrationSuccess}
          onCancel={() => setIsRegisterMode(false)}
        />
      </div>
    );
  }

  return (
    <div id="auth-view" className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-202 shadow-xl overflow-hidden transition-all duration-300">
      {/* Top logo block */}
      <div className="bg-indigo-950 text-white p-8 text-center space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none"></div>
        <div className="w-12 h-12 bg-indigo-600/30 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/30 shadow-lg">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight">University Biometric Console</h1>
          <p className="text-xs text-indigo-300 mt-1 font-mono tracking-wide">PCA & LDA Linear Algebra Recognition System</p>
        </div>
      </div>

      {/* Tab controls */}
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        <button
          onClick={() => {
            setActiveTab('student');
            setLoginError(null);
            setLoginSuccessMessage(null);
            setIsAdminRegisterMode(false);
          }}
          className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === 'student'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white font-extrabold shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-4 h-4" /> Student Portal
        </button>
        <button
          onClick={() => {
            setActiveTab('admin');
            setLoginError(null);
            setLoginSuccessMessage(null);
          }}
          className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === 'admin'
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white font-extrabold shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Admin Console
        </button>
      </div>

      <div className="p-8 space-y-6">
        {loginError && (
          <div className="p-3.5 bg-red-50 border border-red-150 text-red-700 text-xs rounded-2xl flex items-start gap-2.5 font-medium leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        {loginSuccessMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 font-medium leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{loginSuccessMessage}</span>
          </div>
        )}

        {activeTab === 'student' ? (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Academic Student ID / Matric Number
                </label>
                <input
                  type="text"
                  required
                  value={loginStudentId}
                  onChange={e => setLoginStudentId(e.target.value)}
                  placeholder="e.g. CS-2026-004"
                  className="w-full text-sm px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 uppercase outline-none transition-all font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Student Password
                </label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={e => setStudentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm pl-4 pr-11 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                    title={showStudentPassword ? "Hide password" : "Show password"}
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Dynamic Hints based on actual custom data */}
              {students.length === 0 ? (
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-[11px] text-amber-800 leading-relaxed font-sans space-y-1.5">
                  <p className="font-semibold">No Students Enrolled Yet</p>
                  <p className="text-amber-700 text-[10px]">
                    To play around with the eigenvector mappings and verify biometric matches, start by clicking the enrollment button below to record your face coordinates.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-mono">Enrolled biometric cards (Click to auto-fill):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {students.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setLoginStudentId(s.studentId);
                          setStudentPassword(s.passwordKey || '');
                          setLoginError(null);
                        }}
                        className="text-[10px] font-mono px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors uppercase cursor-pointer"
                      >
                        {s.name} ({s.studentId})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" /> Access Student Dashboard
            </button>

            <div className="pt-4 border-t border-dashed border-slate-100 flex flex-col items-center justify-center gap-2">
              <p className="text-[11px] text-slate-500 text-center">New student or haven't calibrated your face?</p>
              <button
                type="button"
                onClick={() => setIsRegisterMode(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-850 cursor-pointer bg-indigo-50 hover:bg-indigo-100/70 p-2.5 px-4 rounded-xl border border-indigo-150/40 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" /> Enroll & Create Student Account
              </button>
            </div>
          </form>
        ) : (
          /* Admin Portal View */
          <div className="space-y-4">
            {/* Admin Register subtab toggle inside form */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                {isAdminRegisterMode ? 'New Admin Enrollment' : 'Academic Verification'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdminRegisterMode(!isAdminRegisterMode);
                  setLoginError(null);
                  setLoginSuccessMessage(null);
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                {isAdminRegisterMode ? 'Switch to Login' : 'Register New Admin Account'}
              </button>
            </div>

            {isAdminRegisterMode ? (
              /* Register Admin form */
              <form onSubmit={handleAdminRegistration} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      New Username
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. dean_academic"
                      value={newAdminUsername}
                      onChange={e => setNewAdminUsername(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 font-medium outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Admin Password Key
                    </label>
                    <div className="relative">
                      <input
                        type={showNewAdminPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={newAdminPassword}
                        onChange={e => setNewAdminPassword(e.target.value)}
                        className="w-full text-sm pl-4 pr-11 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 font-medium outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                        title={showNewAdminPassword ? "Hide password" : "Show password"}
                      >
                        {showNewAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmAdminPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmAdminPassword}
                        onChange={e => setConfirmAdminPassword(e.target.value)}
                        className="w-full text-sm pl-4 pr-11 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 font-medium outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmAdminPassword(!showConfirmAdminPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                        title={showConfirmAdminPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-105 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> Enroll Administrator
                </button>
              </form>
            ) : (
              /* Login Admin form */
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={e => setAdminUsername(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 font-medium outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Password Key
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        className="w-full text-sm pl-4 pr-11 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 font-medium outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                        title={showAdminPassword ? "Hide password" : "Show password"}
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-105 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Verify Academic Credentials
                </button>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed text-center font-medium">
                  Default Access Keys: <br />
                  Username: <strong className="font-mono text-slate-800">admin</strong> · Password: <strong className="font-mono text-slate-800">password</strong>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
