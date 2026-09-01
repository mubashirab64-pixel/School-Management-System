"use client";

import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface ValidationRule {
  label: string;
  test: (password: string) => boolean;
}

const validationRules: ValidationRule[] = [
  {
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    label: 'Contains uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'Contains lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'Contains number',
    test: (password) => /\d/.test(password),
  },
  {
    label: 'Contains special character',
    test: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

const getPasswordStrength = (password: string): { score: number; level: string; color: string } => {
  if (!password) {
    return { score: 0, level: 'Very Weak', color: 'bg-gray-300' };
  }

  const validRules = validationRules.filter(rule => rule.test(password));
  const score = (validRules.length / validationRules.length) * 100;

  if (score < 40) {
    return { score, level: 'Weak', color: 'bg-red-500' };
  } else if (score < 80) {
    return { score, level: 'Medium', color: 'bg-yellow-500' };
  } else {
    return { score, level: 'Strong', color: 'bg-green-500' };
  }
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
}) => {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const validRules = validationRules.filter(rule => rule.test(password));

  return (
    <div className="mt-3 space-y-3">
      {/* Strength Bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Password Strength</span>
          <span className={`text-sm font-medium ${
            strength.score < 40 ? 'text-red-600' : 
            strength.score < 80 ? 'text-yellow-600' : 
            'text-green-600'
          }`}>
            {strength.level}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strength.score}%` }}
          />
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="space-y-2">
        {validationRules.map((rule, index) => {
          const isValid = rule.test(password);
          return (
            <div key={index} className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                isValid ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {isValid ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <X className="w-3 h-3 text-gray-400" />
                )}
              </div>
              <span className={`text-sm ${
                isValid ? 'text-green-700' : 'text-gray-500'
              }`}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Additional Security Tips */}
      {password.length > 0 && strength.score < 80 && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Tip:</strong> For better security, avoid using personal information like your name, email, or common words.
          </p>
        </div>
      )}
    </div>
  );
};
