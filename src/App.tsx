/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Student } from './types';
import { initializeDB, getTrainedModel, subscribeToDb, isMongoConnected, isUsingMemory, dbLoading } from './lib/db';
import AuthView from './components/AuthView';
import StudentDashboard from './components/StudentDashboard';
import AdminPanel from './components/AdminPanel';
import LinearAlgebraInspector from './components/LinearAlgebraInspector';
import { BookOpen, LogOut, Code, ShieldAlert, CheckCircle2, ChevronRight, Activity, Cpu, Database, Key, ArrowRight, X } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{
    role: 'anonymous' | 'student' | 'admin';
    studentData?: Student;
  }>({ role: 'anonymous' });

  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const [showMongoGuide, setShowMongoGuide] = useState(false);
  const [dbDiagnostics, setDbDiagnostics] = useState<{
    connected?: boolean;
    provider?: string;
    hasUri?: boolean;
    error?: string | null;
    uriMasked?: string | null;
  } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      setTestingConnection(true);
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbDiagnostics(data);
      }
    } catch (e) {
      console.error("Failed to retrieve connection diagnostics:", e);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRetryConnection = async () => {
    setTestingConnection(true);
    await initializeDB();
    await fetchDiagnostics();
    setTestingConnection(false);
    triggerAdminRefresh();
  };

  useEffect(() => {
    if (showMongoGuide) {
      fetchDiagnostics();
    }
  }, [showMongoGuide]);

  const triggerAdminRefresh = () => {
    setAdminRefreshKey(prev => prev + 1);
  };

  // Load database state and subscribe to changes from the backend
  useEffect(() => {
    initializeDB();
    const unsubscribe = subscribeToDb(() => {
      // Trigger a state change to refresh all sub-panels with synced-in data
      setAdminRefreshKey(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  const handleLogin = (userSession: { role: 'student' | 'admin'; studentData?: Student }) => {
    setCurrentUser({
      role: userSession.role,
      studentData: userSession.studentData
    });
  };

  const handleLogout = () => {
    setCurrentUser({ role: 'anonymous' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-800 p-4 md:p-6 lg:p-8">
      {/* Bento Grid Header Section */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Cpu className="w-5 h-5 text-indigo-100 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              FaceAttend <span className="text-slate-400 font-normal">v1.2</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              PCA & LDA Eigenface Recognition System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {dbLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100 text-xs font-semibold font-mono animate-pulse">
              <span className="w-2.5 h-2.5 bg-amber-400 rounded-full"></span> Connecting DB...
            </div>
          ) : isMongoConnected ? (
            <button
              type="button"
              onClick={() => setShowMongoGuide(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-full border border-emerald-100 hover:border-emerald-200 text-xs font-semibold font-mono cursor-pointer transition-all"
              title="Click to view Database Connection Details"
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span> MongoDB Persistent (Click for Info)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMongoGuide(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-full border border-rose-100 hover:border-rose-200 text-xs font-semibold font-mono cursor-pointer transition-all"
              title="Click to view setup and persistence guide"
            >
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> In-Memory Sandbox (Click to Connect)
            </button>
          )}

          {currentUser.role !== 'anonymous' && (
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer animate-in fade-in"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-300" /> portal.exit()
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main key={adminRefreshKey} className="max-w-7xl mx-auto">
        {showMongoGuide && (
          <div className="mb-6 p-6 md:p-8 bg-white rounded-3xl border border-indigo-100 shadow-md relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Top decorative badge */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 -z-0 opacity-50"></div>
            
            <button
              onClick={() => setShowMongoGuide(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full cursor-pointer transition-all z-20"
              title="Close Guide"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md animate-pulse">
                  <Database className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Active Database Settings & Diagnostics</h3>
                  <p className="text-xs text-slate-500 font-mono">Live synchronization monitoring system (MongoDB Atlas)</p>
                </div>
              </div>

              {/* --- REAL-TIME SERVER CONNECTION DIAGNOSTICS --- */}
              <div className="mb-6 p-5 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-inner font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isMongoConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'}`}></span>
                    <span className="font-bold text-slate-200">
                      Connection Status: {isMongoConnected ? 'ONLINE (MongoDB Connected)' : 'OFFLINE (Temporary In-Memory Sandbox)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryConnection}
                    disabled={testingConnection}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {testingConnection ? 'Testing...' : '🔄 Re-Test Connection'}
                  </button>
                </div>

                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">DATABASE PROVIDER: </span>
                      <span>{dbDiagnostics?.provider || 'Detecting...'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">URI LOADED: </span>
                      <span className={dbDiagnostics?.hasUri ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {dbDiagnostics?.hasUri ? "YES (MONGODB_URI detected)" : "NO (MONGODB_URI is undefined / empty)"}
                      </span>
                    </div>
                  </div>

                  {dbDiagnostics?.uriMasked && (
                    <div className="pt-1.5 border-t border-slate-800">
                      <span className="text-slate-500">CONNECTION ENDPOINT: </span>
                      <span className="text-slate-300 break-all select-all bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/60 inline-block font-sans text-[10.5px]">{dbDiagnostics.uriMasked}</span>
                    </div>
                  )}

                  {dbDiagnostics?.error ? (
                    <div className="mt-3 p-3.5 bg-rose-950/40 border border-rose-900/30 rounded-xl text-rose-300 font-sans leading-relaxed">
                      <strong className="font-mono text-[10px] uppercase text-rose-400 block mb-1">🔴 Latest Server Connection Exception:</strong>
                      <div className="font-mono text-[11px] bg-rose-950 px-2 py-1.5 rounded border border-rose-900/50 break-all max-h-24 overflow-y-auto">
                        {dbDiagnostics.error}
                      </div>
                      <div className="text-[11px] text-slate-300 space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-rose-900/45">
                        <span className="font-bold text-amber-300 block mb-0.5">💡 Setup Guide Checkpoints:</span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          <li><strong>Credentials Matching:</strong> Check database username and password inside the MONGODB_URI variable under the Settings menu gear tab.</li>
                          <li><strong>Special Characters:</strong> If password has symbols (e.g., <code className="bg-slate-900 px-1 text-yellow-300">@</code> or <code className="bg-slate-900 px-1 text-yellow-300">/</code>), you must URL-encode them.</li>
                          <li><strong>IP Whitelist Rule:</strong> Inside MongoDB Atlas, click <strong className="text-slate-200">Network Access</strong> and add <code className="bg-slate-800 px-1 text-slate-300">0.0.0.0/0</code> (Allow Access from Anywhere) as AI Studio containers run on dynamic server IPs.</li>
                        </ul>
                      </div>
                    </div>
                  ) : isMongoConnected ? (
                    <div className="mt-3 p-3.5 bg-emerald-950/40 border border-emerald-900/30 rounded-xl text-emerald-300 font-sans">
                      🎉 <strong>Success!</strong> Backend is beautifully synced to your remote MongoDB Database Atlas. All student registrations and attendance lists are secured and perpetual.
                    </div>
                  ) : (
                    <div className="mt-3 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl font-sans">
                      ⚠️ <strong>Cluster Not Synced:</strong> Key has not been specified yet or contains authorization errors. Check steps below to obtain a connection string.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 text-sm text-slate-700 leading-relaxed font-sans">
                ⚠️ <strong className="text-rose-600">Why are you seeing Offline/Temporary Mode?</strong> By default, this application stores registrations and attendance in server memory. When hosted on serverless platforms,/the backend container periodically restarts, wiping out all temporary memory list data. Adding a <strong>MongoDB URI</strong> links your applet to a persistent cloud database, ensuring zero data loss and multi-user synchronization!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Steps left */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-500" /> Step 1: Obtain a Free MongoDB Connection URI
                  </h4>
                  <ol className="text-xs text-slate-600 space-y-2.5 font-sans leading-relaxed list-decimal list-inside pl-1">
                    <li>Sign up or log in to <a href="https://www.mongodb.com/cloud/atlas" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">MongoDB Atlas</a> and create a free shared database cluster.</li>
                    <li>Inside your dashboard, click the <strong className="text-slate-800">Connect</strong> button on your cluster.</li>
                    <li>Select <strong className="text-slate-800">Drivers</strong> (Node.js) to copy your connection string format.</li>
                    <li>Replace <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[11px]">&lt;password&gt;</code> inside the string with your database authorized user password.</li>
                  </ol>

                  <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                    <span className="text-slate-500">// Example connection string template</span>
                    <br />
                    MONGODB_URI="mongodb+srv://admin:&lt;password&gt;@cluster0.abcde.mongodb.net/attendance_db?retryWrites=true&amp;w=majority"
                  </div>
                </div>

                {/* Steps right */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" /> Step 2: Inject Env Variable to Platform
                  </h4>

                  <div className="space-y-4 font-sans">
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <h5 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                        On this AI Studio Workspace (Local Dev)
                      </h5>
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                        Go to the <strong>Settings</strong> gear icon in the top header menu, add your <code className="font-mono bg-slate-100 px-1">MONGODB_URI</code> key value, and click <strong>Save Changes</strong>. The server will dynamically verify, connect, and reboot securely!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMongoGuide(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Close Diagnostic Info
                </button>
              </div>
            </div>
          </div>
        )}

        {currentUser.role === 'anonymous' && (
          <div className="space-y-6">
            <AuthView onLoginSuccess={handleLogin} />

            {/* Academic Outline Footer */}
            <div className="max-w-md mx-auto p-4 bg-slate-100 rounded-xl border text-[11px] text-slate-500 leading-relaxed text-center font-mono">
              <strong>Grading Note:</strong> To inspect mathematical decompositions, eigenvalues spectrum, and covariance matrices, login as <strong>Admin</strong>. To test the biometrics live verification process, register a student face or login using one of our pre-packaged dataset profiles (e.g., Ada Lovelace).
            </div>
          </div>
        )}

        {currentUser.role === 'student' && currentUser.studentData && (
          <div className="space-y-6">
            {/* Breadcrumb row */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span>Portal</span>
              <ChevronRight className="w-3 h-3" />
              <span>Student Area</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-medium">{currentUser.studentData.name}</span>
            </div>

            <StudentDashboard
              student={currentUser.studentData}
              onLogout={handleLogout}
            />
          </div>
        )}

        {currentUser.role === 'admin' && (
          <div key={adminRefreshKey} className="space-y-8">
            {/* Breadcrumb row */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span>Portal</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-medium">Administrator Console</span>
            </div>

            <div className="border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Academic Administrator Console</h2>
              <p className="text-xs text-slate-500 font-mono">Global monitoring workspace for class training sets & attendance registries</p>
            </div>

            {/* Admin Overview list / downloads */}
            <AdminPanel onRefresh={triggerAdminRefresh} />

            {/* Linear Algebra Diagnostic Workspace */}
            <LinearAlgebraInspector />
          </div>
        )}
      </main>

      {/* Global Academic Footing */}
      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-8 border-t border-slate-100 mt-12 text-center text-[11px] text-slate-400 font-mono space-y-2">
        <p>© 2026 Academic Face Recognition Project. Calculated via Grayscale pixel array vectors.</p>
        <p className="text-[10px] text-slate-300">
          Covariance eigenvectors resolved dynamically via real-time Jacobi Cyclic Rotations.
        </p>
      </footer>
    </div>
  );
}
