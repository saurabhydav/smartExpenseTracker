# Expense Tracker Mobile App

React Native mobile application for expense tracking with local-first architecture.

## Prerequisites

- Node.js 18+
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

## Quick Start

```bash
# Install dependencies
npm install

# Install iOS pods (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Project Structure

```
src/
├── database/       # SQLite schema and operations
├── screens/        # React Native screens
├── services/       # API, Auth, SMS parsing
├── store/          # Zustand state management
└── utils/          # Helpers and constants
```

## Features

- 🔐 Biometric authentication
- 📱 SMS parsing for automatic expense entry
- 📊 Category-based spending breakdown
- 💰 Monthly budgets and tracking
- 🔄 Local-first with cloud backup

## Configuration

Update `src/services/api.ts` to point to your backend:
```typescript
const API_BASE_URL = 'http://your-backend-url:8080';
```

## Permissions Required

- SMS reading (Android only - for auto expense detection)
- Biometric authentication
- Network access
