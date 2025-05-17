import { useState } from "react";
import { getBytes, isAddress, ethers, solidityPackedKeccak256, BrowserProvider, verifyMessage  } from "ethers";
import SuccessionManager from "../contract/SuccessionManager.json";

export default function ContractInteraction() {
  const [contractAddress, setContractAddress] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [contractInfo, setContractInfo] = useState(null);
  const [contract, setContract] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [destination, setDestination] = useState("");

  const handleReadContract = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const contract = new ethers.Contract(
        contractAddress,
        SuccessionManager.abi,
        signer
      );
      const owner = await contract.owner();
      const heirs = await contract.getHeirs();
      const threshold = await contract.threshold();
      const isArmed = await contract.isArmed();
      const armTimestamp = await contract.armTimestamp();
      const delayPeriod = await contract.delayPeriod();
      const armedDestination = await contract.armedDestination();
      const nonce = await contract.nonce();

      setUserAddress(address);
      setContract(contract);
      setContractInfo({
        owner,
        heirs,
        threshold: threshold.toString(),
        isArmed,
        armTimestamp: armTimestamp.toString(),
        delayPeriod: delayPeriod.toString(),
        armedDestination,
        nonce
      });
      setSignatures(Array(parseInt(threshold)).fill(""));
    } catch (error) {
      alert("Error reading contract: " + error.message);
    }
  };

  const handleArm = async () => {
  try {
    if (!isAddress(destination)) {
      alert("Invalid destination address.");
      return;
    }

    const nonce = contractInfo.nonce;
    const messageHash = 
      solidityPackedKeccak256(["address", "uint256", "address"], [contractAddress, nonce, destination]);

    console.log("messageHash", messageHash);

    const recovered = new Set();
    const cleanSignatures = [];

    for (let sig of signatures) {
      if (!sig || sig.trim().length === 0) continue;

      try {
        const signer = verifyMessage(getBytes(messageHash), sig);
        const normalizedSigner = signer.toLowerCase();

        if (!contractInfo.heirs.some(h => h.toLowerCase() === normalizedSigner)) {
          console.warn("Signature from unknown signer:", normalizedSigner);
          continue;
        }

        if (recovered.has(normalizedSigner)) {
          console.warn("Duplicate signature from:", normalizedSigner);
          continue;
        }

        recovered.add(normalizedSigner);
        cleanSignatures.push(sig);
      } catch (e) {
        console.warn("Invalid signature skipped:", sig);
      }
    }

    if (cleanSignatures.length < parseInt(contractInfo.threshold)) {
      alert(`Not enough valid heir signatures. Found ${cleanSignatures.length}, need ${contractInfo.threshold}.`);
      return;
    }

    const tx = await contract.arm(cleanSignatures, destination);
    await tx.wait();
    alert("Contract armed successfully.");
    handleReadContract();
  } catch (e) {
    console.error(e);
    alert("Failed to arm: " + e.message);
  }
};

  const handleTransfer = async () => {
    try {
      const tx = await contract.transfer();
      await tx.wait();
      alert("Transfer executed.");
      handleReadContract();
    } catch (e) {
      alert("Failed to transfer: " + e.message);
    }
  };

  const handleCancel = async () => {
    try {
      const tx = await contract.cancel();
      await tx.wait();
      alert("Contract cancelled.");
      handleReadContract();
    } catch (e) {
      alert("Failed to cancel: " + e.message);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Contract Interaction</h1>
      <div className="space-y-2">
        <input
          className="border p-2 w-full"
          placeholder="Contract address"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Network ID (e.g. 11155111 for Sepolia)"
          value={networkId}
          onChange={(e) => setNetworkId(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleReadContract}
        >
          Load Contract
        </button>
      </div>

      {contractInfo && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">Contract Info</h2>
          <div><strong>Owner:</strong> {contractInfo.owner}</div>
          <div><strong>Heirs:</strong><ul> {contractInfo.heirs.map(h=><li key={h}>{h}</li>)}</ul></div>
          <div><strong>Threshold:</strong> {contractInfo.threshold}</div>
          <div><strong>nonce:</strong> {contractInfo.nonce}</div>
          <div><strong>Armed:</strong> {contractInfo.isArmed ? "Yes" : "No"}</div>
          {contractInfo.isArmed && (
            <>
              <div>Armed at: {new Date(contractInfo.armTimestamp * 1000).toLocaleString()}</div>
              <div>
                Unlock at: {new Date((parseInt(contractInfo.armTimestamp) + parseInt(contractInfo.delayPeriod)) * 1000).toLocaleString()}
              </div>
              <div>Destination: {contractInfo.armedDestination}</div>
            </>
          )}
        </div>
      )}
      {contractInfo && userAddress && (
        <div className="space-y-2 mt-4">
          {contractInfo.owner.toLowerCase() === userAddress.toLowerCase() ? (
            <>
              {!contractInfo.isArmed ? (
                <>
                  <button
                    onClick={handleArm}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Arm
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    disabled
                    className="bg-gray-400 text-white px-4 py-2 rounded"
                  >
                    Update (coming soon)
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-500">Contract already armed</div>
              )}
            </>
          ) : (
            <>
              {contractInfo.isArmed ? (
                <button
                  onClick={handleTransfer}
                  className="bg-purple-600 text-white px-4 py-2 rounded"
                >
                  Transfer
                </button>
              ) : (
                 <div className="space-y-2">
              <h3 className="font-semibold">Prepare to Arm</h3>
              <input
                className="border p-2 w-full"
                placeholder="Destination address"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              {signatures.map((sig, idx) => (
                <input
                  key={idx}
                  className="border p-2 w-full"
                  placeholder={`Signature ${idx + 1}`}
                  value={sig}
                  onChange={(e) => {
                    const updated = [...signatures];
                    updated[idx] = e.target.value;
                    setSignatures(updated);
                  }}
                />
              ))}
              <button
                onClick={handleArm}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Validate & Call Arm
              </button>
            </div>
              )}
            </>
          ) }
        </div>
      )}
    </div>
  );
}
