# 🧬 Smart Inheritance Protocol on Ethereum

## Overview

This project presents a secure and flexible inheritance protocol implemented as an Ethereum smart contract. It addresses the critical issue of **cryptoasset loss upon death** or **private key loss** by enabling programmable inheritance based on cryptographic signatures and time-based triggers.

It allows heirs to initiate a transfer if the original owner becomes unresponsive, while still enabling the owner to intervene during a predefined latency period.

---

## ⚙️ Motivation

Private key management in decentralized finance (DeFi) is a double-edged sword: while it ensures sovereignty, it poses a major risk in case of loss, death, or incapacitation. Millions of dollars in cryptoassets have been lost due to inaccessible keys.

This protocol aims to:
- Ensure asset continuity across generations
- Preserve the owner’s control while alive
- Minimize trust assumptions and off-chain dependencies

---

## 🧩 Design Goals

- **2-out-of-3 Heir Consensus**: At least 2 of 3 predefined heirs must agree to unlock the inheritance.
- **Owner Control**: The parent (asset holder) can:
  - Cancel or update heir keys and thresholds
  - Interrupt a pending transfer
  - Manually transfer funds at any time
- **Dead Man's Switch**: If the owner fails to intervene during the `lockPeriod`, the transfer proceeds.
- **Flexibility**:
  - Heir list and M-of-N threshold can be redefined at will
  - Destination address specified by heirs at trigger time, but made transparent early in the process
- **On-Chain Simplicity, Off-Chain Privacy**: Signatures are generated off-chain to reduce gas and avoid storing private data on-chain.

---

## 🔐 Protocol Flow

1. **Initialization**  
   - Owner deploys contract with:
     - List of heir addresses
     - Required threshold (e.g., 2-of-3)
     - Lock-in period (e.g., 30 days)

2. **Arming the Contract**  
   - 2 or more heirs generate and sign a message specifying a destination address.
   - The `arm()` function is called with:
     - A list of valid signatures
     - The destination address
   - The contract verifies:
     - That signatures are from unique, authorized heirs
     - That the threshold is met
   - If valid:
     - The contract stores the destination address and arming timestamp
     - Emits an `Armed` event

3. **Latent Waiting Period**  
   - A latency period allows the owner to cancel or override the transfer.
   - The owner can call `disarm()` during this time.

4. **Triggering the Transfer**  
   - After the lock period, anyone (even an heir or a bot) may call `triggerTransfer()`.
   - If the contract is still armed and the period elapsed, the funds are sent to the agreed-upon address.

5. **Manual Override**  
   - At any time, the owner can:
     - Manually transfer funds
     - Update heirs and threshold
     - Reset or cancel the process

---

## ✨ Features

- Configurable M-of-N heir recovery
- Owner-controlled fallback and cancellation
- Trust-minimized multi-signature scheme
- No centralized custodians or guardians
- Only one transaction needed to execute inheritance after arming
- Emits `Armed` event for off-chain watchers

---

## 🔐 Security Considerations

- Prevents single-heir fraud via threshold
- Transparency of destination address limits collusion
- Signatures are bound to a specific contract instance and destination address to prevent replay
- `usedHashes` prevents reuse of signatures
- Reconfigurable heir set reduces risk of compromise

---

## 🛠 Deployment & Usage

This project is designed to be deployed using **Hardhat**. See `/scripts` and `/test` for deployment scripts and test cases.

```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js
