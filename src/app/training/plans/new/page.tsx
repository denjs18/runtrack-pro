'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PlanWizard from '@/components/training/PlanWizard';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function NewPlanPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Créer un plan d&apos;entraînement
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <PlanWizard userId={TEMP_USER_ID} />
      </main>
    </div>
  );
}
