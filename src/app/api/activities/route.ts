import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Activity from '@/models/Activity';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'anonymous';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find({ userId })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments({ userId }),
    ]);

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
    await connectDB();

    const body = await request.json();

    // Validate required fields
    if (!body.userId || !body.name || !body.startTime || !body.points) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const activity = new Activity({
      userId: body.userId,
      name: body.name,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : new Date(),
      points: body.points,
      stats: body.stats || {
        distance: 0,
        duration: 0,
        avgPace: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        elevationGain: 0,
        currentPace: 0,
        currentSpeed: 0,
      },
    });

    await activity.save();

    return NextResponse.json(
      { message: 'Activity saved successfully', activity },
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
