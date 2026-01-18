# Multi-Tenant POS System - Setup Guide

## Prerequisites

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)
3. **npm** (comes with Node.js) or **yarn**

## Initial Setup

### 1. Install Dependencies

```bash
# Install backend and frontend dependencies
npm run install-all
```

### 2. Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE pos_db;
```

2. Update the `.env` file in the root directory with your database credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/pos_db"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=5000
```

### 3. Database Migration

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

This will create:
- Two sample tenants (Trim N Fade Salon, Eddiko Systems)
- Admin users (username: `admin`, password: `admin123`)
- Cashier user for Salon (username: `cashier1`, password: `cashier123`)
- Sample products for each tenant

### 4. Start Development Servers

```bash
# Start both backend and frontend servers
npm run dev
```

Or start them separately:

```bash
# Terminal 1: Backend server (runs on http://localhost:5000)
npm run server

# Terminal 2: Frontend server (runs on http://localhost:3000)
npm run client
```

## Accessing the Application

1. Open your browser and navigate to `http://localhost:3000`
2. Login with one of the sample credentials:

### Tenant 1: Trim N Fade Salon
- **Admin**: username: `admin`, password: `admin123`
- **Cashier**: username: `cashier1`, password: `cashier123`

### Tenant 2: Eddiko Systems
- **Admin**: username: `admin`, password: `admin123`

## Testing Multi-Tenancy

1. Login as `admin` from Tenant 1 (Salon)
2. You'll only see salon-related products and data
3. Logout and login as `admin` from Tenant 2 (Electronics)
4. You'll only see electronics-related products and data
5. Data is completely isolated between tenants

## Default Ports

- **Backend API**: `http://localhost:5000`
- **Frontend**: `http://localhost:3000`

Update `REACT_APP_API_URL` in `client/.env` if you need to change the backend URL.

## Useful Commands

```bash
# Database commands
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio (database GUI)

# Development
npm run dev              # Start both servers
npm run server           # Backend only
npm run client           # Frontend only

# Production
npm run build            # Build frontend for production
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check that the database exists

### Port Already in Use
- Change `PORT` in `.env` for backend
- Change port in `client/package.json` scripts for frontend

### Missing Dependencies
- Run `npm install` in root directory
- Run `npm install` in `client` directory

## Project Structure

```
MgtSys/
├── server/                 # Backend (Express.js)
│   ├── index.js           # Main server file
│   ├── routes/            # API routes
│   ├── middleware/        # Authentication & validation
│   └── ...
├── client/                # Frontend (React.js)
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── api/           # API service layer
│   │   ├── context/       # React context (Auth)
│   │   └── ...
│   └── ...
├── prisma/                # Database schema
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Seed data
└── package.json
```

## Security Notes

⚠️ **Important for Production:**

1. Change `JWT_SECRET` to a strong random string
2. Use environment variables for all sensitive data
3. Enable HTTPS in production
4. Implement rate limiting
5. Add input validation and sanitization
6. Use a strong database password
7. Regularly update dependencies

## Support

For issues or questions, refer to the main README.md file.
