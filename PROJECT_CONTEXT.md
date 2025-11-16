# TrustiChain Backend - Project Context

## Project Overview

**TrustiChain** is a comprehensive blockchain escrow service platform built on the XRP Ledger (XRPL). The platform enables secure peer-to-peer and business-to-business transactions with multi-currency support, automated dispute resolution, and compliance features.

## Tech Stack

- **Backend API**: Node.js + TypeScript
- **Database & Backend Services**: Supabase (PostgreSQL database, Auth, Storage, etc.)
- **Smart Contracts**: Rust (XRPL smart contracts/Hooks)
- **Blockchain Network**: XRPL (XRP Ledger)
- **Deployment**: Normal deployment (no Docker)

## Development Priority

**Phase 1 - Personal Escrow** (Starting Point)
- Personal peer-to-peer escrow features
- User wallet and dashboard basics
- Core escrow functionality

**Phase 2 - Business Escrow Suite** (Future)
- B2B payment automation
- Advanced business features

---

## Core Features

### Personal Escrow
Secure peer-to-peer escrow for:
- **Social Media Account Sales**: Secure transactions for social media account transfers
- **Digital Goods & NFT Transactions**: Escrow protection for digital asset sales
- **Freelance Service Payments**: Secure payment holding for service delivery
- **Multi-Currency Escrow**: Support for XRP, stablecoins (USDT, USDC), and major crypto assets
- **Peer-to-Peer Escrow Wallet**: Safe transaction platform for individuals, freelancers, traders, and digital sellers

### Business Escrow Suite
End-to-end B2B payment automation with smart contract-backed agreements:
- **Supplier Settlements**: Automated supplier payment processing
- **International Trade**: Cross-border trade finance solutions
- **Contract-based Deliverables**: Smart contract enforcement for business agreements

### Remittance Services
Cross-border transfers leveraging XRP's low fees and instant settlement:
- Global remittances
- Family support transfers
- Small business international payments

### Dispute Resolution
Multi-tier resolution system:
- **Tier 1**: Automated resolution
- **Tier 2**: Mediation
- **Tier 3**: Arbitration
- On-chain evidence recording
- Neutral arbitration DAO for fairness

### Compliance Layer
- **KYC/AML Integration**: Third-party providers (e.g., Sumsub or Synapse)
- **Geo-compliance**: FATF standards adherence
- **Audit-ready Transaction Logging**: Complete transaction history and compliance records

### User Wallet & Dashboard
- Wallet for holding XRP and supported tokens
- Unified dashboard for escrow tracking, transaction history, and trust scores
- Cross-platform access (Web, Android, iOS)

---

## Extended Features

### Multi-Currency Escrow
- Support for XRP, stablecoins, and major tokens (USDT, USDC, ETH)
- Enables secure holding and release of funds in different currencies

### Milestone Payments
- Partial fund release based on project or delivery stages
- Project-based payment automation

### Reputation & Trust Scores
- Smart reputation algorithm
- Measures transaction reliability and dispute history
- Trust scoring system for users

### Multi-Sig Escrow Wallets
- 2-of-3 or 3-of-5 multisig wallets for enhanced security
- Business-grade security for high-value transactions

### Bidding Marketplace
- Escrow-protected offers for assets, services, and digital goods
- Marketplace with built-in escrow protection

### Crypto-Backed Loans
- Users can lock crypto as collateral
- Instant stablecoin loans

### TrustiChain Cards (POS Integration)
- Debit/virtual cards for real-world usage
- Use wallet or escrow funds via card payments

### Ticketing & Events
- Escrow-secured payments for event tickets, concerts, or travel bookings
- Secure ticket purchase transactions

---

## TrustiChain Business Suite (Future)

### B2B Escrow Tools
- Blockchain-secured supplier payments and trade finance

### Payroll Escrow
- Smart contract-based automated salary distribution globally

### Subscription Escrow
- Secure recurring payments for SaaS and service-based models

### API/SDK for Businesses
- Plug-and-play escrow integration for marketplaces and fintechs

### Escrow Accounting Dashboard
- Real-time analytics
- Compliance reports
- Cashflow visualization

