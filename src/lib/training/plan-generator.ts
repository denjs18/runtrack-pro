import type {
  RunnerProfile,
  TrainingGoal,
  PlanDifficulty,
  TrainingPlan,
  TrainingWeek,
  PlannedSession,
  SessionType,
  TrainingPhase,
  ProgressProjection,
} from '@/types/training';
import { estimateEasyPace } from './pace-calculator';

// Generate a complete training plan based on profile and goal
export function generatePlan(
  profile: RunnerProfile,
  goal: TrainingGoal,
  difficulty: PlanDifficulty,
  userId: string
): TrainingPlan {
  const planId = crypto.randomUUID();
  const now = Date.now();

  // Calculate plan duration
  let planWeeks = 12; // default
  if (goal.raceDate) {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    planWeeks = Math.floor((goal.raceDate - now) / msPerWeek);
    planWeeks = Math.max(8, Math.min(20, planWeeks)); // 8-20 weeks
  }

  // Calculate starting fitness level (0-100)
  const startingFitness = estimateFitnessLevel(profile);

  // Calculate target fitness needed
  const targetFitness = calculateTargetFitness(goal, profile);

  // Generate weekly structure
  const weeks = generateWeeks(
    planWeeks,
    profile,
    goal,
    difficulty,
    startingFitness,
    targetFitness
  );

  // Calculate progression projection
  const projectedProgress = calculateProjection(
    weeks,
    goal,
    startingFitness,
    targetFitness
  );

  // Set dates
  const startDate = getNextMonday(now);
  const endDate = startDate + planWeeks * 7 * 24 * 60 * 60 * 1000;

  // Assign dates to sessions
  for (let w = 0; w < weeks.length; w++) {
    for (const session of weeks[w].sessions) {
      if (session.type !== 'rest') {
        const sessionDate = startDate + (w * 7 + (session.dayOfWeek - 1)) * 24 * 60 * 60 * 1000;
        session.date = sessionDate;
      }
    }
  }

  return {
    id: planId,
    userId,
    name: generatePlanName(goal),
    createdAt: now,
    updatedAt: now,
    startDate,
    endDate,
    goal,
    difficulty,
    profile,
    weeks,
    currentWeekIndex: 0,
    completedSessions: [],
    adjustmentHistory: [],
    projectedProgress,
    isActive: true,
  };
}

function estimateFitnessLevel(profile: RunnerProfile): number {
  let fitness = 30; // base

  // Experience adds fitness
  if (profile.experienceLevel === 'intermediate') fitness += 15;
  if (profile.experienceLevel === 'advanced') fitness += 30;

  // Current volume adds fitness
  fitness += Math.min(20, profile.currentWeeklyDistance / 3);

  // Recent race performance
  if (profile.recentRaceTimes && profile.recentRaceTimes.length > 0) {
    const best = profile.recentRaceTimes[0];
    // Calculate VDOT-like score
    const pace = (best.time / best.distance) * 1000;
    if (pace < 300) fitness += 20; // sub 5:00/km
    else if (pace < 360) fitness += 10; // sub 6:00/km
  }

  return Math.min(100, fitness);
}

function calculateTargetFitness(goal: TrainingGoal, profile: RunnerProfile): number {
  if (goal.type === 'race' && goal.targetTime && goal.raceDistance) {
    const targetPace = (goal.targetTime / goal.raceDistance) * 1000;
    // Rough mapping of pace to fitness
    if (targetPace < 240) return 90; // sub 4:00/km
    if (targetPace < 270) return 80; // sub 4:30/km
    if (targetPace < 300) return 70; // sub 5:00/km
    if (targetPace < 330) return 60; // sub 5:30/km
    if (targetPace < 360) return 50; // sub 6:00/km
    return 40;
  }
  return 60; // default target
}

