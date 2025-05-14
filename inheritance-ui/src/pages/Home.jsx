import React, { useState } from "react";
import { isAddress, Wallet } from "ethers";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [owner, setOwner] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [heirs, setHeirs] = useState([{ address: "", error: "" }]);
  const [threshold, setThreshold] = useState(1);

  const handleGenerateOwner = () => {
    const wallet = Wallet.createRandom();
    setOwner(wallet.address);
    setOwnerError("");
    downloadKeyFile(wallet, "owner");
  };

  const handleOwnerBlur = () => {
    if (!isAddress(owner)) {
      setOwnerError("Invalid Ethereum address");
    } else {
      setOwnerError("");
    }
  };

  const handleHeirChange = (index, value) => {
    const newHeirs = [...heirs];
    newHeirs[index].address = value;
    newHeirs[index].error = "";
    setHeirs(newHeirs);
  };

  const handleHeirBlur = (index) => {
    const current = heirs[index];
    const isDuplicate =
      heirs.filter((h, i) => i !== index && h.address === current.address)
        .length > 0;
    const newHeirs = [...heirs];

    if (!isAddress(current.address)) {
      newHeirs[index].error = "Invalid Ethereum address";
    } else if (isDuplicate) {
      newHeirs[index].error = "Duplicate address";
    } else {
      newHeirs[index].error = "";
    }
    setHeirs(newHeirs);
  };

  const handleGenerateHeir = (index) => {
    const wallet = Wallet.createRandom();
    const newHeirs = [...heirs];
    newHeirs[index].address = wallet.address;
    newHeirs[index].error = "";
    setHeirs(newHeirs);
    downloadKeyFile(wallet, `heir-${index + 1}`);
  };

  const downloadKeyFile = (wallet, namePrefix) => {
    const data = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${namePrefix}-${wallet.address}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportOwner = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (json.address && json.privateKey && json.mnemonic) {
        setOwner(json.address);
        setOwnerError("");
      }
    } catch (err) {
      console.error("Import failed:", err);
    }
  };

  const handleImportHeir = async (index, file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (json.address && json.privateKey && json.mnemonic) {
        const newHeirs = [...heirs];
        newHeirs[index].address = json.address;
        newHeirs[index].error = "";
        setHeirs(newHeirs);
      }
    } catch (err) {
      console.error("Import failed:", err);
    }
  };

  const navigate = useNavigate();

  const isValidDeployment = () => {
    if (!isAddress(owner)) return false;
    if (heirs.length < 1 || heirs.some((h) => !isAddress(h.address)))
      return false;
    const unique = new Set(heirs.map((h) => h.address.toLowerCase()));
    if (unique.size !== heirs.length) return false;
    if (threshold < 1 || threshold > heirs.length) return false;
    return true;
  };

  const handleFinalize = () => {
    if (!isValidDeployment()) return;
    const config = {
      owner,
      heirs: heirs.map((h) => h.address),
      threshold,
    };
    navigate("/finalize", { state: { config } });
  };

  return (
    <div className="container">
      <h1>Inheritance Contract Setup</h1>

      <section>
        <h2>Owner Address</h2>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={handleOwnerBlur}
          placeholder="0x..."
        />
        <button onClick={handleGenerateOwner}>🎲</button>
        <label className="import-button">
          📂 Import
          <input
            type="file"
            accept="application/json"
            onChange={handleImportOwner}
            style={{ display: "none" }}
          />
        </label>
        {ownerError && <div className="error">{ownerError}</div>}
      </section>

      <section>
        <h2>Heirs</h2>
        {heirs.map((heir, index) => (
          <div key={index}>
            <input
              type="text"
              value={heir.address}
              onChange={(e) => handleHeirChange(index, e.target.value)}
              onBlur={() => handleHeirBlur(index)}
              placeholder="0x..."
            />
            <button onClick={() => handleGenerateHeir(index)}>🎲</button>
            <label className="import-button">
              📂
              <input
                type="file"
                accept="application/json"
                onChange={(e) => handleImportHeir(index, e.target.files[0])}
                style={{ display: "none" }}
              />
            </label>
            {heirs.length > 1 && (
              <button
                onClick={() => setHeirs(heirs.filter((_, i) => i !== index))}
              >
                ❌
              </button>
            )}
            {heir.error && <div className="error">{heir.error}</div>}
          </div>
        ))}
        <button
          onClick={() => setHeirs([...heirs, { address: "", error: "" }])}
        >
          Add Heir
        </button>
      </section>

      <section>
        <h2>Threshold</h2>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          min={1}
          max={heirs.length}
        />
      </section>
      <button disabled={!isValidDeployment()} onClick={handleFinalize}>
        Finalize Deployment
      </button>
    </div>
  );
}
