import { useState } from "react";
import {
  getBytes,
  isAddress,
  ethers,
  solidityPackedKeccak256,
  BrowserProvider,
  verifyMessage,
  Contract
} from "ethers";
import SuccessionManager from "../contract/SuccessionManager.json";
import tokensData from "../data/tokens.json";

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

export default function ContractInteraction() {
  const [contractAddress, setContractAddress] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [contractInfo, setContractInfo] = useState(null);
  const [contract, setContract] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [destination, setDestination] = useState("");
  const [tokenList, setTokenList] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [isAddingToken, setIsAddingToken] = useState(false);

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
      const owner = await contract.owner(); // TODO getOwner();
      const heirs = await contract.getHeirs();
      const threshold = await contract.threshold();
      const isArmed = await contract.isArmed();
      const armTimestamp = await contract.armTimestamp();
      const delayPeriod = await contract.delayPeriod();
      const armedDestination = await contract.armedDestination();
      const nonce = await contract.nonce();

      const balance = await provider.getBalance(contractAddress);
      const balanceInEth = ethers.formatEther(balance);

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
        nonce,
        balanceInEth,
      });
      setSignatures(Array(parseInt(threshold)).fill(""));

      // Scan for ERC20 holdings
      const tokensByNetwork = tokensData.network.find(
        (n) => n.networkId === parseInt(networkId)
      );

      if (!tokensByNetwork) return;

      const candidates = tokensByNetwork.erc20;
      const detected = [];
      setIsScanning(true);

      await Promise.allSettled(
        candidates.map(async (token) => {
          try {
            const tokenContract = new Contract(
              token.address,
              erc20Abi,
              provider
            );
            const balance = await tokenContract.balanceOf(contractAddress);

            if (balance > 0n) {
              detected.push({
                address: token.address,
                symbol: token.symbol,
                balance: balance.toString(),
              });
            }
          } catch (err) {console.log(err)}
        })
      );

      setIsScanning(false);
      setTokenList(detected);
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
      const messageHash = solidityPackedKeccak256(
        ["address", "uint256", "address"],
        [contractAddress, nonce, destination]
      );

      console.log("messageHash", messageHash);

      const recovered = new Set();
      const cleanSignatures = [];

      for (let sig of signatures) {
        if (!sig || sig.trim().length === 0) continue;

        try {
          const signer = verifyMessage(getBytes(messageHash), sig);
          const normalizedSigner = signer.toLowerCase();

          if (
            !contractInfo.heirs.some(
              (h) => h.toLowerCase() === normalizedSigner
            )
          ) {
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
        alert(
          `Not enough valid heir signatures. Found ${cleanSignatures.length}, need ${contractInfo.threshold}.`
        );
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
      const tx = await contract.triggerTransfer(
        //tokenList.map((t) => t.address)
      );
      await tx.wait();
      alert("Transfer executed.");
      handleReadContract();
    } catch (e) {
      alert("Failed to transfer: " + e.message);
    }
  };

  const handleAddToken = async () => {
    try {
      if (!window.ethereum || !manualToken || !contractAddress) return;
      setIsAddingToken(true);

      const provider = new BrowserProvider(window.ethereum);
      const tokenContract = new Contract(manualToken, erc20Abi, provider);
      const [balance, symbol] = await Promise.all([
        tokenContract.balanceOf(contractAddress),
        tokenContract.symbol(),
      ]);


      if (balance > 0n) {
        setTokenList((prev) => [
          ...prev,
          { address: manualToken, symbol, balance: balance.toString() },
        ]);
      } else {
        alert("Token balance is 0 for this contract");
      }
    } catch (e) {
      alert("Error adding token: " + e.message);
    } finally {
      setManualToken("");
      setIsAddingToken(false);
    }
  };

  const handleRemoveToken = (addr) => {
    setTokenList((prev) => prev.filter((t) => t.address !== addr));
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
          <div>
            <strong>Value:</strong> {contractInfo.balanceInEth}
          </div>
          <div>
            <strong>Owner:</strong> {contractInfo.owner}
          </div>
          <div>
            <strong>Heirs:</strong>
            <ul>
              {" "}
              {contractInfo.heirs.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Threshold:</strong> {contractInfo.threshold}
          </div>
          <div>
            <strong>nonce:</strong> {contractInfo.nonce}
          </div>
          <div>
            <strong>Armed:</strong> {contractInfo.isArmed ? "Yes" : "No"}
          </div>
          {contractInfo.isArmed && (
            <>
              <div>
                Armed at:{" "}
                {new Date(contractInfo.armTimestamp * 1000).toLocaleString()}
              </div>
              <div>
                Unlock at:{" "}
                {new Date(
                  (parseInt(contractInfo.armTimestamp) +
                    parseInt(contractInfo.delayPeriod)) *
                    1000
                ).toLocaleString()}
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
                <div className="text-sm text-gray-500">
                  Contract already armed
                </div>
              )}
            </>
          ) : (
            <>
              {contractInfo.isArmed ? (
                <>
                  <h3 className="font-semibold mt-4">
                    Detected Token Balances
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {tokenList.map((token, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span>
                          {token.symbol}: {token.balance} ({token.address})
                        </span>
                        <button
                          onClick={() => handleRemoveToken(token.address)}
                          className="ml-2 text-red-600 text-xs"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex space-x-2">
                    <input
                      className="border p-2 flex-1"
                      placeholder="ERC20 contract address"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                    <button
                      onClick={handleAddToken}
                      className="bg-gray-400 text-white px-4 py-2 rounded"
                      disabled={isAddingToken}
                    >
                      {isAddingToken ? "Scanning..." : "Add"}
                    </button>
                  </div>

                  <button
                    onClick={handleTransfer}
                    className="mt-6 bg-purple-600 text-white px-4 py-2 rounded"
                  >
                    Trigger Transfer
                  </button>
                </>
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
          )}
        </div>
      )}
    </div>
  );
}
