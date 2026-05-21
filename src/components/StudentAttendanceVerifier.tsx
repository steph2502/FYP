import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldAlert, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { Student, AttendanceRecord } from '../types';
import { getTrainedModel, addAttendanceRecord } from '../lib/db';
import { processCanvasToVector, recognizeFace, isFacePresent } from '../lib/faceMath';

interface StudentAttendanceVerifierProps {
  currentStudent: Student;
  onLoggedSuccess: (record: AttendanceRecord) => void;
}

export default function StudentAttendanceVerifier({
  currentStudent,
  onLoggedSuccess
}: StudentAttendanceVerifierProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [liveStatus, setLiveStatus] = useState<string>('Ready for live scanning...');
  
  // Recognition Result States
  const [pcaResult, setPcaResult] = useState<{ name: string; score: number; studentId: string } | null>(null);
  const [ldaResult, setLdaResult] = useState<{ name: string; score: number; studentId: string } | null>(null);
  const [successRecord, setSuccessRecord] = useState<AttendanceRecord | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clean stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Bind video stream once the conditionally rendered <video> element mounts
  useEffect(() => {
    let active = true;
    if (cameraActive && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
    }
    return () => {
      active = false;
    };
  }, [cameraActive, stream]);

  // Handle continuous live scanning
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    if (cameraActive && autoScan && !successRecord) {
      setLiveStatus('Aligning face for live validation...');
      timerId = setInterval(() => {
        if (active && !analyzing) {
          verifyFaceLog(true);
        }
      }, 750);
    }

    return () => {
      active = false;
      if (timerId) clearInterval(timerId);
    };
  }, [cameraActive, autoScan, successRecord, analyzing, currentStudent]);

  const startCamera = async () => {
    setVerificationError(null);
    setPcaResult(null);
    setLdaResult(null);
    setSuccessRecord(null);
    setLiveStatus('Initializing live sensor...');
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      setVerificationError('Webcam access was denied. Please allow camera permissions in your browser bar.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setLiveStatus('Ready for live scanning...');
  };

  const verifyFaceLog = async (isAuto = false) => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;

    setAnalyzing(true);
    if (!isAuto) {
      setVerificationError(null);
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.paused) {
      setAnalyzing(false);
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setAnalyzing(false);
      return;
    }

    // Step 1: Capture current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Step 2: Convert to 32x32 grayscale vector 
    const testVector = processCanvasToVector(canvas);

    // Filter out situations where there is no actual face showing (noise, covered lens, or empty scene)
    const faceCheck = isFacePresent(testVector);
    if (!faceCheck.present) {
      if (!isAuto) {
        setVerificationError(faceCheck.reason || 'No face detected in viewport.');
      } else {
        setLiveStatus(faceCheck.reason || 'Scanning... Align face in box');
      }
      setPcaResult(null);
      setLdaResult(null);
      setAnalyzing(false);
      return;
    }

    // Step 3: Get compiled PCA / LDA model space
    const model = getTrainedModel();
    if (!model) {
      if (!isAuto) {
        setVerificationError('Model is untrained. Please enroll index student datasets first.');
      } else {
        setLiveStatus('Error: Model is untrained. Please register first.');
      }
      setAnalyzing(false);
      return;
    }

    // Step 4: Run actual linear algebra similarity queries
    const matchPCA = recognizeFace(testVector, model, 'PCA');
    const matchLDA = recognizeFace(testVector, model, 'LDA');

    setPcaResult({
      studentId: matchPCA.closestStudentId,
      name: matchPCA.name,
      score: matchPCA.confidence,
    });

    setLdaResult({
      studentId: matchLDA.closestStudentId,
      name: matchLDA.name,
      score: matchLDA.confidence,
    });

    // Cross-match credentials against the currently logged-in student
    // Ensure either PCA or LDA verifies with a safe threshold confidence (e.g. 70%)
    const thresholdConfidence = 68;
    const isPcaMatched = matchPCA.closestStudentId === currentStudent.studentId && matchPCA.confidence >= thresholdConfidence;
    const isLdaMatched = matchLDA.closestStudentId === currentStudent.studentId && matchLDA.confidence >= thresholdConfidence;

    if (isPcaMatched || isLdaMatched) {
      // Success! Mark attendance
      const record: AttendanceRecord = {
        id: `att_${Date.now()}`,
        studentId: currentStudent.studentId,
        name: currentStudent.name,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Present',
        method: isLdaMatched ? 'LDA' : 'PCA',
        confidence: Math.max(matchPCA.confidence, matchLDA.confidence),
      };

      addAttendanceRecord(record);
      setSuccessRecord(record);
      setLiveStatus('Authenticated successfully! Attendance logged.');
      stopCamera();
      setTimeout(() => {
        onLoggedSuccess(record);
      }, 1500);
    } else {
      // Failure
      if (isAuto) {
        if (matchPCA.closestStudentId === 'UNKNOWN' && matchLDA.closestStudentId === 'UNKNOWN') {
          setLiveStatus('Scanning... Place face in correct position');
        } else {
          const maxConf = Math.max(matchPCA.confidence, matchLDA.confidence);
          if (matchLDA.closestStudentId === currentStudent.studentId || matchPCA.closestStudentId === currentStudent.studentId) {
            setLiveStatus(`Evaluating... Similarity match: ${maxConf}% (Need ${thresholdConfidence}%)`);
          } else {
            setLiveStatus(`Evaluating face... scanning patterns...`);
          }
        }
      } else {
        if (matchPCA.closestStudentId === 'UNKNOWN' && matchLDA.closestStudentId === 'UNKNOWN') {
          setVerificationError('No enrolled face coordinates located. Ensure your head is centralized.');
        } else {
          setVerificationError(
            `Face mismatch! Detected "${matchLDA.name}" instead of logged student "${currentStudent.name}". Proxy prevention triggered.`
          );
        }
      }
    }
    setAnalyzing(false);
  };

  return (
    <div id="attendance-verifier" className="bg-white border border-slate-202 rounded-3xl shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance Validation Terminal</h3>
          <p className="text-[11px] text-slate-500 font-mono mt-1">Biometric check for {currentStudent.studentId}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono px-2.5 py-1 rounded-full border border-indigo-100">
          <Cpu className="w-3.5 h-3.5 text-indigo-650 animate-pulse" /> Double Kernel
        </div>
      </div>

      {verificationError && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-start gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{verificationError}</span>
        </div>
      )}

      {successRecord && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <div>
            <p className="font-bold text-sm">Attendance Verified!</p>
            <p className="font-mono mt-1 text-[11px]">
              Logged present at {successRecord.time} with {successRecord.confidence}% confidence via {successRecord.method} Fisher Space.
            </p>
          </div>
        </div>
      )}

      {!cameraActive && !successRecord && (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
          <Camera className="w-10 h-10 text-slate-350 mb-2" />
          <p className="text-xs text-slate-650 font-medium mb-4 text-center max-w-sm">
            You must run webcam face comparison relative to your registered baseline model coordinates.
          </p>
          <button
            type="button"
            onClick={startCamera}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer"
          >
            Open Capture Camera
          </button>
        </div>
      )}

      {cameraActive && (
        <div className="flex flex-col items-center gap-5">
          {/* Dynamic scanning info block */}
          <div className="w-full bg-slate-900 border border-white/10 text-indigo-200 p-2.5 text-center rounded-xl font-mono text-[10px] flex items-center justify-between px-3 gap-2">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${autoScan ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`} />
              {autoScan ? 'AUTO-SCAN SENSOR ACTIVE' : 'MANUAL CAPTURE READY'}
            </span>
            <span className="text-white/80 select-none max-w-[150px] truncate">{liveStatus}</span>
          </div>

          <div className="relative border-4 border-slate-900 rounded-2xl overflow-hidden aspect-[4/3] w-64 bg-black shadow-lg">
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
            />
            {/* Pulsing scanning line Sweeper via motion */}
            {autoScan && (
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] z-10 pointer-events-none"
              />
            )}
            
            {/* Visual crop border */}
            <div className="absolute inset-0 border-2 border-emerald-500/50 m-12 rounded pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-500"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-500"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-500"></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-500"></div>
            </div>
          </div>

          <div className="flex gap-2 w-full justify-center">
            {/* Auto/Manual Mode Selector Toggle */}
            <button
              type="button"
              onClick={() => setAutoScan(!autoScan)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer select-none ${
                autoScan 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-650'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autoScan ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
              Auto Scan: {autoScan ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
            >
              Close Lens
            </button>
            
            {!autoScan && (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => verifyFaceLog(false)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 relative shadow-sm transition-all cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-200" /> Verifying...
                  </>
                ) : (
                  <>
                    <Camera className="w-3 h-3 text-indigo-100" /> Capture
                  </>
                )}
              </button>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Numerical linear algebra matching metrics diagnostics (Bento Sub-Widget) */}
      {(pcaResult || ldaResult) && (
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
            <Eye className="w-4 h-4 text-indigo-500 animate-pulse" /> Projection Space Similarity diagnostics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className={`p-4 rounded-xl border bg-white ${pcaResult?.studentId === currentStudent.studentId ? 'border-indigo-100 ring-4 ring-indigo-500/5' : 'border-slate-150'}`}>
              <p className="font-bold text-indigo-600 font-mono text-[9px] uppercase tracking-wider">PCA (Eigenfaces)</p>
              <div className="mt-2 space-y-2">
                <p className="text-slate-500 text-[10.5px]">Identified: <span className="font-bold text-slate-950">{pcaResult?.name}</span></p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-[11px] font-bold text-slate-900">{pcaResult?.score}% match</span>
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${pcaResult?.score}%` }} className="bg-indigo-600 h-full rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border bg-white ${ldaResult?.studentId === currentStudent.studentId ? 'border-emerald-100 ring-4 ring-emerald-500/5' : 'border-slate-150'}`}>
              <p className="font-bold text-emerald-600 font-mono text-[9px] uppercase tracking-wider">LDA (Fisherfaces)</p>
              <div className="mt-2 space-y-2">
                <p className="text-slate-500 text-[10.5px]">Identified: <span className="font-bold text-slate-950">{ldaResult?.name}</span></p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-[11px] font-bold text-slate-900">{ldaResult?.score}% match</span>
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${ldaResult?.score}%` }} className="bg-emerald-550 h-full rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
