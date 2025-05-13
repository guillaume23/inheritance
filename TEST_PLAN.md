# ✅ Test Plan for Inheritance Smart Contract

This document defines the test scenarios for the Ethereum smart contract that manages inheritance via a threshold-based Dead Man's Switch mechanism.

---

## 1. Deployment

* ✅ Contract deploys correctly with valid heir list and threshold
* ❌ Fails if heir list is empty
* ❌ Fails if threshold is zero or greater than number of heirs
* ✅ Contract starts in disarmed state, with correct initial nonce

## 2. Funding

* ✅ Contract accepts ETH sent to it
* ✅ Balance of contract increases accordingly

## 3. Arming Mechanism

* ✅ Arm works with valid threshold of signatures (e.g. 2/3)
* ✅ `destination` address is stored correctly
* ✅ `armed` state becomes true
* ✅ `Arm` event is emitted
* ❌ Fails if threshold not met (e.g. only 1/3 signatures)
* ❌ Fails if any signer is not a recognized heir
* ❌ Fails if signatures do not match message
* ❌ Fails if reused nonce (replay attack)

## 4. Disarming

* ✅ `disarm()` resets `armed` to false
* ✅ nonce is incremented
* ✅ future attempts to reuse same signatures fail
* ❌ Fails if non-owner tries to disarm

## 5. Transfer

* ✅ Transfer works only after lock-in time
* ✅ Transfer sends full balance to destination
* ✅ Emits expected transfer event 
* ❌ Fails if called before lock-in delay expires
* ❌ Fails if not armed

## 6. Replay Protection

* ✅ Reuse of previous valid signatures fails (nonce changed)
* ✅ Reuse with different destination fails (message hash mismatch)

## 7. Edge Cases

* ✅ Heirs can be changed by the parent
* ✅ Threshold can be updated
* ✅ Contract behaves correctly with threshold == N (e.g. 3/3)
* ✅ Contract behaves correctly with threshold == 1 (e.g. 1/3)

## 8. Security

* ✅ Signatures are validated with `ecrecover`
* ❌ Fails if a signature was tampered with
* ❌ Fails if duplicate signatures are used

## 9. Withdraw or Emergency

* ✅ Parent can withdraw at any time before transfer (if `withdraw()` exists)

## 10. Advanced

* ✅ Gas cost remains low across operations
* ✅ Signature encoding/decoding matches Metamask/Web3 tools
* ✅ Contract behaves correctly with 0 ETH balance