function generateWeeks(
  numWeeks: number,
  profile: RunnerProfile,
  goal: TrainingGoal,
  difficulty: PlanDifficulty,
  startFitness: number,
  targetFitness: number
): TrainingWeek[] {
  const weeks: TrainingWeek[] = [];

  // Difficulty multipliers
  const difficultyMult: Record<PlanDifficulty, number> = {
    easy: 0.8,
    moderate: 1.0,
    challenging: 1.2,
  };
  const mult = difficultyMult[difficulty];

  // Phase distribution
  const phases = calculatePhases(numWeeks);

  // Starting volume based on current level
  const baseVolume = profile.currentWeeklyDistance || 15;
  const peakVolume = calculatePeakVolume(goal, profile, mult);

  for (let w = 0; w < numWeeks; w++) {
    const phase = phases[w];
    const weekNum = w + 1;

    // Calculate target volume for this week
    const volumeProgression = calculateVolumeProgression(
      w,
      numWeeks,
      phase,
      baseVolume,
      peakVolume
    );

    // Cutback week every 4th week (except taper)
    const isCutback = phase !== 'taper' && weekNum % 4 === 0;
    const weekVolume = isCutback ? volumeProgression * 0.7 : volumeProgression;

    // Generate sessions for this week
    const sessions = generateWeekSessions(
      weekNum,
      phase,
      weekVolume,
      profile,
      goal,
      difficulty,
      isCutback
    );

    weeks.push({
      weekNumber: weekNum,
      phase,
      targetDistance: Math.round(weekVolume * 10) / 10,
      targetTime: Math.round(weekVolume * 6), // ~6 min/km average
      sessions,
      notes: isCutback ? 'Semaine de récupération - volume réduit' : undefined,
    });
  }

  return weeks;
}

function calculatePhases(numWeeks: number): TrainingPhase[] {
  const phases: TrainingPhase[] = [];

  const baseWeeks = Math.floor(numWeeks * 0.25);
  const buildWeeks = Math.floor(numWeeks * 0.45);
  const peakWeeks = Math.floor(numWeeks * 0.2);
  const taperWeeks = numWeeks - baseWeeks - buildWeeks - peakWeeks;

  for (let i = 0; i < baseWeeks; i++) phases.push('base');
  for (let i = 0; i < buildWeeks; i++) phases.push('build');
  for (let i = 0; i < peakWeeks; i++) phases.push('peak');
  for (let i = 0; i < taperWeeks; i++) phases.push('taper');

  return phases;
}

function calculatePeakVolume(
  goal: TrainingGoal,
  profile: RunnerProfile,
  difficultyMult: number
): number {
  const raceDistance = goal.raceDistance || 10000;
  const raceKm = raceDistance / 1000;

  // Peak volume based on race distance
  let basePeak = 30; // 5k
  if (raceKm >= 10) basePeak = 50;
  if (raceKm >= 21.1) basePeak = 70;
  if (raceKm >= 42.2) basePeak = 90;

  // Adjust for experience
  if (profile.experienceLevel === 'beginner') basePeak *= 0.7;
  if (profile.experienceLevel === 'advanced') basePeak *= 1.2;

  // Apply difficulty
  return basePeak * difficultyMult;
}

function calculateVolumeProgression(
  weekIndex: number,
  totalWeeks: number,
  phase: TrainingPhase,
  baseVolume: number,
  peakVolume: number
): number {
  const progress = weekIndex / totalWeeks;

  if (phase === 'base') {
    // Gradual build from base
    return baseVolume + (peakVolume - baseVolume) * 0.3 * (progress / 0.25);
  } else if (phase === 'build') {
    // Main volume increase
    const buildProgress = (progress - 0.25) / 0.45;
    return baseVolume + (peakVolume - baseVolume) * (0.3 + 0.6 * buildProgress);
  } else if (phase === 'peak') {
    // Maintain high volume
    return peakVolume * 0.95;
  } else {
    // Taper - reduce volume
    const taperProgress = (progress - 0.9) / 0.1;
    return peakVolume * (0.7 - 0.3 * taperProgress);
  }
}

function generateWeekSessions(
  weekNum: number,
  phase: TrainingPhase,
  weekVolume: number,
  profile: RunnerProfile,
  goal: TrainingGoal,
  difficulty: PlanDifficulty,
  isCutback: boolean
): PlannedSession[] {
  const sessions: PlannedSession[] = [];
  const daysPerWeek = profile.daysPerWeek;

  // Session type distribution based on phase
  const sessionMix = getSessionMix(phase, profile, isCutback);

  // Distribute volume across sessions
  const volumeDistribution = distributeVolume(weekVolume, sessionMix, profile);

  // Map days
  const runDays = selectRunDays(profile.preferredDays, daysPerWeek);

  let sessionIndex = 0;
  for (let day = 1; day <= 7; day++) {
    if (runDays.includes(day) && sessionIndex < sessionMix.length) {
      const sessionType = sessionMix[sessionIndex];
      const distance = volumeDistribution[sessionIndex];

      const session = createSession(
        `${weekNum}-${day}`,
        day,
        sessionType,
        distance,
        profile,
        goal,
        phase
      );
      sessions.push(session);
      sessionIndex++;
    } else {
      // Rest day
      sessions.push({
        id: `${weekNum}-${day}`,
        dayOfWeek: day,
        type: 'rest',
        title: 'Repos',
        description: 'Journée de récupération',
        status: 'pending',
      });
    }
  }

  return sessions;
}

