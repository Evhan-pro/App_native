import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COLORS, SPACING, BORDER_RADIUS, FONTS, ACTIVITY_TYPES } from '../../src/constants/theme';
import api from '../../src/services/api';
import NativeMap from '../../src/components/NativeMap';

interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
}

interface Activity {
  id: string;
  activity_type: string;
  gps_points: GPSPoint[];
  distance: number;
  duration: number;
  avg_speed: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

const { width } = Dimensions.get('window');

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadActivity();
  }, [id]);

  const loadActivity = async () => {
    try {
      const response = await api.get(`/activities/${id}`);
      setActivity(response.data);
    } catch (error) {
      console.error('Error loading activity:', error);
      Alert.alert('Erreur', "Impossible de charger l'activité", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer l'activité",
      'Êtes-vous sûr de vouloir supprimer cette activité ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await api.delete(`/activities/${id}`);
              Alert.alert('Succès', 'Activité supprimée', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert('Erreur', "Impossible de supprimer l'activité");
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2);
  };

  const getActivityIcon = (type: string) => {
    const actType = ACTIVITY_TYPES.find((a) => a.id === type);
    return actType?.icon || 'directions-run';
  };

  const getActivityColor = (type: string) => {
    const actType = ACTIVITY_TYPES.find((a) => a.id === type);
    return actType?.color || COLORS.primary;
  };

  const getActivityLabel = (type: string) => {
    const actType = ACTIVITY_TYPES.find((a) => a.id === type);
    return actType?.label || type;
  };

  const getMapRegion = () => {
    if (!activity || activity.gps_points.length === 0) {
      return {
        latitude: 48.8566,
        longitude: 2.3522,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const lats = activity.gps_points.map((p) => p.latitude);
    const lngs = activity.gps_points.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.5 || 0.01;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.01;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.005),
      longitudeDelta: Math.max(lngDelta, 0.005),
    };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>Activité introuvable</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activityColor = getActivityColor(activity.activity_type);
  const coordinates = activity.gps_points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détail de l'activité</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <MaterialIcons name="delete" size={24} color={COLORS.error} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Activity Type Badge */}
        <View style={[styles.activityBadge, { backgroundColor: activityColor + '20' }]}>
          <MaterialIcons
            name={getActivityIcon(activity.activity_type) as any}
            size={28}
            color={activityColor}
          />
          <Text style={[styles.activityBadgeText, { color: activityColor }]}>
            {getActivityLabel(activity.activity_type)}
          </Text>
        </View>

        {/* Date & Time */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {format(new Date(activity.start_time), "EEEE d MMMM yyyy 'à' HH:mm", {
              locale: fr,
            })}
          </Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <NativeMap
            region={getMapRegion()}
            coordinates={coordinates}
            activityColor={activityColor}
            showStartMarker={true}
            showEndMarker={true}
            showUserLocation={false}
          />
          {/* Map Legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>Départ</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendText}>Arrivée</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: activityColor }]} />
              <Text style={styles.legendText}>Parcours</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.mainStatCard}>
            <MaterialIcons name="straighten" size={32} color={activityColor} />
            <Text style={[styles.mainStatValue, { color: activityColor }]}>
              {formatDistance(activity.distance)}
            </Text>
            <Text style={styles.mainStatLabel}>kilomètres</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialIcons name="timer" size={24} color={COLORS.secondary} />
              <Text style={styles.statValue}>{formatDuration(activity.duration)}</Text>
              <Text style={styles.statLabel}>Durée</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="speed" size={24} color={COLORS.warning} />
              <Text style={styles.statValue}>{activity.avg_speed.toFixed(1)} km/h</Text>
              <Text style={styles.statLabel}>Vitesse moy.</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialIcons name="timeline" size={24} color={COLORS.info} />
              <Text style={styles.statValue}>{activity.gps_points.length}</Text>
              <Text style={styles.statLabel}>Points GPS</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="trending-up" size={24} color={COLORS.hiking} />
              <Text style={styles.statValue}>
                {activity.duration > 0
                  ? (activity.distance / activity.duration).toFixed(2)
                  : '0'}{' '}
                m/s
              </Text>
              <Text style={styles.statLabel}>Allure</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonLarge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  backButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  activityBadgeText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dateText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  mapContainer: {
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  mapLegend: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.cardOverlay,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
  },
  statsContainer: {
    gap: SPACING.sm,
  },
  mainStatCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: FONTS.sizes.display,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  mainStatLabel: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
});
