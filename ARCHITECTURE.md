# Architecture

This document describes the five-layer system architecture of Cestra, the workspace-to-layer mapping, the consumer transaction flow, the Move smart contract modules, and the cross-chain integration targets.

---

## System Layers

| Layer | Name | Components | Owning Team |
|-------|------|------------|-------------|
| L1 | Off-Ramp Rails | ACH pull, local currency delivery, off-ramp partner APIs | Integrations |
| L2 | Bridge Layer | CCTP V2 (Circle), Wormhole cross-chain messaging | Integrations |
| L3 | Settlement Layer | Sui Move smart contracts (`blockchain/` workspace) | Blockchain |
| L4 | Application Services | NestJS API, TypeORM, PostgreSQL (`backend/` workspace) | Backend |
| L5 | User Interface | Next.js web dashboard and business portal (`web/` workspace) | Frontend |

---

## Workspace Mapping

| Directory | Layer | Notes |
|-----------|-------|-------|
| `backend/` | L4 — Application Services | NestJS + TypeORM + PostgreSQL; orchestrates off-chain logic and exposes REST APIs |
| `blockchain/` | L3 — Settlement Layer | Sui Move smart contract package; all on-chain settlement and DeFi logic |
| `web/` | L5 — User Interface | Next.js App Router; consumer send flow and business portal |

> **L1 and L2 are implemented via third-party integrations.** L1 (Off-Ramp Rails) is provided by off-ramp partners (e.g., Kotani Pay, Flutterwave). L2 (Bridge Layer) is provided by Circle's CCTP V2 and Wormhole. Neither layer has a corresponding workspace in this repository.

---

## Transaction Flow

The following steps describe the consumer send path from app entry to local currency delivery:

1. User enters the send amount and recipient details in the Cestra web app (L5).
2. The backend (L4) initiates an ACH pull from the sender's linked bank account via the off-ramp partner API (L1).
3. Upon ACH confirmation, the backend calls the Sui Move `cestra::send` contract (L3) to mint USDsui and credit the sender's on-chain wallet.
4. The `cestra::send` Move contract executes: deducts the platform fee, applies any active rate-lock via `cestra::ratelock`, and routes funds to the recipient address.
5. If the recipient is on a different chain (Ethereum, Base, Solana, or Avalanche), the `cestra::bridge` contract invokes CCTP V2 or Wormhole (L2) to transfer USDC cross-chain.
6. The backend monitors the bridge confirmation and calls the off-ramp partner API (L1) to initiate local currency delivery to the recipient's mobile money wallet or bank account.
7. The off-ramp partner disburses local currency to the recipient.
8. The backend sends a push notification to both sender and recipient confirming delivery (L4 → L5).

---

## Smart Contract Modules

All modules reside in the `blockchain/sources/` directory under the `cestra` package.

| Module | Move Path | Purpose |
|--------|-----------|---------|
| `cestra::send` | `sources/send.move` | USDsui/USDC transfers with fee deduction and routing |
| `cestra::pool` | `sources/pool.move` | Group Send pooling: contributions, payout, refund |
| `cestra::yield` | `sources/yield.move` | Suilend interface: deposit, accrue, withdraw |
| `cestra::circle` | `sources/circle.move` | Rotating savings circle: members, schedule, payouts |
| `cestra::ratelock` | `sources/ratelock.move` | FX forward contract via DeepBook oracle |
| `cestra::compliance` | `sources/compliance.move` | On-chain blacklist, transaction limits, OFAC hooks |
| `cestra::bridge` | `sources/bridge.move` | CCTP V2 and Wormhole interface for cross-chain USDC |

---

## Cross-Chain Integrations

| Chain | Bridge Protocol | Max Processing Time |
|-------|----------------|---------------------|
| Ethereum | CCTP V2 (Circle) | 20 minutes |
| Base | CCTP V2 (Circle) | 5 minutes |
| Solana | Wormhole | 2 minutes |
| Avalanche | CCTP V2 (Circle) | 5 minutes |

> Processing times are maximum estimates under normal network conditions. CCTP V2 uses Circle's attestation service; Wormhole uses its guardian network for cross-chain message verification.