function getSessionMix(
  phase: TrainingPhase,
  profile: RunnerProfile,
  isCutback: boolean
): SessionType[] {
  const days = profile.daysPerWeek;

  if (isCutback) {
    // Cutback week: mostly easy + 1 quality
    if (days <= 3) return ['easy', 'easy', 'long'];
    if (days <= 4) return ['easy', 'tempo', 'easy', 'long'];
    return ['easy', 'tempo', 'easy', 'easy', 'long'];
  }

  if (phase === 'base') {
    // Base: aerobic focus
    if (days <= 3) return ['easy', 'easy', 'long'];
    if (days <= 4) return ['easy', 'fartlek', 'easy', 'long'];
    return ['easy', 'fartlek', 'easy', 'easy', 'long'];
  }

  if (phase === 'build') {
    // Build: add intensity
    if (days <= 3) return ['tempo', 'easy', 'long'];
    if (days <= 4) return ['intervals', 'easy', 'tempo', 'long'];
    if (days <= 5) return ['intervals', 'easy', 'tempo', 'easy', 'long'];
    return ['intervals', 'recovery', 'tempo', 'easy', 'easy', 'long'];
  }

  if (phase === 'peak') {
    // Peak: race-specific work
    if (days <= 3) return ['intervals', 'tempo', 'long'];
    if (days <= 4) return ['intervals', 'tempo', 'easy', 'long'];
    return ['intervals', 'easy', 'tempo', 'easy', 'long'];
  }

  // Taper: reduced intensity and volume
  if (days <= 3) return ['easy', 'tempo', 'easy'];
  return ['easy', 'intervals', 'easy', 'easy'];
}

function distributeVolume(
  totalVolume: number,
  sessions: SessionType[],
  profile: RunnerProfile
): number[] {
  const weights: Record<SessionType, number> = {
    easy: 0.15,
    long: 0.35,
    tempo: 0.15,
    intervals: 0.1,
    fartlek: 0.12,
    hills: 0.1,
    recovery: 0.08,
    rest: 0,
    race: 0,
    'time-trial': 0.05,
  };

  const activeWeights = sessions.map((s) => weights[s] || 0.1);
  const totalWeight = activeWeights.reduce((a, b) => a + b, 0);

  return activeWeights.map((w) => Math.round((w / totalWeight) * totalVolume * 10) / 10);
}

function selectRunDays(preferred: number[], count: number): number[] {
  if (preferred.length >= count) {
    return preferred.slice(0, count);
  }

  // Default distribution if no preferences
  const defaults = [2, 4, 6, 7, 3, 5, 1]; // Tue, Thu, Sat, Sun, Wed, Fri, Mon
  const result = [...preferred];

  for (const day of defaults) {
    if (result.length >= count) break;
    if (!result.includes(day)) {
      result.push(day);
    }
  }

  return result.sort((a, b) => a - b);
}

