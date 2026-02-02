# Strive Backend - TypeScript / Express / MongoDB

## Scripts

```bash
# Development
yarn dev

# Build for production
yarn build

# Start production
yarn start
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Activities
- `POST /api/activities` - Create activity
- `GET /api/activities` - Get user activities
- `GET /api/activities/:id` - Get single activity
- `DELETE /api/activities/:id` - Delete activity

### Stats
- `GET /api/stats` - Get user statistics

### Health
- `GET /api/health` - Health check
