# TrustiChain Backend - Folder Structure

## Project Structure Overview

```
trustichainBackend/
├── docs/                          # Documentation files
├── scripts/                       # Utility and deployment scripts
├── supabase/                      # Supabase configuration
│   ├── migrations/                # Database migrations
│   └── functions/                 # Supabase Edge Functions (if needed)
├── src/                           # Main source code
│   ├── config/                    # Configuration files (env, database, etc.)
│   ├── controllers/               # API route controllers
│   ├── middleware/                # Express/NestJS middleware (auth, validation, error handling)
│   ├── models/                    # Data models and schemas
│   ├── routes/                    # API route definitions
│   ├── services/                  # Business logic layer
│   │   ├── compliance/            # KYC/AML compliance services
│   │   ├── dispute/               # Dispute resolution services
│   │   ├── escrow/                # Escrow business logic
│   │   ├── remittance/            # Remittance services
│   │   └── wallet/                # Wallet management services
│   ├── supabase/                  # Supabase client setup and helpers
│   ├── types/                     # TypeScript type definitions
│   │   ├── api/                   # API request/response types
│   │   ├── database/              # Database schema types
│   │   └── xrpl/                  # XRPL-related types
│   ├── utils/                     # Utility functions and helpers
│   ├── xrpl/                      # XRPL integration code
│   │   ├── escrow/                # XRPL escrow transaction handlers
│   │   ├── transactions/          # XRPL transaction utilities
│   │   └── wallet/                # XRPL wallet integration
│   └── smart-contracts/           # Rust smart contracts (XRPL Hooks)
├── tests/                         # Test files
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
└── PROJECT_CONTEXT.md             # Project documentation and context

```

## Folder Descriptions

### `/src`
Main application source code.

### `/src/config`
- Environment configuration
- Database connection setup
- Supabase client initialization
- XRPL network configuration

### `/src/controllers`
- Handle HTTP requests/responses
- Input validation
- Call services and return responses

### `/src/middleware`
- Authentication middleware
- Authorization checks
- Request validation
- Error handling
- Rate limiting
- Logging

### `/src/models`
- Database models/schemas
- Data validation schemas (Zod, Joi, etc.)

### `/src/routes`
- API endpoint definitions
- Route grouping and organization

### `/src/services`
Business logic layer organized by feature:

- **`escrow/`**: Escrow creation, release, cancellation logic
- **`wallet/`**: Wallet management, balance tracking
- **`dispute/`**: Dispute creation, mediation, arbitration
- **`compliance/`**: KYC/AML integration and checks
- **`remittance/`**: Cross-border payment processing

### `/src/supabase`
- Supabase client setup
- Database helpers
- Auth utilities
- Storage helpers

### `/src/types`
TypeScript type definitions organized by domain:
- **`api/`**: Request/response types for API endpoints
- **`database/`**: Database table types (generated from Supabase)
- **`xrpl/`**: XRPL transaction and account types

### `/src/utils`
- Common utility functions
- Helpers for formatting, validation, etc.
- Shared constants

### `/src/xrpl`
XRPL blockchain integration:
- **`transactions/`**: Transaction builders and signers
- **`wallet/`**: Wallet connection and key management
- **`escrow/`**: XRPL EscrowCreate, EscrowFinish, EscrowCancel handlers

### `/src/smart-contracts`
- Rust source code for XRPL smart contracts/Hooks
- Contract compilation and deployment scripts

### `/supabase`
- **`migrations/`**: SQL migration files for database schema
- **`functions/`**: Supabase Edge Functions (serverless functions)

### `/tests`
- **`unit/`**: Unit tests for individual functions/classes
- **`integration/`**: Integration tests for API endpoints
- **`e2e/`**: End-to-end tests for complete workflows

### `/docs`
- API documentation
- Architecture diagrams
- Development guides

### `/scripts`
- Deployment scripts
- Database seed scripts
- Utility scripts

---

*This structure is designed to be scalable and organized by feature and concern. As the project grows, you can add more folders and organize code as needed.*

