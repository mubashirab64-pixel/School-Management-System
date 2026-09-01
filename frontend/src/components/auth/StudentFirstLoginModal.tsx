"use client";

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { studentDirectChangePassword } from '@/lib/api';

interface StudentFirstLoginModalProps {
  sessionToken: string;
  onComplete: () => void;
}

export const StudentFirstLoginModal: React.FC<StudentFirstLoginModalProps> = ({
  sessionToken,
  onComplete,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await studentDirectChangePassword(sessionToken, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#6096ba] to-[#a3cef1] rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#274c77]">Set New Password</h2>
            <p className="text-gray-500 text-sm mt-2">
              You are logging in for the first time. Please set a new password for your account.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-green-700 font-semibold">Password changed successfully!</p>
              <p className="text-gray-500 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#274c77] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full h-12 border-2 border-[#a3cef1] rounded-xl px-4 text-[#274c77] focus:outline-none focus:ring-2 focus:ring-[#6096ba] focus:border-transparent"
                  disabled={loading}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#274c77] mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full h-12 border-2 border-[#a3cef1] rounded-xl px-4 text-[#274c77] focus:outline-none focus:ring-2 focus:ring-[#6096ba] focus:border-transparent"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full h-12 bg-[#6096ba] hover:bg-[#4a7ba7] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Changing...
                  </span>
                ) : 'Set New Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
