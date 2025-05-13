// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SuccessionManager - Secure and controllable cryptoasset inheritance
/// @notice Manages asset transfer to heirs in the event of owner's death

contract SuccessionManager {
address public owner;
address[] public heirs;
uint256 public threshold;
uint256 public delayPeriod;
address public armedDestination;
uint256 public armTimestamp;
uint256 public nonce;
bool public isArmed;

mapping(address => bool) public isHeir;

/// @notice Emitted when the contract is armed for succession
/// @param destination The address where funds will be sent after the delay
/// @param timestamp The block timestamp when arming occurred
/// @param delay The duration to wait before funds can be transferred
/// @param nonce The unique identifier for this arm action
event Armed(address indexed destination, uint256 timestamp, uint256 delay, uint256 nonce);


/// @notice Emitted when the transfer occurs
/// @param destination The address where funds will be sent after the delay
/// @param timestamp The block timestamp when arming occurred
event Transferred(address indexed destination, uint256 timestamp);

/// @notice Restricts access to the contract owner
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

/// @notice Ensures the contract is not already armed
modifier notArmed() {
    require(!isArmed, "Already armed");
    _;
}

/// @notice Initializes the contract with heirs, threshold, and delay
/// @param _heirs Array of heir addresses
/// @param _threshold Minimum number of heirs required to approve a transfer
/// @param _delayPeriod Waiting period before funds can be claimed
constructor(address[] memory _heirs, uint256 _threshold, uint256 _delayPeriod) payable {
    require(_threshold > 0 && _threshold <= _heirs.length, "Invalid threshold");
    owner = msg.sender;
    heirs = _heirs;
    threshold = _threshold;
    delayPeriod = _delayPeriod;
    for (uint i = 0; i < _heirs.length; i++) {
        isHeir[_heirs[i]] = true;
    }
}

/// @notice Allows the owner to update the heirs and threshold
/// @param _newHeirs The new list of heir addresses
/// @param _newThreshold The new number of required signatures
function updateHeirs(address[] calldata _newHeirs, uint256 _newThreshold) external onlyOwner {
    require(_newThreshold > 0 && _newThreshold <= _newHeirs.length, "Invalid threshold");
    for (uint i = 0; i < heirs.length; i++) {
        isHeir[heirs[i]] = false;
    }
    heirs = _newHeirs;
    threshold = _newThreshold;
    for (uint i = 0; i < _newHeirs.length; i++) {
        isHeir[_newHeirs[i]] = true;
    }
}

/// @notice Arms the contract for inheritance transfer if enough heirs agree
/// @param signatures Array of heir signatures on the message hash
/// @param destination Address to which funds will be transferred after delay
function arm(bytes[] calldata signatures, address destination) external notArmed {
    require(destination != address(0), "Invalid destination");
    bytes32 messageHash = keccak256(abi.encodePacked(address(this), nonce, destination));
    bytes32 ethSigned = ECDSA.toEthSignedMessageHash(messageHash);
    address[] memory signers = new address[](signatures.length);
    uint count = 0;

    for (uint i = 0; i < signatures.length; i++) {
        address signer = ECDSA.recover(ethSigned, signatures[i]);
        require(isHeir[signer], "Invalid signature");
        bool unique = true;
        for (uint j = 0; j < count; j++) {
            if (signers[j] == signer) {
                unique = false;
                break;
            }
        }
        require(unique, "Duplicate signature");
        signers[count++] = signer;
    }

    require(count >= threshold, "Insufficient valid signatures");

    armedDestination = destination;
    armTimestamp = block.timestamp;
    isArmed = true;
    emit Armed(destination, armTimestamp, delayPeriod, nonce);
    nonce++;
}

/// @notice Allows the owner to cancel a pending inheritance transfer
function cancel() external onlyOwner {
    require(isArmed, "Not armed");
    isArmed = false;
    armedDestination = address(0);
    armTimestamp = 0;
}

/// @notice Allows anyone to finalize the transfer after the delay has passed
function triggerTransfer() external {
    require(isArmed, "Not armed");
    require(block.timestamp >= armTimestamp + delayPeriod, "Delay not passed");

    address dest = armedDestination;
    isArmed = false;
    armedDestination = address(0);
    armTimestamp = 0;

    (bool success, ) = dest.call{value: address(this).balance}("");
    require(success, "Transfer failed");

    armTimestamp = block.timestamp;
    emit Transferred(armedDestination, armTimestamp);
}

/// @notice Allows the owner to manually transfer funds to a chosen address
/// @param to The recipient address
/// @param amount The amount of wei to send
function manualTransfer(address payable to, uint256 amount) external onlyOwner {
    require(to != address(0), "Invalid address");
    require(amount <= address(this).balance, "Insufficient balance");
    (bool success, ) = to.call{value: amount}("");
    require(success, "Transfer failed");
}

/// @notice Returns the current list of heir addresses
/// @return Array of heir addresses
function getHeirs() external view returns (address[] memory) {
    return heirs;
}

/// @notice Accepts ether deposits into the contract
receive() external payable {}

/// @notice Allows the contract owner to withdraw all ETH from the contract.
/// @dev Only callable by the owner.
function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "No ETH to withdraw");
    (bool success, ) = owner.call{value: balance}("");
    require(success, "Withdraw failed");
}

}


/// @notice Library for recovering ECDSA signatures
library ECDSA {
/// @notice Prefixes a hash with the Ethereum signed message header
/// @param hash The original message hash
/// @return The Ethereum-signed message hash
function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
}

/// @notice Recovers the signer address from a signed message
/// @param hash The signed message hash
/// @param signature The signature bytes
/// @return The address that signed the message
function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
    require(signature.length == 65, "Invalid signature length");
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
        r := mload(add(signature, 32))
        s := mload(add(signature, 64))
        v := byte(0, mload(add(signature, 96)))
    }
    return ecrecover(hash, v, r, s);
}

}
