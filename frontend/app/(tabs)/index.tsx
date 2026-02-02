import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COLORS, SPACING, BORDER_RADIUS, FONTS, ACTIVITY_TYPES } from '../../src/constants/theme';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface Activity {
  id: string;
  activity_type: string;
  distance: number;
  duration: number;
  avg_speed: number;
  start_time: string;
}

interface Stats {
  total_activities: number;
  total_distance: number;
  total_duration: number;
  avg_speed: number;
}

export default function HomeScreen() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [activitiesRes, statsRes] = await Promise.all([
        api.get('/activities?limit=10'),
        api.get('/stats'),
      ]);
      setActivities(activitiesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const getActivityIcon = (type: string) => {
    const actType = ACTIVITY_TYPES.find(a => a.id === type);
    return actType?.icon || 'directions-run';
  };

  const getActivityColor = (type: string) => {
    const actType = ACTIVITY_TYPES.find(a => a.id === type);
    return actType?.color || COLORS.primary;
  };

  const getActivityLabel = (type: string) => {
    const actType = ACTIVITY_TYPES.find(a => a.id === type);
    return actType?.label || type;
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.name || 'Athlete'}</Text>
          </View>
          <View style={styles.logoContainer}>
            <MaterialIcons name="directions-run" size={28} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardMain]}>
            <MaterialIcons name="straighten" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats?.total_distance.toFixed(1) || '0'}</Text>
            <Text style={styles.statLabel}>km total</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialIcons name="timer" size={24} color={COLORS.secondary} />
              <Text style={styles.statValueSmall}>
                {stats ? formatDuration(stats.total_duration) : '0m'}
              </Text>
              <Text style={styles.statLabelSmall}>Temps total</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="flag" size={24} color={COLORS.info} />
              <Text style={styles.statValueSmall}>{stats?.total_activities || 0}</Text>
              <Text style={styles.statLabelSmall}>Activités</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { flex: 1 }]}>
              <MaterialIcons name="speed" size={24} color={COLORS.warning} />
              <Text style={styles.statValueSmall}>
                {stats?.avg_speed.toFixed(1) || '0'} km/h
              </Text>
              <Text style={styles.statLabelSmall}>Vitesse moyenne</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activités récentes</Text>
          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="directions-run" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucune activité enregistrée</Text>
              <Text style={styles.emptySubtext}>
                Appuyez sur le bouton d'enregistrement pour commencer
              </Text>
            </View>
          ) : (
            activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => router.push(`/activity/${activity.id}`)}
              >
                <View
                  style={[
                    styles.activityIconContainer,
                    { backgroundColor: getActivityColor(activity.activity_type) + '20' },
                  ]}
                >
                  <MaterialIcons
                    name={getActivityIcon(activity.activity_type) as any}
                    size={24}
                    color={getActivityColor(activity.activity_type)}
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityType}>
                    {getActivityLabel(activity.activity_type)}
                  </Text>
                  <Text style={styles.activityDate}>
                    {format(new Date(activity.start_time), 'EEEE d MMMM', { locale: fr })}
                  </Text>
                </View>
                <View style={styles.activityStats}>
                  <Text style={styles.activityDistance}>
                    {formatDistance(activity.distance)}
                  </Text>
                  <Text style={styles.activityDuration}>
                    {formatDuration(activity.duration)}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  greeting: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
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
  statCardMain: {
    paddingVertical: SPACING.lg,
  },
  statValue: {
    fontSize: FONTS.sizes.display,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  statValueSmall: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabelSmall: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  section: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  activityType: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activityDate: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityStats: {
    alignItems: 'flex-end',
    marginRight: SPACING.sm,
  },
  activityDistance: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  activityDuration: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
});
