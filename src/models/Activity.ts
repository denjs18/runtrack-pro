import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGPSPoint {
  lat: number;
  lng: number;
  alt: number | null;
  speed: number | null;
  accuracy: number;
  timestamp: number;
}

export interface IActivityStats {
  distance: number;
  duration: number;
  avgPace: number;
  avgSpeed: number;
  maxSpeed: number;
  elevationGain: number;
  currentPace: number;
  currentSpeed: number;
}

export interface IActivity extends Document {
  userId: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  points: IGPSPoint[];
  stats: IActivityStats;
  createdAt: Date;
  updatedAt: Date;
}

const GPSPointSchema = new Schema<IGPSPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    alt: { type: Number, default: null },
    speed: { type: Number, default: null },
    accuracy: { type: Number, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false }
);

const ActivityStatsSchema = new Schema<IActivityStats>(
  {
    distance: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    avgPace: { type: Number, default: 0 },
    avgSpeed: { type: Number, default: 0 },
    maxSpeed: { type: Number, default: 0 },
    elevationGain: { type: Number, default: 0 },
    currentPace: { type: Number, default: 0 },
    currentSpeed: { type: Number, default: 0 },
  },
  { _id: false }
);

const ActivitySchema = new Schema<IActivity>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date },
    points: { type: [GPSPointSchema], default: [] },
    stats: { type: ActivityStatsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
ActivitySchema.index({ userId: 1, startTime: -1 });

const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;
