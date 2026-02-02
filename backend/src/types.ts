// User types
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  photo: string | null;
  created_at: Date;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  photo?: string | null;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  created_at: Date;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

// GPS & Activity types
export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: Date;
}

export interface ActivityCreate {
  activity_type: string;
  gps_points: GPSPoint[];
  distance: number;
  duration: number;
  avg_speed: number;
  start_time: Date;
  end_time: Date;
}

export interface Activity {
  id: string;
  user_id: string;
  activity_type: string;
  gps_points: GPSPoint[];
  distance: number;
  duration: number;
  avg_speed: number;
  start_time: Date;
  end_time: Date;
  created_at: Date;
}

export interface GlobalStats {
  total_activities: number;
  total_distance: number;
  total_duration: number;
  avg_speed: number;
}

// JWT payload
export interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
}
