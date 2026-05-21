import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, UserCheck, CheckCircle, Smartphone, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../types';
import { addStudent, getStudents } from '../lib/db';
import { processCanvasToVector, drawVectorToCanvas, isFacePresent } from '../lib/faceMath';

interface StudentRegisterProps {
  onSuccess: (student: Student) => void;
  onCancel: () => void;
}

const GESTURE_INSTRUCTIONS = [
  'Center your face in the camera frame',
  'Tilt your head slightly to the left',
  'Tilt your head slightly to the right',
  'Give a gentle smile',
  'Neutral expression (look straight ahead)'
];

export default function StudentRegister({ onSuccess, onCancel }: StudentRegisterProps) {
  const [name, setName] = useState('');
  const [matricNo, setMatricNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [college, setCollege] = useState('College of Science and Technology');
  const [hall, setHall] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Face capture states
  const [captures, setCaptures] = useState<number[][]>([]);
  const [captureStep, setCaptureStep] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMess, setErrorMess] = useState<string | null>(null);
  const [autoEnroll, setAutoEnroll] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

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
          console.error("Error playing registration video:", err);
        });
      }
    }
    return () => {
      active = false;
    };
  }, [cameraActive, stream]);

  // Handle auto capture countdown sequence
  useEffect(() => {
    let timerId: any = null;
    
    // Only run if camera is on, auto-enroll mode is enabled, and we still need captures
    if (cameraActive && autoEnroll && captures.length < 5) {
      if (countdown === null) {
        // Wait 2.2 seconds between steps, allowing enough time for reading poses
        timerId = setTimeout(() => {
          setCountdown(3);
        }, 1600);
      } else if (countdown > 0) {
        timerId = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
      } else if (countdown === 0) {
        // Flash screen and trigger snap shot
        setIsFlashing(true);
        setTimeout(() => {
          setIsFlashing(false);
          handleCapture();
          setCountdown(null);
        }, 200);
      }
    } else {
      setCountdown(null);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [cameraActive, autoEnroll, countdown, captures.length]);

  const startCamera = async () => {
    setErrorMess(null);
    setCountdown(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      setErrorMess('Could not access front camera. Please check browser permissions.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setCountdown(null);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.paused) {
      setErrorMess('Webcam stream is warming up. Please wait and try capturing in a second.');
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to 32x32 grayscale vector
    const faceVector = processCanvasToVector(canvas);

    // Validate face presence in registration frames
    const faceCheck = isFacePresent(faceVector);
    if (!faceCheck.present) {
      setErrorMess(`Capture step paused: ${faceCheck.reason}`);
      return;
    }
    
    // Clear any temporary pose errors if validation succeeds
    setErrorMess(null);

    setCaptures(prev => {
      const updated = [...prev, faceVector];
      if (updated.length >= 5) {
        stopCamera();
      }
      return updated;
    });

    setCaptureStep(prev => (prev < 4 ? prev + 1 : prev));
  };

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess(null);

    if (!name.trim()) {
      setErrorMess('Please provide the student’s full name.');
      return;
    }
    if (!matricNo.trim()) {
      setErrorMess('Please provide the matriculation number.');
      return;
    }
    if (!regNo.trim()) {
      setErrorMess('Please provide the registration number.');
      return;
    }
    if (!college.trim()) {
      setErrorMess('Please select a college.');
      return;
    }
    if (!hall.trim()) {
      setErrorMess('Please provide the hall name.');
      return;
    }
    if (!department.trim()) {
      setErrorMess('Please provide the department name.');
      return;
    }
    if (!password) {
      setErrorMess('Please provide a secure account login password.');
      return;
    }
    if (password.length < 4) {
      setErrorMess('Academic secure passcode must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMess('Passwords do not match. Please verify both password entries.');
      return;
    }
    if (captures.length < 5) {
      setErrorMess(`Capture vector training profiles first (${captures.length}/5 photos taken).`);
      return;
    }

    const studentId = matricNo.trim().toUpperCase();

    // Check for ID duplicates
    const existing = getStudents();
    if (existing.some(s => s.studentId.toLowerCase() === studentId.toLowerCase().trim())) {
      setErrorMess('This matriculation number is already enrolled in the system.');
      return;
    }

    const newStudent: Student = {
      id: `student_${Date.now()}`,
      name: name.trim(),
      studentId,
      matricNo: matricNo.trim().toUpperCase(),
      regNo: regNo.trim().toUpperCase(),
      college,
      hall: hall.trim(),
      department: department.trim(),
      passwordKey: password,
      faceVectors: captures,
      enrolledAt: new Date().toISOString(),
    };

    // Save student to DB and retrain models
    addStudent(newStudent);
    onSuccess(newStudent);
  };

  const resetCaptures = () => {
    setCaptures([]);
    setCaptureStep(0);
    startCamera();
  };

  return (
    <div id="register-container" className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-3xl border border-slate-202 shadow-md">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/50">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Enroll New Student Profile</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">Create Account & Eigenface Pattern Calibration</p>
        </div>
      </div>

      {errorMess && (
        <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs rounded-xl mb-4 font-medium">
          {errorMess}
        </div>
      )}

      <form onSubmit={handleEnroll} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Hopper"
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Matriculation Number
            </label>
            <input
              type="text"
              required
              value={matricNo}
              onChange={e => setMatricNo(e.target.value)}
              placeholder="e.g. 20/1234"
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Registration Number
            </label>
            <input
              type="text"
              required
              value={regNo}
              onChange={e => setRegNo(e.target.value)}
              placeholder="e.g. REG-2026-9582"
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              College
            </label>
            <select
              value={college}
              onChange={e => setCollege(e.target.value)}
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 bg-white outline-none transition-all font-medium cursor-pointer"
            >
              <option value="College of Science and Technology">College of Science and Technology</option>
              <option value="College of Engineering">College of Engineering</option>
              <option value="College of Management and Social Science">College of Management and Social Science</option>
              <option value="College of Leadership and Development Studies">College of Leadership and Development Studies</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Hall of Residence
            </label>
            <input
              type="text"
              required
              value={hall}
              onChange={e => setHall(e.target.value)}
              placeholder="e.g. Esther Hall"
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Create Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm pl-4 pr-11 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm pl-4 pr-11 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-slate-800 outline-none transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 cursor-pointer select-none focus:outline-none"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live Facial Capture Section (Bento Style) */}
        <div className="border border-slate-200 rounded-2xl bg-indigo-50/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Enroll PCA-LDA Biometrics ({captures.length}/5 Captured)
            </h3>
            {!cameraActive && captures.length < 5 && (
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl hover:bg-indigo-100/80 cursor-pointer border border-indigo-100/55 transition-colors select-none"
              >
                <Camera className="w-3.5 h-3.5" /> Start Camera
              </button>
            )}
            {captures.length === 5 && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-150">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Core Calibration Ready
              </span>
            )}
          </div>

          {cameraActive && captures.length < 5 && (
            <div className="flex flex-col items-center gap-4">
              {/* Instructions dynamic info */}
              <div className="w-full bg-indigo-50 p-4 rounded-xl text-center border-l-4 border-indigo-600">
                <p className="text-[11px] font-bold text-indigo-850 uppercase tracking-wider font-mono">
                  Step {captures.length + 1} of 5 Calibration:
                </p>
                <p className="text-xs text-indigo-905 mt-1 font-bold">
                  "{GESTURE_INSTRUCTIONS[captureStep]}"
                </p>
              </div>

              {/* Video with auto/countdown overlay */}
              <div className="relative border-4 border-slate-900 rounded-2xl overflow-hidden aspect-[4/3] w-64 bg-black shadow-lg">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover scale-x-[-1]"
                  playsInline
                  muted
                />
                
                {/* Facial overlay guidelines */}
                <div className="absolute inset-0 border-[1.5px] border-dashed border-white/40 rounded-full m-8 pointer-events-none flex items-center justify-center animate-pulse">
                  <div className="w-2.5 h-2.5 bg-indigo-500/60 rounded-full"></div>
                </div>

                {/* Laser scan animation line */}
                {autoEnroll && (
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_#6366f1] z-10 pointer-events-none"
                  />
                )}

                {/* Camera snapshot flash effect */}
                <AnimatePresence>
                  {isFlashing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white z-40 pointer-events-none flex items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1.2 }}
                        className="text-indigo-600 font-bold font-mono text-sm"
                      >
                        SNAP!
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Big bold dynamic countdown overlay */}
                {autoEnroll && countdown !== null && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[1px] z-20">
                    <motion.span
                      key={countdown}
                      initial={{ scale: 2.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      className="text-4xl font-extrabold font-mono text-white tracking-widest bg-indigo-650/80 px-5 py-3 rounded-2xl shadow-lg border border-indigo-400"
                    >
                      {countdown === 0 ? "HOLD!" : countdown}
                    </motion.span>
                    <span className="text-[9px] text-indigo-200 mt-2.5 font-bold uppercase tracking-widest font-mono">
                      Auto Snapping Pose
                    </span>
                  </div>
                )}
              </div>

              {/* Control Trigger selection */}
              <div className="flex gap-2 w-full justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAutoEnroll(!autoEnroll);
                    setCountdown(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    autoEnroll 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${autoEnroll ? 'bg-indigo-600 animate-pulse' : 'bg-slate-400'}`} />
                  Auto Enroll: {autoEnroll ? "ON" : "OFF"}
                </button>

                {!autoEnroll ? (
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 cursor-pointer transition-all active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-100" /> Snap Pose {captures.length + 1}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Pause Lens
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Offscreen hidden elements holding canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Captured Samples previews thumbnails */}
          {captures.length > 0 && (
            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-mono">Training Image Matrices (32×32 Pixel vectors):</span>
              <div className="flex items-center gap-2 flex-wrap">
                {captures.map((cap, idx) => {
                  return (
                    <div key={idx} className="relative border border-slate-200 rounded-xl p-1 bg-white shadow-xs">
                      <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-indigo-600 text-white font-mono text-[7px] font-bold rounded-full border border-white">
                        S{idx + 1}
                      </div>
                      {/* Render captured grayscale vector mini */}
                      <GridFaceThumbnail vector={cap} />
                    </div>
                  );
                })}
                {captures.length > 0 && (
                  <button
                    type="button"
                    onClick={resetCaptures}
                    className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-600 border border-slate-202 px-3 py-1.8 rounded-xl bg-white hover:bg-slate-50 cursor-pointer h-fit ml-auto transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" /> Re-record
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={captures.length < 5}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all ${
              captures.length === 5
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 font-semibold'
                : 'bg-slate-105 text-slate-350 cursor-not-allowed border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Save Enrollment & Process
          </button>
        </div>
      </form>
    </div>
  );
}

// Custom specialized micro renderer for 32x32 vectors in enrollment summary grid
function GridFaceThumbnail({ vector }: { vector: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && vector && vector.length === 1024) {
      drawVectorToCanvas(vector, canvasRef.current);
    }
  }, [vector]);

  return <canvas ref={canvasRef} className="w-8 h-8 rounded bg-slate-50" />;
}
