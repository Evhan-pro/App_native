export const COLORS = {
  // Primary colors
  primary: '#00D26A',
  primaryLight: '#33DD88',
  primaryDark: '#00A855',
  
  // Secondary colors (orange accent)
  secondary: '#FF6B35',
  secondaryLight: '#FF8F66',
  secondaryDark: '#E55520',
  
  // Background colors
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceLight: '#252525',
  surfaceLighter: '#333333',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#666666',
  
  // Status colors
  success: '#00D26A',
  warning: '#FFB800',
  error: '#FF4757',
  info: '#3498DB',
  
  // Activity type colors
  running: '#00D26A',
  cycling: '#FF6B35',
  walking: '#3498DB',
  hiking: '#9B59B6',
  
  // Transparent
  overlay: 'rgba(0, 0, 0, 0.7)',
  cardOverlay: 'rgba(26, 26, 26, 0.95)',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 48,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 8,
  },
};

export const ACTIVITY_TYPES = [
  { id: 'running', label: 'Course', icon: 'directions-run', color: COLORS.running },
  { id: 'cycling', label: 'Vélo', icon: 'directions-bike', color: COLORS.cycling },
  { id: 'walking', label: 'Marche', icon: 'directions-walk', color: COLORS.walking },
  { id: 'hiking', label: 'Randonnée', icon: 'terrain', color: COLORS.hiking },
];
