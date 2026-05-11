import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IActivity, defaultStats } from '@/models/Activity';

const COLLECTION_NAME = 'activities';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'anonymous';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const activitiesRef = collection(db, COLLECTION_NAME);

    // Get total count
    const countQuery = query(activitiesRef, where('userId', '==', userId));
    const countSnapshot = await getCountFromServer(countQuery);
    const total = countSnapshot.data().count;

    // Get paginated activities
    const activitiesQuery = query(
      activitiesRef,
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      firestoreLimit(limit * page)
    );

    const snapshot = await getDocs(activitiesQuery);

    // Skip documents for pagination
    const startIndex = (page - 1) * limit;
    const activities: IActivity[] = [];

    snapshot.docs.slice(startIndex, startIndex + limit).forEach((doc) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        userId: data.userId,
        name: data.name,
        startTime: data.startTime?.toDate?.() || data.startTime,
        endTime: data.endTime?.toDate?.() || data.endTime,
        points: data.points || [],
        stats: data.stats || defaultStats,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      });
    });

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.userId || !body.name || !body.startTime || !body.points) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();

    const activityData = {
      userId: body.userId,
      name: body.name,
      startTime: Timestamp.fromDate(new Date(body.startTime)),
      endTime: body.endTime ? Timestamp.fromDate(new Date(body.endTime)) : now,
      points: body.points,
      stats: body.stats || defaultStats,
      createdAt: now,
      updatedAt: now,
    };

    const activitiesRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(activitiesRef, activityData);

    return NextResponse.json(
      {
        message: 'Activity saved successfully',
        activity: {
          id: docRef.id,
          ...activityData,
          startTime: new Date(body.startTime),
          endTime: body.endTime ? new Date(body.endTime) : new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving activity:', error);
    return NextResponse.json(
      { error: 'Failed to save activity' },
      { status: 500 }
    );
  }
}
