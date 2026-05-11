'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RunnerProfile,
  TrainingGoal,
  PlanDifficulty,
} from '@/types/training';
import { generatePlan } from '@/lib/training/plan-generator';
import { saveTrainingPlan } from '@/lib/storage/indexed-db';
import { syncTrainingPlanToFirebase, isOnline } from '@/lib/storage/sync-manager';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  User,
  Calendar,
  Zap,
  Check,
  Loader2,
} from 'lucide-react';

interface PlanWizardProps {
  userId: string;
  onComplete?: () => void;
}

type Step = 'goal' | 'profile' | 'schedule' | 'difficulty' | 'review';

const raceDistances = [
  { value: 5000, label: '5K' },
  { value: 10000, label: '10K' },
  { value: 21097, label: 'Semi-Marathon' },
  { value: 42195, label: 'Marathon' },
];

const experienceLevels = [
  { value: 'beginner', label: 'Débutant', description: 'Moins de 1 an de course' },
  { value: 'intermediate', label: 'Intermédiaire', description: '1-3 ans de course régulière' },
  { value: 'advanced', label: 'Avancé', description: 'Plus de 3 ans, compétitions régulières' },
];

const difficulties = [
  { value: 'easy', label: 'Facile', description: 'Volume modéré, progression douce' },
  { value: 'moderate', label: 'Modéré', description: 'Équilibre entre volume et récupération' },
  { value: 'challenging', label: 'Ambitieux', description: 'Volume élevé, progression rapide' },
];