function createSession(
  id: string,
  dayOfWeek: number,
  type: SessionType,
  distance: number,
  profile: RunnerProfile,
  goal: TrainingGoal,
  phase: TrainingPhase
): PlannedSession {
  const easyPace = estimateEasyPace(profile.experienceLevel, profile.recentRaceTimes);
  const tempoPace = easyPace - 45;
  const intervalPace = easyPace - 75;

  const session: PlannedSession = {
    id,
    dayOfWeek,
    type,
    title: '',
    description: '',
    targetDistance: distance,
    status: 'pending',
  };

  switch (type) {
    case 'easy':
      session.title = 'Footing facile';
      session.description = `Course à allure confortable. Vous devez pouvoir tenir une conversation.`;
      session.targetPace = { min: easyPace - 15, max: easyPace + 30 };
      session.targetDuration = Math.round(distance * (easyPace / 60));
      break;

    case 'long':
      session.title = 'Sortie longue';
      session.description = `Course longue pour développer l'endurance. Allure facile, focus sur la durée.`;
      session.targetPace = { min: easyPace, max: easyPace + 45 };
      session.targetDuration = Math.round(distance * ((easyPace + 15) / 60));
      break;

    case 'tempo':
      session.title = 'Tempo run';
      session.description = `Échauffement 10min, puis ${Math.round(distance * 0.6)}km au seuil, retour au calme 10min.`;
      session.targetPace = { min: tempoPace - 10, max: tempoPace + 10 };
      session.warmup = { distance: 1.5, pace: 'facile' };
      session.cooldown = { distance: 1, pace: 'facile' };
      break;

    case 'intervals':
      const reps = Math.max(4, Math.round(distance / 1.5));
      const intervalDist = goal.raceDistance && goal.raceDistance >= 10000 ? 1000 : 400;
      session.title = `Fractionné ${reps}x${intervalDist}m`;
      session.description = `Échauffement 15min, ${reps} répétitions de ${intervalDist}m, récupération trottée entre chaque.`;
      session.warmup = { distance: 2, pace: 'facile' };
      session.intervals = {
        reps,
        distance: intervalDist,
        targetPace: intervalPace,
        recovery: intervalDist === 400 ? 90 : 120,
      };
      session.cooldown = { distance: 1.5, pace: 'facile' };
      break;

    case 'fartlek':
      session.title = 'Fartlek';
      session.description = `Jeu de vitesse : alternez des accélérations de 1-3min avec de la récupération au feeling.`;
      session.targetPace = { min: tempoPace, max: easyPace };
      break;

    case 'hills':
      session.title = 'Séance côtes';
      session.description = `Échauffement, puis 6-10 montées de 60-90sec à effort soutenu, récupération en descente.`;
      break;

    case 'recovery':
      session.title = 'Récupération active';
      session.description = `Course très lente. Objectif: activer la circulation sans fatiguer.`;
      session.targetPace = { min: easyPace + 30, max: easyPace + 60 };
      break;

    case 'time-trial':
      session.title = 'Test chronométré';
      session.description = `Après échauffement, courez ${distance}km le plus vite possible pour évaluer votre forme.`;
      break;

    case 'race':
      session.title = 'COURSE';
      session.description = `Jour de course ! Bonne chance !`;
      break;
  }

  return session;
}

function calculateProjection(
  weeks: TrainingWeek[],
  goal: TrainingGoal,
  startFitness: number,
  targetFitness: number
): ProgressProjection {
  const projectionWeeks: ProgressProjection['weeks'] = [];
  let cumulativeDistance = 0;

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    cumulativeDistance += week.targetDistance;

    // Linear fitness progression with phase adjustments
    const progress = i / weeks.length;
    let fitnessGain = (targetFitness - startFitness) * progress;

    // Phase-specific adjustments
    if (week.phase === 'build') fitnessGain *= 1.1;
    if (week.phase === 'peak') fitnessGain *= 1.05;
    if (week.phase === 'taper') fitnessGain *= 0.95;

    const projectedFitness = Math.min(100, startFitness + fitnessGain);

    // Estimate pace improvement
    const paceImprovement = (projectedFitness - startFitness) * 1.5;
    const projectedPace = 360 - paceImprovement;

    projectionWeeks.push({
      weekNumber: week.weekNumber,
      projectedFitness: Math.round(projectedFitness),
      projectedPace: Math.round(projectedPace),
      projectedEndurance: Math.round(cumulativeDistance * 0.3),
      cumulativeDistance: Math.round(cumulativeDistance),
    });
  }

  // Calculate if on track for goal
  const finalFitness =
    projectionWeeks[projectionWeeks.length - 1]?.projectedFitness || startFitness;
  const currentEstimatedTime = goal.raceDistance ? (goal.raceDistance / 1000) * 360 : 0;
  const targetTime = goal.targetTime || currentEstimatedTime * 0.9;

  return {
    weeks: projectionWeeks,
    currentEstimatedTime,
    targetTime,
    gapToClose: currentEstimatedTime - targetTime,
    onTrack: finalFitness >= targetFitness * 0.95,
    confidenceLevel:
      finalFitness >= targetFitness
        ? 'high'
        : finalFitness >= targetFitness * 0.9
          ? 'medium'
          : 'low',
  };
}

function getNextMonday(timestamp: number): number {
  const d = new Date(timestamp);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function generatePlanName(goal: TrainingGoal): string {
  if (goal.type === 'race' && goal.raceDistance) {
    const km = goal.raceDistance / 1000;
    if (km <= 5) return 'Plan 5K';
    if (km <= 10) return 'Plan 10K';
    if (km <= 21.1) return 'Plan Semi-Marathon';
    if (km <= 42.2) return 'Plan Marathon';
    return `Plan ${km}km`;
  }
  return 'Plan personnalisé';
}
