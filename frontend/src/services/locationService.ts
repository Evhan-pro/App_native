import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Background location task name
export const BACKGROUND_LOCATION_TASK = 'STRIVE_BACKGROUND_LOCATION';

// Storage keys
const LOCATION_STORAGE_KEY = '@strive_background_locations';
const SESSION_STORAGE_KEY = '@strive_session_data';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: Date;
}

export interface SessionData {
  isActive: boolean;
  isPaused: boolean;
  activityType: string;
  startTime: string | null;
  pausedDuration: number;
  lastPauseTime: string | null;
}

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    // Get current session state
    const sessionDataStr = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    const sessionData: SessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null;
    
    // Only save if session is active and not paused
    if (sessionData?.isActive && !sessionData?.isPaused) {
      const newPoints: GPSPoint[] = locations.map((loc) => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        timestamp: new Date(loc.timestamp),
      }));

      // Get existing points
      const existingStr = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      const existingPoints: GPSPoint[] = existingStr ? JSON.parse(existingStr) : [];

      // Add new points
      const allPoints = [...existingPoints, ...newPoints];
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(allPoints));
      
      console.log(`Background: Added ${newPoints.length} points. Total: ${allPoints.length}`);
    }
  }
});

class LocationService {
  private isTracking = false;

  // Start background location tracking
  async startBackgroundTracking(activityType: string): Promise<boolean> {
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('Foreground location permission denied');
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission denied - tracking may stop when app is backgrounded');
      }

      // Initialize session data
      const sessionData: SessionData = {
        isActive: true,
        isPaused: false,
        activityType,
        startTime: new Date().toISOString(),
        pausedDuration: 0,
        lastPauseTime: null,
      };
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

      // Clear previous location data
      await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000, // Update every 2 seconds
        distanceInterval: 5, // Or every 5 meters
        foregroundService: {
          notificationTitle: 'Strive - Enregistrement en cours',
          notificationBody: `${this.getActivityLabel(activityType)} - GPS actif`,
          notificationColor: '#00D26A',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
      });

      this.isTracking = true;
      console.log('Background location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting background tracking:', error);
      return false;
    }
  }

  // Pause tracking
  async pauseTracking(): Promise<void> {
    const sessionDataStr = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionDataStr) {
      const sessionData: SessionData = JSON.parse(sessionDataStr);
      sessionData.isPaused = true;
      sessionData.lastPauseTime = new Date().toISOString();
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      console.log('Tracking paused');
    }
  }

  // Resume tracking
  async resumeTracking(): Promise<void> {
    const sessionDataStr = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionDataStr) {
      const sessionData: SessionData = JSON.parse(sessionDataStr);
      
      // Calculate paused duration
      if (sessionData.lastPauseTime) {
        const pauseStart = new Date(sessionData.lastPauseTime).getTime();
        const now = Date.now();
        sessionData.pausedDuration += Math.floor((now - pauseStart) / 1000);
      }
      
      sessionData.isPaused = false;
      sessionData.lastPauseTime = null;
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      console.log('Tracking resumed');
    }
  }

  // Stop background location tracking
  async stopBackgroundTracking(): Promise<GPSPoint[]> {
    try {
      // Check if task is running
      const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }

      // Get all collected points
      const pointsStr = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      const points: GPSPoint[] = pointsStr ? JSON.parse(pointsStr) : [];

      // Clear storage
      await AsyncStorage.removeItem(LOCATION_STORAGE_KEY);
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);

      this.isTracking = false;
      console.log(`Background tracking stopped. Collected ${points.length} points`);
      return points;
    } catch (error) {
      console.error('Error stopping background tracking:', error);
      return [];
    }
  }

  // Get current session data
  async getSessionData(): Promise<SessionData | null> {
    const sessionDataStr = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    return sessionDataStr ? JSON.parse(sessionDataStr) : null;
  }

  // Get collected points
  async getCollectedPoints(): Promise<GPSPoint[]> {
    const pointsStr = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
    return pointsStr ? JSON.parse(pointsStr) : [];
  }

  // Check if tracking is active
  async isTrackingActive(): Promise<boolean> {
    return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  }

  // Get activity label
  private getActivityLabel(type: string): string {
    const labels: Record<string, string> = {
      running: 'Course',
      cycling: 'Vélo',
      walking: 'Marche',
      hiking: 'Randonnée',
    };
    return labels[type] || type;
  }
}

export const locationService = new LocationService();
