# Expense Tracker

A local-first, privacy-focused expense tracking application with on-device AI processing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)                 │
├─────────────────────────────────────────────────────────────┤
│  SMS Receiver       │       SQLite       │      Biometrics  │
└───────────────────────────┬─────────────────────────────────┘
                            │ Auth Only
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Spring Boot)                       │
├─────────────────────────────────────────────────────────────┤
│    Auth Service    │    Kafka Events    │    MySQL DB       │
└─────────────────────────────────────────────────────────────┘
```

## Projects

| Directory | Description |
|-----------|-------------|
| `backend/` | Spring Boot REST API for authentication |
| `mobile/` | React Native mobile application |

## Quick Start

### 1. Start Database
```bash
docker-compose up -d mysql
```

### 2. Run Backend
```bash
cd backend
./mvnw spring-boot:run
```

### 3. Run Mobile App
```bash
cd mobile
npm install
npm run android  # or npm run ios
```

## Features

- 🔐 JWT + Biometric authentication
- 📱 Automatic SMS parsing for bank transactions
- 🤖 On-device AI (Gemini Nano) for expense categorization
- 💾 Local-first SQLite storage
- ☁️ Optional Google Drive encrypted backup
- 📊 Budget tracking and analytics

## Tech Stack

Mobile:
- React Native + TypeScript
- SQLite (react-native-quick-sqlite)
- Zustand for state management
- React Navigation

Backend:
- Spring Boot 3.2
- Spring Security + JWT
- MySQL + JPA
- Apache Kafka (optional)