export default function PlanWizard({ userId, onComplete }: PlanWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('goal');
  const [isCreating, setIsCreating] = useState(false);

  // Goal state
  const [goalType, setGoalType] = useState<'race' | 'fitness'>('race');
  const [raceDistance, setRaceDistance] = useState(10000);
  const [raceDate, setRaceDate] = useState('');
  const [targetTime, setTargetTime] = useState('');

  // Profile state
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [currentWeeklyDistance, setCurrentWeeklyDistance] = useState(20);
  const [age, setAge] = useState(30);

  // Schedule state
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [preferredDays, setPreferredDays] = useState<number[]>([2, 4, 6, 7]); // Tue, Thu, Sat, Sun

  // Difficulty
  const [difficulty, setDifficulty] = useState<PlanDifficulty>('moderate');

  const steps: { key: Step; label: string; icon: React.ElementType }[] = [
    { key: 'goal', label: 'Objectif', icon: Target },
    { key: 'profile', label: 'Profil', icon: User },
    { key: 'schedule', label: 'Planning', icon: Calendar },
    { key: 'difficulty', label: 'Difficulté', icon: Zap },
    { key: 'review', label: 'Validation', icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  const canProceed = () => {
    switch (step) {
      case 'goal':
        return goalType && (goalType !== 'race' || raceDistance);
      case 'profile':
        return experienceLevel && currentWeeklyDistance > 0;
      case 'schedule':
        return daysPerWeek >= 3 && preferredDays.length >= daysPerWeek;
      case 'difficulty':
        return difficulty;
      default:
        return true;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].key);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].key);
    }
  };

  const toggleDay = (day: number) => {
    if (preferredDays.includes(day)) {
      setPreferredDays(preferredDays.filter((d) => d !== day));
    } else {
      setPreferredDays([...preferredDays, day].sort((a, b) => a - b));
    }
  };

  const createPlan = async () => {
    setIsCreating(true);

    const profile: RunnerProfile = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      age,
      weight: 70, // Default
      gender: 'other',
      experienceLevel,
      yearsRunning: experienceLevel === 'beginner' ? 1 : experienceLevel === 'intermediate' ? 2 : 5,
      currentWeeklyDistance,
      longestRecentRun: currentWeeklyDistance * 0.3,
      daysPerWeek,
      maxSessionDuration: 90,
      preferredDays,
      hasInjuryHistory: false,
      includeSpeedWork: true,
      includeHillWork: true,
      hasAccessToTrack: false,
    };

    const goal: TrainingGoal = {
      type: goalType,
      raceDistance: goalType === 'race' ? raceDistance : undefined,
      raceDate: raceDate ? new Date(raceDate).getTime() : undefined,
      targetTime: targetTime ? parseTargetTime(targetTime) : undefined,
      description: goalType === 'race'
        ? `Course ${raceDistances.find((r) => r.value === raceDistance)?.label}`
        : 'Améliorer ma condition physique',
    };

    const plan = generatePlan(profile, goal, difficulty, userId);

    try {
      await saveTrainingPlan(plan);
      if (isOnline()) {
        await syncTrainingPlanToFirebase(plan);
      }
      onComplete?.();
      router.push(`/training/plans/${plan.id}`);
    } catch (error) {
      console.error('Failed to create plan:', error);
      setIsCreating(false);
    }
  };

  const parseTargetTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                idx < currentStepIndex
                  ? 'bg-green-500 text-white'
                  : idx === currentStepIndex
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}
            >
              {idx < currentStepIndex ? (
                <Check className="w-5 h-5" />
              ) : (
                <s.icon className="w-5 h-5" />
              )}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-12 h-1 mx-1 ${
                  idx < currentStepIndex
                    ? 'bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        {step === 'goal' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Quel est votre objectif ?</h2>

            <div className="space-y-4 mb-6">
              <button
                onClick={() => setGoalType('race')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                  goalType === 'race'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">Préparer une course</p>
                <p className="text-sm text-gray-500">5K, 10K, Semi ou Marathon</p>
              </button>
              <button
                onClick={() => setGoalType('fitness')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                  goalType === 'fitness'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">Améliorer ma forme</p>
                <p className="text-sm text-gray-500">Progresser sans objectif de course</p>
              </button>
            </div>

            {goalType === 'race' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Distance</label>
                  <div className="grid grid-cols-4 gap-2">
                    {raceDistances.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setRaceDistance(d.value)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          raceDistance === d.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Date de la course (optionnel)
                  </label>
                  <input
                    type="date"
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    min={new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split('T')[0]}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Temps cible (optionnel, format MM:SS ou HH:MM:SS)
                  </label>
                  <input
                    type="text"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    placeholder="Ex: 55:00 ou 1:50:00"
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'profile' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Votre profil de coureur</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">Niveau d'expérience</label>
                <div className="space-y-2">
                  {experienceLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setExperienceLevel(level.value as typeof experienceLevel)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                        experienceLevel === level.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{level.label}</p>
                      <p className="text-sm text-gray-500">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Volume hebdomadaire actuel (km)
                </label>
                <input
                  type="number"
                  value={currentWeeklyDistance}
                  onChange={(e) => setCurrentWeeklyDistance(Number(e.target.value))}
                  min={0}
                  max={150}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Âge</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  min={16}
                  max={99}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
              </div>
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Votre disponibilité</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">
                  Nombre de séances par semaine
                </label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setDaysPerWeek(n);
                        // Adjust preferred days if needed
                        if (preferredDays.length > n) {
                          setPreferredDays(preferredDays.slice(0, n));
                        }
                      }}
                      className={`flex-1 py-3 rounded-lg border text-lg font-medium transition-colors ${
                        daysPerWeek === n
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">
                  Jours préférés (sélectionnez {daysPerWeek})
                </label>
                <div className="flex gap-2">
                  {dayNames.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx + 1)}
                      disabled={
                        !preferredDays.includes(idx + 1) &&
                        preferredDays.length >= daysPerWeek
                      }
                      className={`flex-1 py-3 rounded-lg border text-lg font-medium transition-colors disabled:opacity-50 ${
                        preferredDays.includes(idx + 1)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'difficulty' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Niveau de difficulté</h2>

            <div className="space-y-3">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value as PlanDifficulty)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    difficulty === d.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold">{d.label}</p>
                  <p className="text-sm text-gray-500">{d.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Récapitulatif</h2>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Objectif</p>
                <p className="font-semibold">
                  {goalType === 'race'
                    ? `Course ${raceDistances.find((r) => r.value === raceDistance)?.label}`
                    : 'Améliorer ma forme'}
                  {raceDate && ` - ${new Date(raceDate).toLocaleDateString('fr-FR')}`}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Profil</p>
                <p className="font-semibold">
                  {experienceLevels.find((l) => l.value === experienceLevel)?.label} •{' '}
                  {currentWeeklyDistance} km/semaine
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Planning</p>
                <p className="font-semibold">
                  {daysPerWeek} séances/semaine •{' '}
                  {preferredDays.map((d) => dayNames[d - 1]).join(', ')}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">Difficulté</p>
                <p className="font-semibold">
                  {difficulties.find((d) => d.value === difficulty)?.label}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Retour
        </button>

        {step !== 'review' ? (
          <button
            onClick={goNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            Suivant
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={createPlan}
            disabled={isCreating}
            className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Créer le plan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
