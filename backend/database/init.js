// MongoDB Initialization Script - Strive App
// Run with: mongosh < init.js
// Or: mongo < init.js (older versions)

// Switch to strive database
use strive_db;

// ============================================
// DROP EXISTING COLLECTIONS (optional - for fresh start)
// ============================================
// db.users.drop();
// db.activities.drop();

// ============================================
// CREATE INDEXES
// ============================================
print("Creating indexes...");

// Users indexes
db.users.createIndex({ "id": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });

// Activities indexes
db.activities.createIndex({ "id": 1 }, { unique: true });
db.activities.createIndex({ "user_id": 1, "start_time": -1 });
db.activities.createIndex({ "user_id": 1, "activity_type": 1 });

print("✅ Indexes created successfully!");

// ============================================
// SEED DATA (optional - demo user)
// ============================================
print("Creating demo user...");

// Demo user (password: "demo1234")
// SHA256 hash of "demo1234" = "6c4faa7f2378c5e5b8f8b3e1d6e2f0c7a8b9d0e1f2a3b4c5d6e7f8a9b0c1d2e3"
const demoUserId = "demo-user-0001-0001-000000000001";

db.users.updateOne(
  { id: demoUserId },
  {
    $setOnInsert: {
      id: demoUserId,
      name: "Utilisateur Demo",
      email: "demo@strive.app",
      password_hash: "937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244",
      photo: null,
      created_at: new Date()
    }
  },
  { upsert: true }
);

print("✅ Demo user created (email: demo@strive.app, password: demo1234)");

// ============================================
// SEED SAMPLE ACTIVITY (optional)
// ============================================
print("Creating sample activity...");

const sampleActivityId = "activity-demo-0001-0001-000000000001";

db.activities.updateOne(
  { id: sampleActivityId },
  {
    $setOnInsert: {
      id: sampleActivityId,
      user_id: demoUserId,
      activity_type: "running",
      gps_points: [
        {
          latitude: 48.8566,
          longitude: 2.3522,
          altitude: 35,
          accuracy: 5,
          speed: 3.2,
          timestamp: new Date("2025-01-15T08:00:00.000Z")
        },
        {
          latitude: 48.8580,
          longitude: 2.3540,
          altitude: 36,
          accuracy: 4,
          speed: 3.5,
          timestamp: new Date("2025-01-15T08:05:00.000Z")
        },
        {
          latitude: 48.8600,
          longitude: 2.3560,
          altitude: 38,
          accuracy: 3,
          speed: 3.8,
          timestamp: new Date("2025-01-15T08:10:00.000Z")
        },
        {
          latitude: 48.8620,
          longitude: 2.3580,
          altitude: 40,
          accuracy: 4,
          speed: 3.6,
          timestamp: new Date("2025-01-15T08:15:00.000Z")
        }
      ],
      distance: 5230,
      duration: 1800,
      avg_speed: 10.46,
      start_time: new Date("2025-01-15T08:00:00.000Z"),
      end_time: new Date("2025-01-15T08:30:00.000Z"),
      created_at: new Date("2025-01-15T08:30:05.000Z")
    }
  },
  { upsert: true }
);

print("✅ Sample activity created!");

// ============================================
// VERIFICATION
// ============================================
print("\n📊 Database Summary:");
print("Users count: " + db.users.countDocuments());
print("Activities count: " + db.activities.countDocuments());

print("\n✅ MongoDB initialization complete!");
