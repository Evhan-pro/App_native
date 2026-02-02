import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  AppState,
  Dimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, BORDER_RADIUS, FONTS, ACTIVITY_TYPES } from '../../src/constants/theme';
import api from '../../src/services/api';
import NativeMap from '../../src/components/NativeMap';
import { liveActivityService } from '../../src/services/liveActivityService';

interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: Date;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

type RecordingState = 'idle' | 'recording' | 'paused';

const { width, height } = Dimensions.get('window');

// Conditional imports for native modules
let locationService: any = null;
if (Platform.OS !== 'web') {
  try {
    locationService = require('../../src/services/locationService').locationService;
  } catch (e) {
    console.log('Location service not available');
  }
}

export default function RecordScreen() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [activityType, setActivityType] = useState('running');
  const [gpsPoints, setGpsPoints] = useState<GPSPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const pausedDurationRef = useRef(0);
  const mapRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const router = useRouter();

  // Initialize on mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      checkExistingSession();
    }
    requestPermissions();
    return () => {
      cleanupTracking();
    };
  }, []);

  // App state listener for background sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (recordingState === 'recording' || recordingState === 'paused') {
          await syncBackgroundPoints();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [recordingState]);

  // Timer effect
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current.getTime()) / 1000 - pausedDurationRef.current
          );
          setDuration(elapsed);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  // Live Activity update effect - update every 3 seconds during recording
  useEffect(() => {
    let liveActivityInterval: ReturnType<typeof setInterval> | null = null;

    if (Platform.OS === 'ios' && recordingState === 'recording' && liveActivityService.isRunning()) {
      liveActivityInterval = setInterval(() => {
        liveActivityService.update({
          activityType,
          distance,
          duration,
          currentSpeed,
          isPaused: false,
          startTime: startTimeRef.current?.getTime() || Date.now(),
        });
      }, 3000); // Update every 3 seconds
    }

    return () => {
      if (liveActivityInterval) {
        clearInterval(liveActivityInterval);
      }
    };
  }, [recordingState, activityType, distance, duration, currentSpeed]);

  const checkExistingSession = async () => {
    if (!locationService) return;
    
    try {
      const session = await locationService.getSessionData();
      if (session?.isActive) {
        const points = await locationService.getCollectedPoints();
        if (points.length > 0) {
          setGpsPoints(points);
          const dist = calculateTotalDistance(points);
          setDistance(dist);
          setActivityType(session.activityType);
          
          if (session.startTime) {
            startTimeRef.current = new Date(session.startTime);
            pausedDurationRef.current = session.pausedDuration;
          }
          
          setRecordingState(session.isPaused ? 'paused' : 'recording');
          
          const lastPoint = points[points.length - 1];
          setMapRegion({
            latitude: lastPoint.latitude,
            longitude: lastPoint.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          
          if (!session.isPaused) {
            await startForegroundTracking();
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    }
  };

  const syncBackgroundPoints = async () => {
    if (!locationService) return;
    
    try {
      const points = await locationService.getCollectedPoints();
      if (points.length > gpsPoints.length) {
        setGpsPoints(points);
        const dist = calculateTotalDistance(points);
        setDistance(dist);
        
        const lastPoint = points[points.length - 1];
        setCurrentLocation(lastPoint);
        setMapRegion({
          latitude: lastPoint.latitude,
          longitude: lastPoint.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
    } catch (error) {
      console.error('Error syncing background points:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission requise',
          "L'accès à la localisation est nécessaire pour enregistrer vos activités."
        );
        return;
      }

      if (Platform.OS !== 'web') {
        try {
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus !== 'granted') {
            Alert.alert(
              'Permission arrière-plan',
              "Pour un suivi continu même écran éteint, autorisez l'accès en arrière-plan dans les paramètres."
            );
          }
        } catch (e) {
          console.log('Background permission not available');
        }
      }

      setHasPermission(true);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const newLocation: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        timestamp: new Date(location.timestamp),
      };
      
      setCurrentLocation(newLocation);
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const calculateTotalDistance = (points: GPSPoint[]): number => {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return total;
  };

  const startForegroundTracking = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          const newPoint: GPSPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            timestamp: new Date(location.timestamp),
          };

          setCurrentLocation(newPoint);

          if (location.coords.speed !== null && location.coords.speed >= 0) {
            setCurrentSpeed(location.coords.speed * 3.6);
          }

          setGpsPoints((prev) => {
            const lastPoint = prev[prev.length - 1];
            if (lastPoint) {
              const dist = calculateDistance(
                lastPoint.latitude,
                lastPoint.longitude,
                newPoint.latitude,
                newPoint.longitude
              );

              if (dist >= 5 && (newPoint.accuracy === null || newPoint.accuracy < 30)) {
                setDistance((prevDist) => prevDist + dist);
                return [...prev, newPoint];
              }
            } else {
              return [newPoint];
            }
            return prev;
          });

          setMapRegion({
            latitude: newPoint.latitude,
            longitude: newPoint.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      );
    } catch (error) {
      console.error('Error starting foreground tracking:', error);
    }
  };

  const stopForegroundTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const cleanupTracking = () => {
    stopForegroundTracking();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }

    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }

    setRecordingState('recording');
    startTimeRef.current = new Date();
    pausedDurationRef.current = 0;
    setGpsPoints([]);
    setDistance(0);
    setDuration(0);

    if (Platform.OS !== 'web' && locationService) {
      await locationService.startBackgroundTracking(activityType);
    }

    // Start Live Activity for Dynamic Island & Lock Screen
    if (Platform.OS === 'ios') {
      await liveActivityService.start({
        activityType,
        distance: 0,
        duration: 0,
        currentSpeed: 0,
        isPaused: false,
        startTime: Date.now(),
      });
    }

    await startForegroundTracking();
  };

  const handlePause = async () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([100, 100, 100]);
    }

    setRecordingState('paused');
    stopForegroundTracking();
    
    if (Platform.OS !== 'web' && locationService) {
      await locationService.pauseTracking();
    }

    // Update Live Activity to show paused state
    if (Platform.OS === 'ios') {
      await liveActivityService.update({
        activityType,
        distance,
        duration,
        currentSpeed,
        isPaused: true,
        startTime: startTimeRef.current?.getTime() || Date.now(),
      });
    }
  };

  const handleResume = async () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }

    setRecordingState('recording');
    
    if (startTimeRef.current) {
      pausedDurationRef.current = Math.floor(
        (Date.now() - startTimeRef.current.getTime()) / 1000 - duration
      );
    }
    
    if (Platform.OS !== 'web' && locationService) {
      await locationService.resumeTracking();
    }

    // Update Live Activity to show recording state
    if (Platform.OS === 'ios') {
      await liveActivityService.update({
        activityType,
        distance,
        duration,
        currentSpeed,
        isPaused: false,
        startTime: startTimeRef.current?.getTime() || Date.now(),
      });
    }
    
    await startForegroundTracking();
  };

  const handleStop = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }

    Alert.alert(
      "Terminer l'activité",
      'Que voulez-vous faire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: resetRecording,
        },
        {
          text: 'Sauvegarder',
          onPress: saveActivity,
        },
      ]
    );
  };

  const resetRecording = async () => {
    cleanupTracking();
    
    if (Platform.OS !== 'web' && locationService) {
      await locationService.stopBackgroundTracking();
    }

    // End Live Activity without saving
    if (Platform.OS === 'ios') {
      await liveActivityService.end();
    }
    
    setRecordingState('idle');
    setGpsPoints([]);
    setDistance(0);
    setDuration(0);
    setCurrentSpeed(0);
    startTimeRef.current = null;
    pausedDurationRef.current = 0;
  };

  const saveActivity = async () => {
    cleanupTracking();

    let finalPoints = gpsPoints;
    if (Platform.OS !== 'web' && locationService) {
      const backgroundPoints = await locationService.stopBackgroundTracking();
      if (backgroundPoints.length > finalPoints.length) {
        finalPoints = backgroundPoints;
      }
    }

    if (finalPoints.length < 2) {
      Alert.alert('Erreur', 'Pas assez de points GPS enregistrés. Bougez un peu plus !');
      resetRecording();
      return;
    }

    setIsSaving(true);
    try {
      const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;

      const activityData = {
        activity_type: activityType,
        gps_points: finalPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude,
          accuracy: point.accuracy,
          speed: point.speed,
          timestamp: point.timestamp instanceof Date ? point.timestamp.toISOString() : point.timestamp,
        })),
        distance: distance,
        duration: duration,
        avg_speed: avgSpeed,
        start_time: startTimeRef.current?.toISOString(),
        end_time: new Date().toISOString(),
      };

      await api.post('/activities', activityData);

      // End Live Activity with final stats
      if (Platform.OS === 'ios') {
        await liveActivityService.end({
          activityType,
          distance,
          duration,
          currentSpeed: avgSpeed,
          isPaused: false,
          startTime: startTimeRef.current?.getTime() || Date.now(),
        });
      }
      
      if (Platform.OS !== 'web') {
        Vibration.vibrate([100, 100, 100, 100, 100]);
      }
      
      Alert.alert('Succès 🎉', 'Activité sauvegardée !', [
        {
          text: 'Voir',
          onPress: () => {
            setRecordingState('idle');
            setGpsPoints([]);
            setDistance(0);
            setDuration(0);
            setCurrentSpeed(0);
            startTimeRef.current = null;
            pausedDurationRef.current = 0;
            router.push('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Erreur', "Impossible de sauvegarder l'activité.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2);
  };

  const getActivityColor = (type: string) => {
    const actType = ACTIVITY_TYPES.find((a) => a.id === type);
    return actType?.color || COLORS.primary;
  };

  const coordinates = gpsPoints.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        <NativeMap
          region={mapRegion}
          coordinates={coordinates}
          activityColor={getActivityColor(activityType)}
          showStartMarker={coordinates.length > 0}
          showUserLocation={true}
          followUserLocation={recordingState === 'recording'}
          mapRef={mapRef}
        />
        
        {/* Recording Status Overlay */}
        {recordingState !== 'idle' && (
          <View style={[styles.statusOverlay, recordingState === 'paused' && styles.statusOverlayPaused]}>
            <View style={[styles.statusDot, recordingState === 'recording' && styles.statusDotRecording]} />
            <Text style={styles.statusText}>
              {recordingState === 'recording' ? 'Enregistrement...' : '⏸ En pause'}
            </Text>
          </View>
        )}
        
        {/* GPS Counter */}
        <View style={styles.gpsCounter}>
          <MaterialIcons name="gps-fixed" size={16} color={COLORS.primary} />
          <Text style={styles.gpsCounterText}>{gpsPoints.length} pts</Text>
        </View>

        {/* Center on location button */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.centerButton}
            onPress={() => {
              if (currentLocation) {
                setMapRegion({
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                });
              }
            }}
          >
            <MaterialIcons name="my-location" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Panel */}
      <View style={styles.statsPanel}>
        {/* Activity Type Selector - Only when idle */}
        {recordingState === 'idle' && (
          <View style={styles.typeSelector}>
            {ACTIVITY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeButton,
                  activityType === type.id && {
                    backgroundColor: type.color + '30',
                    borderColor: type.color,
                  },
                ]}
                onPress={() => setActivityType(type.id)}
              >
                <MaterialIcons
                  name={type.icon as any}
                  size={24}
                  color={activityType === type.id ? type.color : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    activityType === type.id && { color: type.color },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Main Stats */}
        <View style={styles.mainStats}>
          <View style={styles.mainStatItem}>
            <Text style={[styles.mainStatValue, { color: getActivityColor(activityType) }]}>
              {formatDistance(distance)}
            </Text>
            <Text style={styles.mainStatLabel}>km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.mainStatItem}>
            <Text style={styles.mainStatValue}>{formatDuration(duration)}</Text>
            <Text style={styles.mainStatLabel}>Durée</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.mainStatItem}>
            <Text style={styles.mainStatValue}>{currentSpeed.toFixed(1)}</Text>
            <Text style={styles.mainStatLabel}>km/h</Text>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          {recordingState === 'idle' ? (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: getActivityColor(activityType) }]}
              onPress={handleStart}
            >
              <MaterialIcons name="play-arrow" size={48} color={COLORS.background} />
              <Text style={styles.startButtonText}>Démarrer</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.recordingControls}>
              {recordingState === 'recording' ? (
                <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
                  <MaterialIcons name="pause" size={36} color={COLORS.warning} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.resumeButton, { backgroundColor: getActivityColor(activityType) }]}
                  onPress={handleResume}
                >
                  <MaterialIcons name="play-arrow" size={36} color={COLORS.background} />
                </TouchableOpacity>
              )}
              
              {recordingState === 'paused' && (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={handleStop}
                  disabled={isSaving}
                >
                  <MaterialIcons name="stop" size={36} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Recording Info */}
        {recordingState !== 'idle' && (
          <View style={styles.recordingInfo}>
            <MaterialIcons 
              name={recordingState === 'recording' ? 'fiber-manual-record' : 'pause-circle-filled'} 
              size={16} 
              color={recordingState === 'recording' ? COLORS.primary : COLORS.warning} 
            />
            <Text style={styles.recordingInfoText}>
              {recordingState === 'recording' 
                ? 'GPS actif - Continuez même écran verrouillé' 
                : 'Appuyez sur ▶ pour reprendre ou ■ pour terminer'}
            </Text>
          </View>
        )}

        {/* Permission Warning */}
        {!hasPermission && recordingState === 'idle' && (
          <TouchableOpacity style={styles.permissionWarning} onPress={requestPermissions}>
            <MaterialIcons name="location-off" size={20} color={COLORS.warning} />
            <Text style={styles.permissionText}>
              Autoriser la localisation pour enregistrer
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    height: height * 0.42,
    position: 'relative',
  },
  statusOverlay: {
    position: 'absolute',
    top: SPACING.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '95',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  statusOverlayPaused: {
    backgroundColor: COLORS.warning + '95',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.textPrimary,
  },
  statusDotRecording: {
    backgroundColor: '#FF0000',
  },
  statusText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  gpsCounter: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardOverlay,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  gpsCounterText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  centerButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsPanel: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    marginTop: -SPACING.lg,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  mainStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  mainStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  mainStatLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.surfaceLighter,
  },
  controls: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  startButton: {
    width: 140,
    height: 140,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.background,
    marginTop: SPACING.xs,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.warning,
  },
  resumeButton: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.error,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  recordingInfoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  permissionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
    fontWeight: '500',
  },
});
