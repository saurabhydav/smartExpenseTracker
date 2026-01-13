# Expense Tracker Backend

Spring Boot backend service for the Expense Tracker application.

## Prerequisites

- Java 17+
- Maven 3.8+
- (Optional) MySQL 8.0+ for production
- (Optional) Apache Kafka for event streaming

## Quick Start

```bash
# Run with H2 database (default for development)
./mvnw spring-boot:run

# Or build and run
./mvnw clean package
java -jar target/expense-tracker-backend-1.0.0.jar
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login and get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/health` | Health check |

### Request Examples

**Signup:**
```json
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Login:**
```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

## Configuration

Environment variables:
- `JWT_SECRET` - JWT signing secret (required in production)
- `SPRING_DATASOURCE_URL` - Database URL
- `KAFKA_ENABLED` - Enable Kafka (default: false)

## H2 Console

Access at: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:expensetracker`
- Username: `sa`
- Password: (empty)
