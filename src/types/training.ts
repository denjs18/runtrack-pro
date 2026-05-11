// Runner Profile - collected via questionnaire
export interface RunnerProfile {
  id: string;
  createdAt: number;
  updatedAt: number;

  // Basic info
  age: number;
  weight: number; // kg
  gender: 'male' | 'female' | 'other';

  // Running experience
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  yearsRunning: number;
  currentWeeklyDistance: number; // km per week currently
  longestRecentRun: number; // km in last month

  // Current fitness
  recentRaceTimes?: {
    distance: number; // meters
    time: number; // seconds
    date: number; // timestamp
  }[];

  // Availability
  daysPerWeek: number; // 3-6
  maxSessionDuration: number; // minutes
  preferredDays: number[]; // 1-7 (Monday = 1)

  // Injury history
  hasInjuryHistory: boolean;
  injuryNotes?: string;

  // Preferences
  includeSpeedWork: boolean;
  includeHillWork: boolean;
  hasAccessToTrack: boolean;
}

// Training Goal
export interface TrainingGoal {
  type: 'race' | 'fitness' | 'distance' | 'speed';
  raceDistance?: number; // meters for race goals
  raceDate?: number; // timestamp
  targetTime?: number; // seconds, optional target
  description: string;
}

// Plan difficulty affects volume and intensity progression
export type PlanDifficulty = 'easy' | 'moderate' | 'challenging';

// Training phases
export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';

// Session types
export type SessionType =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'intervals'
  | 'fartlek'
  | 'hills'
  | 'recovery'
  | 'rest'
  | 'race'
  | 'time-trial';

// Planned session in a training week
export interface PlannedSession {
  id: string;
  dayOfWeek: number; // 1-7
  date?: number; // timestamp
  type: SessionType;
  title: string;
  description: string;

  // Targets
  targetDistance?: number; // km
  targetDuration?: number; // minutes
  targetPace?: { min: number; max: number }; // sec/km

  // For interval sessions
  warmup?: { distance: number; pace: string };
  intervals?: {
    reps: number;
    distance: number;
    targetPace: number;
    recovery: number; // seconds
  };
  cooldown?: { distance: number; pace: string };

  // Status
  status: 'pending' | 'completed' | 'skipped' | 'modified';
  completedData?: CompletedSession;
}

// Training week
export interface TrainingWeek {
  weekNumber: number;
  phase: TrainingPhase;
  targetDistance: number; // km
  targetTime: number; // minutes
  sessions: PlannedSession[];
  notes?: string;
}

// Completed session tracking
export interface CompletedSession {
  sessionId: string;
  completedAt: number; // timestamp
  source: 'auto' | 'manual';

  // Actual values
  actualDistance: number;
  actualDuration: number;
  actualPace: number;
  activityId?: string;

  // Performance rating
  perceivedEffort: number; // 1-10 RPE
  feelingAfter: 'great' | 'good' | 'tired' | 'exhausted';
  notes?: string;

  // Compliance score (0-100)
  complianceScore: number;
}

// Plan adjustment history
export interface PlanAdjustment {
  date: number; // timestamp
  weekNumber: number;
  reason: 'performance' | 'fatigue' | 'missed-sessions' | 'user-request' | 'auto';
  changes: string;
  oldPlan: Partial<TrainingWeek>;
  newPlan: Partial<TrainingWeek>;
}

// Progress projection
export interface ProgressProjection {
  weeks: {
    weekNumber: number;
    projectedFitness: number; // 0-100 scale
    projectedPace: number; // sec/km for goal distance
    projectedEndurance: number; // max comfortable distance
    cumulativeDistance: number;
  }[];
  currentEstimatedTime: number; // seconds for goal distance
  targetTime: number;
  gapToClose: number; // seconds
  onTrack: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// Active Training Plan
export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  startDate: number;
  endDate: number;
  goal: TrainingGoal;
  difficulty: PlanDifficulty;
  profile: RunnerProfile;

  weeks: TrainingWeek[];
  currentWeekIndex: number;

  // Tracking
  completedSessions: CompletedSession[];
  adjustmentHistory: PlanAdjustment[];

  // Projections
  projectedProgress: ProgressProjection;

  // Status
  isActive: boolean;
}

// Training paces based on VDOT
export interface TrainingPaces {
  easy: { min: number; max: number }; // sec/km
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}

// Fitness estimate
export interface FitnessEstimate {
  vdot: number; // VO2max estimate
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  weeklyVolume: number; // km per week average
  avgPace: number; // average pace over recent runs
  trend: 'improving' | 'stable' | 'declining';
}
