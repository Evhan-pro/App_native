import { Platform } from 'react-native';

// Live Activity types
export interface LiveActivityState {
  activityType: string;
  distance: number; // meters
  duration: number; // seconds
  currentSpeed: number; // km/h
  isPaused: boolean;
  startTime: number; // timestamp
}

// Check if Live Activities are supported
let LiveActivity: any = null;
let isLiveActivitySupported = false;

if (Platform.OS === 'ios') {
  try {
    LiveActivity = require('expo-live-activity').default;
    isLiveActivitySupported = true;
  } catch (e) {
    console.log('Live Activity not available - requires development build');
  }
}

class LiveActivityService {
  private currentActivityId: string | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  // Check if Live Activities are available
  isAvailable(): boolean {
    if (!isLiveActivitySupported || !LiveActivity) {
      return false;
    }
    try {
      return LiveActivity.areActivitiesEnabled?.() ?? false;
    } catch {
      return false;
    }
  }

  // Format duration for display
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Format distance for display
  private formatDistance(meters: number): string {
    return (meters / 1000).toFixed(2);
  }

  // Get activity emoji
  private getActivityEmoji(type: string): string {
    const emojis: Record<string, string> = {
      running: '🏃',
      cycling: '🚴',
      walking: '🚶',
      hiking: '🥾',
    };
    return emojis[type] || '🏃';
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

  // Start Live Activity
  async start(state: LiveActivityState): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('Live Activity not available');
      return false;
    }

    try {
      const activityState = {
        title: `${this.getActivityEmoji(state.activityType)} ${this.getActivityLabel(state.activityType)}`,
        subtitle: state.isPaused ? '⏸ En pause' : '● Enregistrement',
        progressBar: {
          date: state.startTime,
        },
        // Custom attributes for the Live Activity
        distance: this.formatDistance(state.distance),
        duration: this.formatDuration(state.duration),
        speed: state.currentSpeed.toFixed(1),
        isPaused: state.isPaused,
      };

      this.currentActivityId = await LiveActivity.start(activityState);
      console.log('Live Activity started:', this.currentActivityId);
      return true;
    } catch (error) {
      console.error('Error starting Live Activity:', error);
      return false;
    }
  }

  // Update Live Activity
  async update(state: LiveActivityState): Promise<boolean> {
    if (!this.currentActivityId || !this.isAvailable()) {
      return false;
    }

    try {
      const activityState = {
        title: `${this.getActivityEmoji(state.activityType)} ${this.getActivityLabel(state.activityType)}`,
        subtitle: state.isPaused ? '⏸ En pause' : `${this.formatDistance(state.distance)} km`,
        // Update distance and duration
        distance: this.formatDistance(state.distance),
        duration: this.formatDuration(state.duration),
        speed: state.currentSpeed.toFixed(1),
        isPaused: state.isPaused,
      };

      await LiveActivity.update(this.currentActivityId, activityState);
      return true;
    } catch (error) {
      console.error('Error updating Live Activity:', error);
      return false;
    }
  }

  // End Live Activity
  async end(finalState?: LiveActivityState): Promise<boolean> {
    if (!this.currentActivityId || !this.isAvailable()) {
      this.currentActivityId = null;
      return false;
    }

    try {
      if (finalState) {
        // Final update with completed state
        await LiveActivity.update(this.currentActivityId, {
          title: `✅ ${this.getActivityLabel(finalState.activityType)} terminée`,
          subtitle: `${this.formatDistance(finalState.distance)} km en ${this.formatDuration(finalState.duration)}`,
          distance: this.formatDistance(finalState.distance),
          duration: this.formatDuration(finalState.duration),
          speed: finalState.currentSpeed.toFixed(1),
          isPaused: false,
        });
      }

      await LiveActivity.end(this.currentActivityId);
      console.log('Live Activity ended');
      this.currentActivityId = null;
      return true;
    } catch (error) {
      console.error('Error ending Live Activity:', error);
      this.currentActivityId = null;
      return false;
    }
  }

  // Check if activity is running
  isRunning(): boolean {
    return this.currentActivityId !== null;
  }
}

export const liveActivityService = new LiveActivityService();
