# Multi-Tenant POS System

A modern Point-of-Sale system designed to support multiple businesses on one platform with complete data separation and security.

## Features

### Cashier Level (Staff Access)
- Fast transaction processing
- Quick-action dashboard
- Intelligent product search
- Multiple payment methods (Cash, Mobile Money, Split)
- Hold cart functionality
- Daily sales reports
- Expense recording

### Admin Level (Owner/Manager Access)
- Real-time financial dashboard
- Inventory management
- Staff management
- Audit trail and security logs
- Profit & Loss reports
- Subscription management

### Multi-Tenant Architecture
- Complete data isolation per business
- Subscription-based access control
- Centralized updates

## Tech Stack

- **Backend:** Node.js, Express.js, Prisma ORM
- **Frontend:** React.js
- **Database:** PostgreSQL
- **Authentication:** JWT

## Setup

1. Install dependencies:
```bash
npm run install-all
```

2. Set up database:
- Create a PostgreSQL database
- Update `.env` with your database connection string

3. Run database migrations:
```bash
npx prisma migrate dev
```

4. Start development servers:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the root directory:

```
DATABASE_URL="postgresql://user:password@localhost:5432/pos_db"
JWT_SECRET="your-secret-key-here"
PORT=5000
```

Also create a `client/.env` file (optional, defaults to localhost:5000):

```
REACT_APP_API_URL=http://localhost:5000/api
```

## Quick Start

1. **Install dependencies:**
```bash
npm run install-all
```

2. **Set up database:**
   - Create a PostgreSQL database
   - Update `.env` with your database credentials
   - Run migrations: `npm run db:migrate`
   - Seed sample data: `npm run db:seed`

3. **Start development servers:**
```bash
npm run dev
```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Sample Login Credentials

After running the seed script:

**Tenant 1: Trim N Fade Salon**
- Admin: `admin` / `admin123`
- Cashier: `cashier1` / `cashier123`

**Tenant 2: Eddiko Systems**
- Admin: `admin` / `admin123`

## Features Implemented

✅ **Multi-tenant architecture** - Complete data isolation per business
✅ **Role-based access control** - Cashier and Admin roles with proper permissions
✅ **Sales & Checkout** - Full transaction processing with multiple payment methods
✅ **Inventory Management** - Product/service management with stock tracking
✅ **Financial Reports** - Real-time dashboard, profit/loss, sales trends
✅ **Staff Management** - User creation, activation, password reset
✅ **Expense Tracking** - Record and track business expenses
✅ **Audit Logging** - Complete activity trail for security
✅ **Subscription Management** - Automatic system locking on expiry
✅ **Quick Actions** - Fast-access buttons for popular items
✅ **Hold Cart** - Pause and resume transactions
✅ **Search & Filter** - Find products by name, category, or barcode

## Security Features

- JWT-based authentication
- Password hashing (bcrypt)
- Row-level multi-tenant security
- Role-based authorization
- Audit trail for sensitive actions
- Subscription expiry checks
- Data isolation between tenants

## Documentation

See [SETUP.md](SETUP.md) for detailed setup instructions.
