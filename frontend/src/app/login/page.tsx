"use client";

import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

import { useState, useEffect, useRef } from "react";
import { Turnstile } from '@marsidev/react-turnstile';
// For navigation after login (if needed)
import { useRouter } from "next/navigation";
import { FaLock, FaEnvelope, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import {
  GraduationCap,
  Users,
  Crown,
  Shield,
  User,
  Mail,
  CheckCircle,
  Clock,
  AlertCircle,
  Wallet,
  UserCheck,
  ClipboardCheck,
  X,
  RefreshCw
} from "lucide-react";
import { loginWithEmailPassword, ApiError, sendForgotPasswordOTP, verifyForgotPasswordOTP, resetPasswordWithOTP, fetchSystemVersion } from "@/lib/api";
import { parseApiError, isAuthError } from "@/lib/error-handling";
import { PasswordChangeModal } from "@/components/auth/PasswordChangeModal";
import { StudentFirstLoginModal } from "@/components/auth/StudentFirstLoginModal";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";


type Teacher = {
  id: string;
  name: string;
  username: string;
  password: string;
  class: string;
};

type ForgotPasswordStep = 'employee-code' | 'otp-verify' | 'password-reset' | 'success';

export default function LoginPage() {
  const [detectedRole, setDetectedRole] = useState<string>("");
  const [animate, setAnimate] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const turnstileRef = useRef<any>(null);
  const router = useRouter();

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);
  const [teacherInfo, setTeacherInfo] = useState<Teacher | null>(null);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showStudentFirstLoginModal, setShowStudentFirstLoginModal] = useState(false);
  const [studentChangeSessionToken, setStudentChangeSessionToken] = useState('');

  // System version
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemVersion().then(v => {
      if (v?.display) setAppVersion(v.display);
    });
  }, []);

  // Forgot Password States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>('employee-code');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Empowering Education",
      desc: "Streamline operations, enhance learning, and build a brighter future for every student.",
      icon: <Shield className="w-6 h-6 text-[#3b82f6]" />,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100"
    },
    {
      title: "Advanced Analytics",
      desc: "Gain deep insights into student performance with real-time data and intelligent reporting.",
      icon: <Users className="w-6 h-6 text-indigo-600" />,
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-100"
    },
    {
      title: "Seamless Management",
      desc: "Effortlessly manage attendance, grades, and communication in one unified platform.",
      icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-100"
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);

    if (typeof window !== 'undefined') {
      // Always clear ALL session data when login page is visited
      // This prevents old user's data from persisting after logout
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = 'sis_access_token=; path=/; max-age=0';
      document.cookie = 'sis_refresh_token=; path=/; max-age=0';
    }

    return () => clearTimeout(timer);
  }, []);

  // OTP Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (forgotStep === 'otp-verify' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [forgotStep, timeLeft]);

  // Carousel Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Function to get role-specific icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Teacher': return <GraduationCap className="h-5 w-5" />;
      case 'Coordinator': return <Users className="h-5 w-5" />;
      case 'Principal': return <Crown className="h-5 w-5" />;
      case 'Super Admin': return <Shield className="h-5 w-5" />;
      case 'Org Admin': return <Shield className="h-5 w-5 text-blue-500" />;
      case 'Accounts Officer': 
      case 'Accountant': return <Wallet className="h-5 w-5" />;
      case 'Admissions Counselor': 
      case 'Receptionist': return <UserCheck className="h-5 w-5" />;
      case 'Compliance Officer': 
      case 'Auditor': return <ClipboardCheck className="h-5 w-5" />;
      case 'Donor': return <User className="h-5 w-5" />;
      default: return <User className="h-5 w-5" />;
    }
  };

  // Function to detect role from employee code
  const detectRoleFromCode = (code: string): string => {
    if (!code) return "";

    // Employee code patterns:
    // Teacher: C01-M-25-T-0000
    // Coordinator: C01-M-25-C-0000  
    // Principal: C01-M-25-P-0000
    // Superadmin: S-25-0001 (NEW FORMAT - campus independent)
    // Org Admin: OA-25-0001
    // Accounts Officer: C01-M-25-AO-0001
    // Admissions Counselor: C01-M-25-AC-0001
    // Compliance Officer: C01-M-25-CO-0001

    // Check for super admin format (S-25-0001) or Org Admin (OA-25-0001)
    const upperCode = code.toUpperCase();
    if (upperCode.startsWith('S-') && upperCode.split('-').length === 3) {
      return 'Super Admin';
    }
    if (upperCode.startsWith('OA-') && upperCode.split('-').length === 3) {
      return 'Org Admin';
    }

    // Check for Donor format (Starts with D)
    if (upperCode.startsWith('D')) {
      return 'Donor';
    }

    // Check for campus-based format (C01-M-25-X-0000)
    const parts = upperCode.split('-');
    if (parts.length >= 4) {
      const roleCode = parts[3]; // Take full part (T, C, P, AO, AC, CO)
      switch (roleCode) {
        case 'T': return 'Teacher';
        case 'C': return 'Coordinator';
        case 'P': return 'Principal';
        case 'AO': return 'Accountant';
        case 'AC': return 'Receptionist';
        case 'CO': return 'Auditor';
        case 'S': return 'Super Admin'; // Legacy format
        default: return '';
      }
    }
    return '';
  };

  // Format employee code (no auto dashes, just preserve input)
  const formatEmployeeCode = (value: string): string => {
    // We no longer apply automatic formatting or forced uppercase
    return value;
  };

  // Handle employee code input change
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setId(inputValue);
    
    // Role detection still works but is now case-insensitive
    const role = detectRoleFromCode(inputValue);
    setDetectedRole(role);
  };

  // Format time for OTP timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Forgot Password Handlers
  const handleSendOTP = async () => {
    if (!forgotEmail.trim()) {
      setError({
        title: "Email Required",
        message: "Please enter your email address",
        type: "error"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      setError({
        title: "Invalid Email",
        message: "Please enter a valid email address",
        type: "error"
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendForgotPasswordOTP(forgotEmail.trim());
      setForgotStep('otp-verify');
      setTimeLeft(300);
      setCanResend(false);
      setError({
        title: "Success",
        message: "OTP sent successfully to your email",
        type: "success"
      });
    } catch (err: any) {
      setError({
        title: "Error",
        message: err.message || 'Failed to send OTP. Please try again.',
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      setError({
        title: "OTP Required",
        message: "Please enter the OTP code",
        type: "error"
      });
      return;
    }

    if (otpCode.trim().length !== 6) {
      setError({
        title: "Invalid OTP",
        message: "Please enter a valid 6-digit OTP code",
        type: "error"
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await verifyForgotPasswordOTP(forgotEmail.trim(), otpCode.trim());
      if (response.valid) {
        setSessionToken(response.session_token);
        setForgotStep('password-reset');
        setError({
          title: "Success",
          message: "OTP verified successfully",
          type: "success"
        });
      } else {
        setError({
          title: "Invalid OTP",
          message: response.message || 'Invalid OTP code',
          type: "error"
        });
      }
    } catch (err: any) {
      setError({
        title: "Error",
        message: err.message || 'Failed to verify OTP. Please try again.',
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError({
        title: "Password Required",
        message: "Please enter a new password",
        type: "error"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError({
        title: "Password Mismatch",
        message: "Passwords do not match",
        type: "error"
      });
      return;
    }

    if (newPassword.length < 8) {
      setError({
        title: "Weak Password",
        message: "Password must be at least 8 characters long",
        type: "error"
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPasswordWithOTP(sessionToken, newPassword, confirmPassword);
      setForgotStep('success');
      setError({
        title: "Success",
        message: "Password reset successfully! You can now login with your new password.",
        type: "success"
      });
    } catch (err: any) {
      setError({
        title: "Error",
        message: err.message || 'Failed to reset password. Please try again.',
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      await sendForgotPasswordOTP(forgotEmail.trim());
      setTimeLeft(300);
      setCanResend(false);
      setError({
        title: "Success",
        message: "OTP resent successfully",
        type: "success"
      });
    } catch (err: any) {
      setError({
        title: "Error",
        message: err.message || 'Failed to resend OTP. Please try again.',
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotStep('employee-code');
    setForgotEmail('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setSessionToken('');
    setError(null);
    setTimeLeft(0);
    setCanResend(false);
  };

  // Render Forgot Password Form based on step
  const renderForgotPasswordForm = () => {
    switch (forgotStep) {
      case 'employee-code':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500">
            <div className="text-left mb-6">
              <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight mb-2">Reset Password</h2>
              <p className="text-[#6b7280] font-medium text-sm">
                Enter your email to receive a verification code
              </p>
            </div>

            <div className="space-y-4">
              {/* Error Display */}
              {error && (
                <div className={`border-2 rounded-xl p-4 flex items-start gap-3 ${error.type === 'success'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                  }`}>
                  {error.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${error.type === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}>{error.message}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className={`transition-colors cursor-pointer ${error.type === 'success'
                      ? 'text-green-400 hover:text-green-600'
                      : 'text-red-400 hover:text-red-600'
                      }`}
                    aria-label="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-bold text-[#374151] ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors group-focus-within:text-[#3b82f6]">
                    <FaEnvelope size={18} />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl pl-12 pr-4 text-[#111827] font-semibold transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:font-normal"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <button
                onClick={handleSendOTP}
                disabled={loading || !forgotEmail.trim()}
                className="w-full h-14 bg-[#6096ba] hover:bg-[#4a7ba0] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(96,150,186,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-lg cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : 'Send Verification Code'}
              </button>

              {/* Back to Login Button */}
              <div className="text-center pt-2">
                <button
                  onClick={handleBackToLogin}
                  className="text-sm font-extrabold text-[#6096ba] hover:text-[#4a7ba0] transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        );

      case 'otp-verify':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500 antialiased">
            <div className="text-left mb-6">
              <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight mb-2">Verification</h2>
              <p className="text-[#6b7280] font-medium text-sm">
                We've sent a 6-digit code to your email
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="otp-code" className="text-sm font-bold text-[#374151] ml-1">
                  Verification Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl text-[#111827] text-3xl text-center font-black tracking-[0.5em] transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:text-base placeholder:tracking-normal placeholder:font-normal"
                  disabled={loading}
                />
              </div>

              {timeLeft > 0 && (
                <div className="text-center text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg py-2 px-4 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-[#3b82f6]" />
                  <span>Code expires in <span className="font-semibold text-[#111827]">{formatTime(timeLeft)}</span></span>
                </div>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={loading || !otpCode.trim() || otpCode.trim().length !== 6}
                className="w-full h-14 bg-[#6096ba] hover:bg-[#4a7ba0] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(96,150,186,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-lg cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : 'Verify Code'}
              </button>

              <button
                onClick={handleResendOTP}
                disabled={loading}
                className="w-full text-[#6096ba] hover:text-[#4a7ba0] text-sm font-extrabold hover:bg-blue-50 py-2 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                Resend Code
              </button>

              {/* Back to Login Button */}
              <div className="text-center pt-2">
                <button
                  onClick={handleBackToLogin}
                  className="text-sm font-extrabold text-[#6096ba] hover:text-[#4a7ba0] transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        );

      case 'password-reset':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-500">
            <div className="text-left mb-6">
              <h2 className="text-3xl font-extrabold text-[#111827] mb-2">New Password</h2>
              <p className="text-[#6b7280] font-medium">
                Create a strong password for your account
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-bold text-[#374151] ml-1">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors group-focus-within:text-[#3b82f6]">
                    <FaLock size={18} />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl pl-12 pr-4 text-[#111827] font-semibold transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:font-normal"
                    disabled={loading}
                    required
                  />
                </div>
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-bold text-[#374151] ml-1">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors group-focus-within:text-[#3b82f6]">
                    <FaLock size={18} />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl pl-12 pr-4 text-[#111827] font-semibold transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:font-normal"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading || !newPassword.trim() || !confirmPassword.trim()}
                className="w-full h-14 bg-[#6096ba] hover:bg-[#4a7ba0] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(96,150,186,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-lg cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : 'Reset Password'}
              </button>

              {/* Back to Login Button */}
              <div className="text-center pt-2">
                <button
                  onClick={handleBackToLogin}
                  className="text-sm font-extrabold text-[#6096ba] hover:text-[#4a7ba0] transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-500">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-4xl font-extrabold text-[#111827] mb-3">Success!</h2>
              <p className="text-[#6b7280] font-medium mb-8">
                Your password has been reset successfully. You can now login with your new password.
              </p>

              <button
                onClick={handleBackToLogin}
                className="w-full h-14 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(59,130,246,0.25)] transition-all active:scale-[0.98] cursor-pointer text-lg"
              >
                Back to Login
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Login handler: all roles use backend email/password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const email = id.trim();

      // Validate email OR ID/employee code format (case-insensitive for codes)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const isCode = /^[A-Za-z0-9-]+$/.test(email); // accepts student IDs and employee codes

      if (!isEmail && !isCode) {
        setError({
          title: "Invalid Input",
          message: "Please enter a valid email address or ID/employee code",
          type: "error"
        });
        setLoading(false);
        return;
      }

      // Validate password
      if (!password.trim()) {
        setError({
          title: "Password Required",
          message: "Please enter your password",
          type: "error"
        });
        setLoading(false);
        return;
      }

      if (!recaptchaToken) {
        setError({
          title: "reCAPTCHA Required",
          message: "Please complete the reCAPTCHA verification.",
          type: "error"
        });
        setLoading(false);
        return;
      }

      const data = await loginWithEmailPassword(email, password, recaptchaToken);

      // Check if password change is required
      if (data?.requires_password_change) {
        // Student: direct password change (no OTP)
        if (data?.requires_direct_change && data?.user_role === 'student') {
          setStudentChangeSessionToken(data.change_session_token);
          setShowStudentFirstLoginModal(true);
          return;
        }
        // Other roles: OTP-based password change
        setUserEmail(data.user_email);
        setShowPasswordChangeModal(true);
        return;
      }

      const userRole = String(data?.user?.role || "").toLowerCase();

      // Redirect based on role
      if (userRole === "student") {
        router.push("/student/dashboard");
      } else if (userRole === "accounts_officer") {
        router.push("/admin/fees");
      } else if (userRole.includes("coord")) {
        router.push("/admin/coordinator");
      } else if (userRole.includes("teach")) {
        router.push("/admin/students/student-list");
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Reset Turnstile so Sign In button re-enables immediately
      setRecaptchaToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();

      // Handle account lockout
      if (err instanceof ApiError && err.status === 429) {
        const seconds = err.response ? (() => { try { return JSON.parse(err.response).lockout_seconds || 900; } catch { return 900; } })() : 900;
        setLockoutSeconds(seconds);
        setError({
          title: "Account Locked",
          message: `Too many failed attempts. Account is locked.`,
          type: "error"
        });
      // Handle authentication errors specially
      } else if (err instanceof ApiError && err.status === 403) {
        setError({
          title: "Access Denied",
          message: err.message || "Your organization is inactive. Please contact your administrator.",
          type: "error"
        });
      } else if (err instanceof ApiError && err.status === 401) {
        const remaining = err.response ? (() => { try { return JSON.parse(err.response).attempts_remaining; } catch { return null; } })() : null;
        setError({
          title: "Authentication Failed",
          message: remaining != null
            ? `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`
            : "Invalid employee code or password. Please check your credentials and try again.",
          type: "error"
        });
      } else if (err instanceof ApiError && err.status === 400) {
        let message = "Invalid request. Please check your input.";
        try {
          const body = JSON.parse(err.response);
          const det = body?.error?.details;
          const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id.trim());
          if (det?.email?.[0]) message = isEmailInput
            ? "This email does not exist in our system."
            : "This employee code / ID does not exist in our system.";
          else if (det?.non_field_errors?.[0]) message = det.non_field_errors[0];
          else if (det && Object.keys(det).length > 0) {
            const v = det[Object.keys(det)[0]];
            message = Array.isArray(v) ? v[0] : String(v);
          } else if (body?.error?.message && body.error.message !== "Bad request.") {
            message = body.error.message;
          }
        } catch { /* keep default */ }
        setError({ title: "Login Failed", message, type: "error" });
      } else {
        const errorInfo = parseApiError(err);
        setError(errorInfo);
      }
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, show info (for demo)
  if (teacherInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="bg-white border rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold mb-4">Welcome, {teacherInfo.name}!</h2>
          <p className="mb-2">Role: Teacher</p>
          <p className="mb-2">Assigned Class: {teacherInfo.class}</p>
          <button className="mt-4 px-4 py-2 bg-[#a3cef1] rounded cursor-pointer" onClick={() => { setTeacherInfo(null); window.localStorage.removeItem("sis_user"); }}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white flex flex-col lg:flex-row ${montserrat.className} antialiased selection:bg-blue-100 selection:text-blue-900 overflow-hidden`}>
      {/* Student First Login Modal */}
      {showStudentFirstLoginModal && (
        <StudentFirstLoginModal
          sessionToken={studentChangeSessionToken}
          onComplete={() => {
            setShowStudentFirstLoginModal(false);
            setStudentChangeSessionToken('');
          }}
        />
      )}

      {/* Password Change Modal */}
      {showPasswordChangeModal && (
        <PasswordChangeModal
          userEmail={userEmail}
          onComplete={() => {
            setShowPasswordChangeModal(false);
            setUserEmail('');
            window.location.href = '/login';
          }}
          onError={(error) => {
            setError({
              title: "Password Change Error",
              message: error,
              type: "error"
            });
          }}
        />
      )}

      {/* LEFT SIDE: Branding & Illustration */}
      <div className="hidden lg:flex w-[60%] bg-[#fcfdfe] flex-col p-12 relative overflow-hidden">
        {/* Top Logo & Tagline */}
        <div className="flex flex-col mb-12">
          <img src="/Newton.png" alt="Newton Logo" className="h-14 w-auto object-contain self-start" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 ml-1">
            Academic Management System
          </span>
        </div>


        {/* Center Illustration */}
        <div className="flex-1 flex items-center justify-center relative -mt-12">
          <img 
            src="/login-page.png" 
            alt="Students Illustration" 
            className="w-[65%] h-auto object-contain z-10 -mt-8"
          />
          {/* Subtle background circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-slate-100 rounded-full blur-3xl opacity-50 -z-0" />
        </div>

        {/* Bottom Section: Carousel & Partner Logo */}
        <div className="mt-auto mb-10 flex items-center justify-between gap-12">
          {/* Carousel Section */}
          <div className="relative h-20 flex-1">
            {slides.map((slide, index) => (
              <div 
                key={index}
                className={`absolute inset-0 flex items-center gap-4 transition-all duration-1000 ease-in-out ${
                  index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                <div className={`w-12 h-12 ${slide.bgColor} rounded-2xl flex items-center justify-center shadow-sm border ${slide.borderColor} shrink-0`}>
                   {slide.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[#1e293b]">{slide.title}</span>
                  <p className="text-xs text-[#64748b] max-w-sm">{slide.desc}</p>
                </div>
              </div>
            ))}

            {/* Dots Indicator */}
            <div className="absolute -bottom-1 left-0 flex gap-2">
              {slides.map((_, index) => (
                <div 
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    index === currentSlide ? 'w-8 bg-[#6096ba]' : 'w-2 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Partner Branding Section */}
          <div className="flex items-center shrink-0 border-l border-slate-100 pl-8 gap-8">
            <div className="flex flex-col items-center gap-1">
              <img src="/foxit.png" alt="Foxit Tech" className="h-12 w-auto object-contain" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Powered By</span>
            </div>
            
            <div className="w-px h-10 bg-slate-100/80" />

            <div className="flex flex-col items-center gap-1">
              <img src="/ait-login.png" alt="Developed By AIT" className="h-12 w-auto object-contain" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Developed By</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Card Container with Glassmorphism */}
      <div className="flex-1 bg-[#f8fafc] flex items-center justify-center p-6 sm:p-12 relative">
        {/* Subtle decorative blob for glass effect contrast */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-100 rounded-full blur-[100px] opacity-60" />
        
        <div className={`w-full max-w-[500px] bg-white/50 backdrop-blur-[80px] rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-white/40 p-8 sm:p-12 relative z-10 transition-all duration-1000 ${animate ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
          
          <div className="grid grid-cols-1 grid-rows-1 items-center overflow-hidden">
            {/* Login Form Section */}
            <div className={`col-start-1 row-start-1 transition-all duration-500 ease-in-out ${showForgotPassword ? 'opacity-0 -translate-x-[120%] pointer-events-none' : 'opacity-100 translate-x-0'}`}>
            <div className="mb-6 text-left">
              <h1 className="text-3xl font-extrabold text-[#111827] mb-2 tracking-tight">Welcome Back!</h1>
              <p className="text-[#6b7280] font-medium text-sm">Sign in to continue to <span className="text-[#111827] font-bold">Newton AMS</span></p>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
                error.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {error.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{error.message}</p>
                  {lockoutSeconds > 0 && (
                    <p className="text-sm font-bold mt-1">
                      Try again in: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                    </p>
                  )}
                </div>
                <X className="w-4 h-4 ml-auto cursor-pointer opacity-50 hover:opacity-100" onClick={() => setError(null)} />
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#374151] ml-1">Email Address or ID</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors group-focus-within:text-[#3b82f6]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={id}
                    onChange={handleIdChange}
                    placeholder="Enter your email or ID"
                    className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl pl-12 pr-4 text-[#111827] font-semibold transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:font-normal"
                    disabled={loading}
                    autoComplete="off"
                    required
                  />
                  {detectedRole && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#6096ba] rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                      {getRoleIcon(detectedRole)}
                      {detectedRole}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#374151] ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors group-focus-within:text-[#3b82f6]">
                    <FaLock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-14 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl pl-12 pr-12 text-[#111827] font-semibold transition-all focus:bg-white focus:border-[#6096ba] focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-[#9ca3af] placeholder:font-normal"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors p-1"
                  >
                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-extrabold text-[#6096ba] hover:text-[#4a7ba0] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <div className="flex justify-center w-full overflow-hidden">
                <div className="scale-[0.85] sm:scale-100 origin-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey="0x4AAAAAADTDrE_LOIBg5GvX"
                    onSuccess={(token) => setRecaptchaToken(token)}
                    onExpire={() => { setRecaptchaToken(null); turnstileRef.current?.reset(); }}
                    onError={() => { setRecaptchaToken(null); turnstileRef.current?.reset(); }}
                    options={{ theme: 'light', size: 'flexible' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !recaptchaToken || lockoutSeconds > 0}
                className="w-full h-14 bg-[#6096ba] hover:bg-[#4a7ba0] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(96,150,186,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-lg cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <>Sign In</>
                )}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-[#f1f5f9]"></div>
                <span className="flex-shrink mx-4 text-slate-400 font-bold text-[9px] uppercase tracking-widest leading-none">Management Access Only</span>
                <div className="flex-grow border-t border-[#f1f5f9]"></div>
              </div>

              <div className="text-center">
                <p className="text-sm font-bold text-[#9ca3af]">
                  Don't have an account? 
                </p>
              </div>
            </form>
          </div>


            {/* Forgot Password Section */}
            <div className={`col-start-1 row-start-1 transition-all duration-500 ease-in-out ${!showForgotPassword ? 'opacity-0 translate-x-[120%] pointer-events-none' : 'opacity-100 translate-x-0'}`}>
              {renderForgotPasswordForm()}
            </div>
          </div>

          {/* Version Badge */}
          {appVersion && (
            <div className="absolute bottom-4 ml-46 text-[10px] font-bold text-slate-300 tracking-widest select-none">
              {appVersion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
