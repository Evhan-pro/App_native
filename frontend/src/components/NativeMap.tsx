import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../constants/theme';

interface NativeMapProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  coordinates: Array<{ latitude: number; longitude: number }>;
  activityColor: string;
  showStartMarker?: boolean;
  showEndMarker?: boolean;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
  onRegionChange?: (region: any) => void;
  mapRef?: React.RefObject<any>;
  style?: any;
}

export default function NativeMap({
  region,
  coordinates,
  activityColor,
  showStartMarker = true,
  showEndMarker = false,
  style,
}: NativeMapProps) {
  
  // Convert coordinates to JSON for the WebView
  const coordsJson = JSON.stringify(coordinates);
  
  // Calculate zoom level from delta
  const zoom = useMemo(() => {
    const delta = Math.max(region.latitudeDelta, region.longitudeDelta);
    if (delta > 0.1) return 12;
    if (delta > 0.05) return 13;
    if (delta > 0.02) return 14;
    if (delta > 0.01) return 15;
    if (delta > 0.005) return 16;
    return 17;
  }, [region.latitudeDelta, region.longitudeDelta]);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { 
      width: 100%; 
      height: 100%; 
      background: ${COLORS.surface};
    }
    .leaflet-control-attribution { display: none; }
    .custom-marker {
      background: none;
      border: none;
    }
    .start-marker {
      width: 24px;
      height: 24px;
      background: #4CAF50;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .end-marker {
      width: 24px;
      height: 24px;
      background: #F44336;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .current-marker {
      width: 16px;
      height: 16px;
      background: ${activityColor || COLORS.primary};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const coords = ${coordsJson};
    const center = [${region.latitude}, ${region.longitude}];
    const zoom = ${zoom};
    const activityColor = '${activityColor || COLORS.primary}';
    const showStart = ${showStartMarker};
    const showEnd = ${showEndMarker};
    
    // Initialize map with dark tiles
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView(center, zoom);
    
    // Dark map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);
    
    // Draw polyline if we have coordinates
    if (coords.length > 1) {
      const latlngs = coords.map(c => [c.latitude, c.longitude]);
      
      // Draw path
      L.polyline(latlngs, {
        color: activityColor,
        weight: 4,
        opacity: 0.9,
        smoothFactor: 1
      }).addTo(map);
      
      // Start marker
      if (showStart && coords.length > 0) {
        const startIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="start-marker"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        L.marker([coords[0].latitude, coords[0].longitude], { icon: startIcon })
          .bindPopup('Départ')
          .addTo(map);
      }
      
      // End marker
      if (showEnd && coords.length > 1) {
        const endIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="end-marker"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        L.marker([coords[coords.length-1].latitude, coords[coords.length-1].longitude], { icon: endIcon })
          .bindPopup('Arrivée')
          .addTo(map);
      }
      
      // Fit bounds to show entire path
      map.fitBounds(latlngs, { padding: [30, 30] });
    } else if (coords.length === 1) {
      // Single point - show current position
      const currentIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="current-marker"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([coords[0].latitude, coords[0].longitude], { icon: currentIcon })
        .addTo(map);
    }
  </script>
</body>
</html>
`;

  if (Platform.OS === 'web') {
    // For web, we could use an iframe or a different approach
    return (
      <View style={[styles.container, style]}>
        <View style={styles.webFallback}>
          {/* Simple fallback for web preview */}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webFallback: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
});
