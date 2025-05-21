import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getBytes,
  isAddress,
  ethers,
  solidityPackedKeccak256,
  BrowserProvider,
  verifyMessage,
  Contract,
} from "ethers";
import SuccessionManager from "../contract/SuccessionManager.json";
import tokensData from "../data/tokens.json";

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export default function ContractInteraction() {
  const [searchParams] = useSearchParams();
  const [contractAddress, setContractAddress] = useState("");
  const [nonce, setNonce] = useState("0");
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

  const navigate = useNavigate();

  useEffect(() => {
    const addr = searchParams.get("address");
    const netId = searchParams.get("networkId");

    if (addr) setContractAddress(addr);
    if (netId) setNetworkId(String(netId));

  }, [searchParams]);

  const handleGoToApproval = () => {
    const params = new URLSearchParams({
      contract: contractAddress,
      destination,
      nonce,
    });
    window.open(`/transferApproval?${params.toString()}`);
  };

 const formatTokenAmount = (balance, decimals) => {
   const formatted = ethers.formatUnits(balance, decimals);

   return parseFloat(formatted).toLocaleString(undefined, {
     minimumFractionDigits: 1,
     maximumFractionDigits: 6,
   });
 };

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

const handleUpdate = () => {
  navigate(`/update?contract=${contractAddress}&networkId=${networkId}`);
};

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
      const owner = await contract.getOwner();
      const heirs = await contract.getHeirs();
      const threshold = await contract.threshold();
      const isArmed = await contract.isArmed();
      const armTimestamp = await contract.armTimestamp();
      const delayPeriod = await contract.delayPeriod();
      const armedDestination = await contract.armedDestination();
      const _nonce = await contract.nonce();
      setNonce(_nonce);

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
        nonce:_nonce,
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
                balance: formatTokenAmount(balance.toString(), token.decimals),
              });
            }
          } catch (err) {
            console.log(err);
          }
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
      const tx = await contract
        .triggerTransfer(tokenList.map((t) => t.address));
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
      const [balance, symbol, decimals] = await Promise.all([
        tokenContract.balanceOf(contractAddress),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      if (balance > 0n) {
        setTokenList((prev) => [
          ...prev,
          { address: manualToken, symbol, balance: formatTokenAmount(balance.toString(), decimals) },
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
      handleReadContract();
    } catch (e) {
      alert("Failed to cancel: " + e.message);
    }
  };
  return (
    <div className="page-padding">
      <h1 className="header-title">Contract Interaction</h1>

      <div className="vertical-stack">
        <input
          className="form-control input-text"
          placeholder="Contract address"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <input
          className="form-control input-text"
          placeholder="Network ID (e.g. 11155111 for Sepolia)"
          value={networkId}
          onChange={(e) => setNetworkId(e.target.value)}
        />
      </div>
      <div>
        <button className="btn btn-primary mt-6" onClick={handleReadContract}>
          Load Contract
        </button> <div className="helper-text">
  Use the owner wallet to access owner-specific actions.
</div>
      </div>

      {contractInfo && (
        <div className="mt-6 vertical-stack">
          <h2 className="subheader-title">Contract Info</h2>
          <div>
            <strong>Value:</strong> {contractInfo.balanceInEth}
          </div>
          <div>
            <strong>Owner:</strong> {contractInfo.owner}
          </div>
          <div>
            <strong>Heirs:</strong>
            <ul className="vertical-stack mt-2">
              {contractInfo.heirs.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Threshold:</strong> {contractInfo.threshold}
          </div>
           <div>
            <strong>LockIn period:</strong> {formatDuration(contractInfo.delayPeriod)}
          </div>
          <div>
            <strong>Nonce:</strong> {contractInfo.nonce}
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
        <div className="mt-4 vertical-stack">
          {contractInfo.owner.toLowerCase() === userAddress.toLowerCase() ? (
            <>
              {contractInfo.isArmed ? (
                <div className="flex space-x-2">
                  <button onClick={handleCancel} className="btn btn-danger">
                    Cancel Arm
                  </button>
                </div>
              ) : (
                 <div className="flex space-x-2">
                 <button className="btn btn-secondary"  onClick={handleUpdate}>
                    Update Heirs and Threshold
                  </button>
                  </div>
              )}
            </>
          ) : (
            <>
              {contractInfo.isArmed ? (
                <>
                  <h3 className="subheader-title mt-4">
                    Detected Token Balances
                  </h3>
                  <ul className="vertical-stack mt-2">
                    {tokenList.map((token, i) => (
                      <li key={i} >
                        <span>
                          {token.symbol}: {token.balance} ({token.address})<button
      className="btn-small"
      onClick={() => handleRemoveToken(token.address)}
      title="Remove token"
    >❌</button> </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex space-x-2">
                    <input
                      className="form-control input-text"
                      placeholder="ERC20 contract address"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                    <button
                      onClick={handleAddToken}
                      className="btn btn-secondary"
                      disabled={isAddingToken}
                    >
                      {isAddingToken ? "Scanning..." : "Add"}
                    </button>
                  </div>
                  <div className="mt-4 flex space-x-2">
               
                  <button
                    onClick={handleTransfer}
                    className="btn btn-purple mt-6"
                  >
                    Trigger Transfer
                  </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="vertical-stack mt-4">
                    <h3 className="subheader-title">Prepare to Arm</h3>
                    <input
                      className="form-control input-text w-full"
                      placeholder="Destination address"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    />
                    {signatures.map((sig, idx) => (
                      <div key={idx} className="flex space-x-2 items-center">
                        <input
                          className="form-control input-text w-full"
                          placeholder={`Signature ${idx + 1}`}
                          value={sig}
                          onChange={(e) => {
                            const updated = [...signatures];
                            updated[idx] = e.target.value;
                            setSignatures(updated);
                          }}
                        />
                        <button
                          type="button"
                          className="form-control btn-secondary"
                          onClick={handleGoToApproval}
                          title="Open signature helper"
                        >
                          🖋
                        </button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <button onClick={handleArm} className="btn btn-success">
                      Validate & Call Arm
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
