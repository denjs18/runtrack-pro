'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Route,
  Gauge,
  Mountain,
  Timer,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import DynamicMap from '@/components/tracking/DynamicMap';
import StatCard from '@/components/tracking/StatCard';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Activity } from '@/types';
import {
  formatDate,
  formatTime,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
} from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ActivityDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await fetch(`/api/activities/${id}`);
        if (!response.ok) throw new Error('Not found');
        const data = await response.json();
        setActivity(data.activity);
        setEditedName(data.activity.name);
      } catch {
        showToast('Activité non trouvée', 'error');
        router.push('/activities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id, router, showToast]);

  const handleSaveName = async () => {
    if (!activity || !editedName.trim()) return;

    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setActivity({ ...activity, name: editedName });
      setIsEditing(false);
      showToast('Nom mis à jour', 'success');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Voulez-vous vraiment supprimer cette course?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      showToast('Course supprimée', 'success');
      router.push('/activities');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!activity) return null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/activities"
            className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>

          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedName(activity.name);
                  }}
                  className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {activity.name}
                </h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(activity.startTime)}</span>
              <span>-</span>
              <Clock className="w-4 h-4" />
              <span>{formatTime(activity.startTime)}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Map */}
        <div className="mb-6">
          <DynamicMap
            points={activity.points}
            height="300px"
            showSpeedGradient={true}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            icon={<Route className="w-5 h-5" />}
            label="Distance"
            value={formatDistance(activity.stats.distance)}
            variant="primary"
          />
          <StatCard
            icon={<Timer className="w-5 h-5" />}
            label="Durée"
            value={formatDuration(activity.stats.duration)}
            variant="highlight"
          />
          <StatCard
            icon={<Gauge className="w-5 h-5" />}
            label="Allure moyenne"
            value={`${formatPace(activity.stats.avgPace)}/km`}
          />
          <StatCard
            icon={<Gauge className="w-5 h-5" />}
            label="Vitesse moyenne"
            value={formatSpeed(activity.stats.avgSpeed)}
          />
          <StatCard
            icon={<Gauge className="w-5 h-5" />}
            label="Vitesse max"
            value={formatSpeed(activity.stats.maxSpeed)}
          />
          <StatCard
            icon={<Mountain className="w-5 h-5" />}
            label="Dénivelé +"
            value={`${Math.round(activity.stats.elevationGain)} m`}
          />
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Informations
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Points GPS</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {activity.points.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Début</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatTime(activity.startTime)}
              </span>
            </div>
            {activity.endTime && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Fin</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatTime(activity.endTime)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
