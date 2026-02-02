// MongoDB Schema Documentation - Strive App
// Database: strive_db

// ============================================
// COLLECTION: users
// ============================================
// Stocke les informations des utilisateurs
{
  "id": "string (UUID)",           // Identifiant unique
  "name": "string",                 // Nom de l'utilisateur
  "email": "string",                // Email (unique, lowercase)
  "password_hash": "string",        // Mot de passe hashé (SHA256)
  "photo": "string | null",         // Photo de profil (base64)
  "created_at": "Date"              // Date de création
}

// Index recommandés:
// - { "id": 1 } (unique)
// - { "email": 1 } (unique)

// Exemple:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "password_hash": "5e884898da28047d9...",
  "photo": null,
  "created_at": "2025-01-15T10:30:00.000Z"
}


// ============================================
// COLLECTION: activities
// ============================================
// Stocke les activités sportives enregistrées
{
  "id": "string (UUID)",            // Identifiant unique
  "user_id": "string (UUID)",       // Référence vers users.id
  "activity_type": "string",        // Type: "running" | "cycling" | "walking" | "hiking"
  "gps_points": [                   // Liste des points GPS
    {
      "latitude": "number",         // Latitude (-90 à 90)
      "longitude": "number",        // Longitude (-180 à 180)
      "altitude": "number | null",  // Altitude en mètres
      "accuracy": "number | null",  // Précision GPS en mètres
      "speed": "number | null",     // Vitesse instantanée m/s
      "timestamp": "Date"           // Horodatage du point
    }
  ],
  "distance": "number",             // Distance totale en mètres
  "duration": "number",             // Durée totale en secondes
  "avg_speed": "number",            // Vitesse moyenne en km/h
  "start_time": "Date",             // Heure de début
  "end_time": "Date",               // Heure de fin
  "created_at": "Date"              // Date de création
}

// Index recommandés:
// - { "id": 1 } (unique)
// - { "user_id": 1, "start_time": -1 } (pour les requêtes par utilisateur)

// Exemple:
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "activity_type": "running",
  "gps_points": [
    {
      "latitude": 48.8566,
      "longitude": 2.3522,
      "altitude": 35,
      "accuracy": 5,
      "speed": 3.5,
      "timestamp": "2025-01-15T08:00:00.000Z"
    },
    {
      "latitude": 48.8570,
      "longitude": 2.3530,
      "altitude": 36,
      "accuracy": 4,
      "speed": 3.8,
      "timestamp": "2025-01-15T08:00:10.000Z"
    }
  ],
  "distance": 5230,
  "duration": 1800,
  "avg_speed": 10.46,
  "start_time": "2025-01-15T08:00:00.000Z",
  "end_time": "2025-01-15T08:30:00.000Z",
  "created_at": "2025-01-15T08:30:05.000Z"
}
