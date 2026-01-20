'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import ActivityCard from '@/components/history/ActivityCard';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Activity } from '@/types';
import { formatDistance, formatDuration } from '@/lib/utils';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const { showToast } = useToast();

  const fetchActivities = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/activities?page=${page}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setActivities(data.activities);
      setPagination(data.pagination);
    } catch {
      showToast('Erreur lors du chargement des activités', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchActivities(currentPage);
  }, [fetchActivities, currentPage]);

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette course?')) return;

    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      setActivities((prev) => prev.filter((a) => a._id !== id));
      showToast('Course supprimée', 'success');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  // Calculate summary stats
  const totalDistance = activities.reduce((sum, a) => sum + a.stats.distance, 0);
  const totalDuration = activities.reduce((sum, a) => sum + a.stats.duration, 0);
  const totalRuns = pagination?.total || activities.length;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <History className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Historique
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalRuns} course{totalRuns > 1 ? 's' : ''} enregistrée{totalRuns > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchActivities(currentPage)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Summary Stats */}
        {activities.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
              <TrendingUp className="w-5 h-5 mx-auto text-blue-500 mb-1" />
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatDistance(totalDistance)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
              <Calendar className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatDuration(totalDuration)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Durée
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
              <History className="w-5 h-5 mx-auto text-orange-500 mb-1" />
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {totalRuns}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Courses
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && activities.length === 0 && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 animate-pulse"
              >
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && activities.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune course
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Commencez votre première course depuis la page d&apos;accueil
            </p>
          </div>
        )}

        {/* Activities List */}
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityCard
              key={activity._id}
              activity={activity}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Précédent
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} sur {pagination.totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              Suivant
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
