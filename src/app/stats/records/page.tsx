'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, RefreshCw } from 'lucide-react';
import { getAllActivities, getPersonalRecords, savePersonalRecords } from '@/lib/storage/indexed-db';
import { computeAllRecords, getAllPRs } from '@/lib/records/record-detector';
import { PersonalRecord, PersonalRecordsDTO } from '@/types/records';
import PersonalRecordsGrid from '@/components/stats/PersonalRecordsGrid';

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function RecordsPage() {
  const router = useRouter();
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [allRecords, setAllRecords] = useState<PersonalRecordsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const loadRecords = async () => {
    try {
      let records = await getPersonalRecords(TEMP_USER_ID);

      // If no records exist, compute them from activities
      if (!records) {
        const activities = await getAllActivities(TEMP_USER_ID);
        if (activities.length > 0) {
          records = computeAllRecords(activities, TEMP_USER_ID);
          await savePersonalRecords(records);
        }
      }

      if (records) {
        setAllRecords(records);
        setPrs(getAllPRs(records));
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const activities = await getAllActivities(TEMP_USER_ID);
      const records = computeAllRecords(activities, TEMP_USER_ID);
      await savePersonalRecords(records);
      setAllRecords(records);
      setPrs(getAllPRs(records));
    } catch (error) {
      console.error('Failed to recompute records:', error);
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Records personnels
              </h1>
            </div>
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`}
              />
              Recalculer
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <p className="text-2xl font-bold">{prs.length}</p>
              <p className="opacity-90">Records personnels</p>
            </div>
          </div>
        </div>

        {/* PR Grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vos meilleures performances
          </h2>
          <PersonalRecordsGrid records={prs} showAll />
        </div>

        {/* All records by distance */}
        {allRecords && Object.keys(allRecords.records).length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top 3 par distance
            </h2>
            <div className="space-y-4">
              {Object.entries(allRecords.records)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([distance, records]) => (
                  <div
                    key={distance}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {records[0]?.distanceLabel || `${Number(distance) / 1000}km`}
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {records.map((record) => (
                        <div
                          key={`${record.activityId}-${record.timeSeconds}`}
                          className="px-4 py-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                record.rank === 1
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : record.rank === 2
                                    ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}
                            >
                              {record.rank}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(record.timeSeconds * 1000)
                                  .toISOString()
                                  .substr(11, 8)
                                  .replace(/^00:/, '')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {record.activityName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {Math.floor(record.paceSecPerKm / 60)}:
                              {Math.round(record.paceSecPerKm % 60)
                                .toString()
                                .padStart(2, '0')}
                              /km
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(record.date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