### White-Label Escrow-as-a-Service
- Fully branded escrow infrastructure for enterprises

### Compliance & Legal Layer
- Built-in smart contracts for terms
- KYC/AML monitoring
- Digital agreements

---

## Architecture Decisions

### Wallet Integration Approach (Hybrid)

**1. Non-Custodial Wallets** (Personal Escrow - P2P)
- Users control their own private keys
- Direct wallet connection (e.g., Xaman, MetaMask for XRPL, Ledger)
- Backend facilitates transactions via user signatures
- **Rationale**: Better security, regulatory clarity, user ownership
- **Use Cases**: Individual P2P escrow transactions, personal accounts

**2. Custodial Multisig Wallets** (Business Suite)
- Backend-managed encrypted key storage
- Automated transaction signing for business workflows
- Multisig security (2-of-3 or 3-of-5)
- **Rationale**: Better UX for automation, API integration, business needs
- **Use Cases**: B2B escrow, automated payments, API integrations

### Payment Token Support

**Supported Tokens:**
- **Native XRP**: Primary currency, lowest fees, fastest settlement
- **XRPL Tokens**: USDT, USDC, and other tokens issued on XRPL
- **Multi-Currency Support**: Enables escrow in different currencies

**Rationale:**
- Stablecoins essential for price stability in escrow
- Multi-currency requirement for global platform
- XRPL natively supports both XRP and tokens via trust lines

**Implementation Notes:**
- Requires trust line management for tokens
- Token issuer verification needed
- Balance tracking for multiple currencies

---

## XRPL-Specific Considerations

### Smart Contracts
- Using Rust for XRPL smart contracts/Hooks
- Native XRPL features: Escrows, Payment Channels, Trust Lines
- Consider Hooks for programmatic transaction logic

### Transaction Types
- **EscrowCreate**: Create escrow transactions
- **EscrowFinish**: Release escrow funds
- **EscrowCancel**: Cancel escrow (with conditions)
- **Payment**: XRP and token transfers
- **TrustSet**: Manage trust lines for tokens

### Account Management
- Account reserves (XRP minimum balances)
- Transaction fees in XRP (very low on XRPL)
- Multi-signing support for security

---

## Security Considerations

### Key Management
- **Non-Custodial**: Keys never leave user devices
- **Custodial**: Encrypted storage, HSM consideration, secure key rotation
- **Multisig**: Multiple signatures required for high-value transactions

### Compliance
- KYC/AML integration points ready
- Transaction logging for audit trails
- Geo-compliance checking
- FATF standards adherence

### Smart Contract Security
- Rust smart contract audits
- Multi-signature verification
- Escrow condition validation
- Dispute resolution on-chain evidence

---

## Development Workflow

1. **Start with Personal Escrow**
   - Basic wallet integration (non-custodial)
   - Simple escrow create/finish/cancel
   - XRP support first
   - User dashboard basics

2. **Expand to Multi-Currency**
   - Trust line management
   - Token support (USDT, USDC)
   - Multi-currency escrow logic

3. **Add Advanced Features**
   - Milestone payments
   - Dispute resolution
   - Reputation system

4. **Business Suite** (Future)
   - Custodial wallet system
   - Multisig implementation
   - B2B automation

---

## API Framework Decision

**Pending Decision**: Express, NestJS, or Fastify
- Need to determine based on project complexity and team preference

## Supabase Integration

- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (can integrate with wallet-based auth)
- **Storage**: Supabase Storage (for documents, evidence files, etc.)
- **Real-time**: Supabase Realtime (for transaction updates, notifications)
- **Edge Functions**: Supabase Edge Functions (if needed for serverless functions)

---

## Notes

- All architectural decisions documented here are agreed upon and should be referenced for consistency
- Wallet approach: Hybrid (non-custodial for P2P, custodial for business)
- Payment tokens: XRP + XRPL tokens (both supported)
- Development starts with Personal Escrow features

---

*Last Updated: Updated with Supabase integration and deployment approach*
*This file should be referenced at the start of new development sessions to maintain context and consistency.*

