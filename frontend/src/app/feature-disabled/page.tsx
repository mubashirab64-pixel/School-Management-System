'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, ArrowLeft, ShieldOff } from 'lucide-react';

function FeatureDisabledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const featureName = searchParams.get('feature') || 'This Feature';
  const previousRoute = searchParams.get('previous') || '/admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl border-0">
        <CardContent className="p-8 text-center">

          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center shadow-lg">
              <Lock className="h-10 w-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Feature Not Enabled
          </h2>

          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Feature:</p>
            <p className="text-lg font-semibold text-slate-700 bg-slate-100 px-4 py-2 rounded-lg inline-block">
              {featureName}
            </p>
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-gray-600 leading-relaxed">
              This feature is not enabled for your organization.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your organization admin to enable{' '}
              <span className="font-semibold text-slate-600">{featureName}</span>.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push(previousRoute)}
              className="bg-[#3b6695] hover:bg-[#2d5080] text-white px-6 py-2 rounded-lg font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={() => router.push('/admin')}
              variant="outline"
              className="px-6 py-2 rounded-lg font-medium"
            >
              Dashboard
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <ShieldOff className="h-3.5 w-3.5" />
              <span>Feature access controlled by organization settings</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeatureDisabledPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <FeatureDisabledContent />
    </Suspense>
  );
}
