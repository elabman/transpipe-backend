# TransPipe Backend

Professional workforce management and payment disbursement system built with Express.js and PostgreSQL.

## Features

- **User Management**: Registration, authentication, worker/seller creation
- **Project Management**: Project creation, supervisor assignment, material requests
- **Attendance Management**: Time tracking, ratings, status management
- **Payment Management**: Payment requests, approval workflows, disbursement
- **Security**: JWT authentication, input validation, rate limiting
- **Scalability**: Docker containerization, Kubernetes deployment ready

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL 15
- **Authentication**: JWT with bcrypt
- **Validation**: Joi
- **Logging**: Winston
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Setup environment**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup database**

   ```bash
   # Create database and run migrations
   npm run migrate
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5070`

### Docker Development

1. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

This starts both PostgreSQL and the API server with automatic database initialization.

## API Documentation

### Base URL

```
http://localhost:5070/api/v1
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### User Management

- `POST /users/register` - User registration
- `POST /users/login` - User login
- `POST /users/workers` - Create worker (protected)
- `POST /users/workers/card` - Create worker with card (protected)
- `POST /users/sellers` - Create seller (protected)

#### Health Check

- `GET /health` - Service health status

## Database Schema

The system uses a comprehensive PostgreSQL schema with:

- **Users**: Main user accounts with categories (Individual, Company, NGO, Government)
- **Workers**: Employee records with positions and assignments
- **Projects**: Project management with budgets and timelines
- **Attendance**: Daily time tracking with ratings
- **Payments**: Request and approval workflows
- **Materials**: Resource request management

## Deployment

### Kubernetes Deployment

1. **Apply Kubernetes manifests**

   ```bash
   kubectl apply -f k8s/
   ```

2. **Check deployment status**
   ```bash
   kubectl get pods -n transpipe
   ```

### Production Considerations

- Update secrets in `k8s/postgres-secret.yaml` and `k8s/app-secret.yaml`
- Configure persistent storage for production
- Set up monitoring and logging
- Configure ingress for external access
- Implement backup strategies

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Environment Variables

See `.env.example` for all available configuration options.

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation with Joi
- Rate limiting
- CORS protection
- Security headers with Helmet
- SQL injection prevention with parameterized queries

## Logging

The application uses Winston for structured logging:

- Console output in development
- File logging in production
- Error tracking and monitoring ready

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass

## License

MIT License - see LICENSE file for details
