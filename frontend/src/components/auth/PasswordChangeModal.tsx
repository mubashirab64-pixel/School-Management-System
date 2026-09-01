"use client";

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { getApiBaseUrl } from '@/lib/api';

interface PasswordChangeModalProps {
  userEmail: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  userEmail,
  onComplete,
  onError,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    setError('');

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
    try {
      const base = getApiBaseUrl().replace(/\/$/, '');
      const response = await fetch(`${base}/api/first-login-change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => onComplete(), 2000);
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#274c77] mb-2">Change Password Required</h2>
            <p className="text-gray-600 text-sm">
              For security reasons, please set a new password before accessing the system.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#274c77]">Password Changed Successfully!</h3>
              <p className="text-gray-500 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-[#e8f1f8] rounded-full flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-7 h-7 text-[#274c77]" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-3 border-2 border-[#a3cef1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6096ba] focus:border-transparent"
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full p-3 border-2 border-[#a3cef1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6096ba] focus:border-transparent"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full bg-[#6096ba] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#4a7ba7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
