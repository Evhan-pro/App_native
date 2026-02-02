import { MongoClient, Db, Collection } from 'mongodb';
import { User, Activity } from './types';

let client: MongoClient;
let db: Db;

export interface Collections {
  users: Collection<User>;
  activities: Collection<Activity>;
}

export async function connectToDatabase(): Promise<Collections> {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'strive_db';

  client = new MongoClient(mongoUrl);
  await client.connect();
  
  db = client.db(dbName);
  
  console.log(`✅ Connected to MongoDB: ${dbName}`);

  return {
    users: db.collection<User>('users'),
    activities: db.collection<Activity>('activities'),
  };
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

export function getDb(): Db {
  return db;
}
