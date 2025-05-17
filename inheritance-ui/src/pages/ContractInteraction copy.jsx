import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { ContractFactory, BrowserProvider } from "ethers";
import contractJson from "../contract/SuccessionManager.json";
import { useSearchParams } from "react-router-dom";

const ContractInteraction = () => {
  const [contractAddress, setContractAddress] = useState("");
  const [contractInfo, setContractInfo] = useState(null);
  const [error, setError] = useState("");
  const sepoliaChainId = "0xaa36a7";
  const mainnetChainId = "0x1";
  const [networkId, setNetworkId] = useState(sepoliaChainId);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const address = searchParams.get("address");
    const networkId = searchParams.get("networkId");

    if (address) setContractAddress(address);
    if (networkId) setNetworkId(networkId);
  }, [searchParams]);

  const formatUnlockDate = (armedTimestamp, lockInDelay) => {
    if (!armedTimestamp || !lockInDelay) return "Not set";
    const date = new Date((armedTimestamp + lockInDelay) * 1000);
    return date.toLocaleString();
  };

  const handleReadContract = async () => {
    try {
      setError("");
      setContractInfo(null);

      const provider = new BrowserProvider(window.ethereum);
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [
          { chainId: networkId },
        ],
      });
      const signer = await provider.getSigner();
      console.log(contractAddress, contractJson.abi, provider);

      const contract = new ethers.Contract(
        contractAddress,
        contractJson.abi,
        signer
      );

      if (typeof contract.isArmed !== "function") {
        throw new Error("Invalid contract: isArmed() not found");
      }

      const balance = await provider.getBalance(contractAddress);
      const balanceInEth = ethers.formatEther(balance);

      const [
        owner,
        threshold,
        lockInPeriod,
        heirCount,
        isArmed,
        armedDestination,
        armedTimestamp,
      ] = await Promise.all([
        contract.getOwner(),
        contract.threshold(),
        contract.delayPeriod(),
        contract.getHeirsCount(),
        contract.isArmed(),
        contract.armedDestination(),
        contract.armTimestamp(),
      ]);

      const heirs = [];
      for (let i = 0; i < heirCount; i++) {
        const heir = await contract.heirs(i);
        heirs.push(heir);
      }

      setContractInfo({
        balanceInEth,
        owner,
        threshold: Number(threshold),
        lockInPeriod: Number(lockInPeriod),
        heirs,
        isArmed,
        armedDestination,
        armedTimestamp,
      });
    } catch (err) {
      console.error(err);
      setError(
        "Failed to fetch contract data. Check network, address, or contract ABI."
      );
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Contract Viewer</h1>

      <div>
        <label>Network</label>
        <select
          value={networkId}
          onChange={(e) => setNetworkId(e.target.value)}
          className="border rounded p-2 w-full"
        >
          <option value={sepoliaChainId}>Sepolia Testnet</option>
          <option value={mainnetChainId}>Mainnet</option>
        </select>
      </div>

      <div>
        <label>Contract Address</label>
        <input
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          className="border rounded p-2 w-full"
          placeholder="0x..."
        />
      </div>

      <button
        onClick={handleReadContract}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Load Contract
      </button>

      {error && <div className="red-text">{error}</div>}

      {contractInfo && (
        <div className="mt-4 space-y-2">
          <div>
            <strong>Value:</strong> {contractInfo.balanceInEth}
          </div>
          <div>
            <strong>Owner:</strong> {contractInfo.owner}
          </div>
          <div>
            <strong>Threshold:</strong> {contractInfo.threshold}
          </div>
          <div>
            <strong>Lock-in Period (seconds):</strong>{" "}
            {contractInfo.lockInPeriod}
          </div>
          <div>
            <strong>Heirs:</strong>
            <ul className="list-disc ml-6">
              {contractInfo.heirs.map((heir, idx) => (
                <li key={idx}>{heir}</li>
              ))}
            </ul>
          </div>
          {contractInfo.isArmed && (
            <div>
              <div>
                <strong>fund destination:</strong>{" "}
                {contractInfo.armedDestination}
              </div>
              <div>
                <strong>transferrable from :</strong>{" "}
                {formatUnlockDate(
                  contractInfo.armedTimestamp,
                  contractInfo.lockInPeriod
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractInteraction;
