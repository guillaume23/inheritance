import React, { useState } from "react";
import { isAddress, Wallet } from "ethers";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [owner, setOwner] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [heirs, setHeirs] = useState([{ address: "", error: "" }]);
  const [threshold, setThreshold] = useState(1);
  const [lockIn, setLockIn] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [lockInError, setLockInError] = useState('');

  const  computeDelayInSeconds = ({ days = 0, hours = 0, minutes = 0, seconds = 0 }) => {

  return (
    parseInt(days) * 86400 +
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds)
  );
  }
  
  const handleLockInChange = (field, value) => {
    const updated = { ...lockIn, [field]: parseInt(value) || 0 };
    setLockIn(updated);
    const totalSeconds = computeDelayInSeconds(updated);
    if (totalSeconds <= 0) {
      setLockInError('Lock-in period must be greater than zero');
    } else {
      setLockInError('');
    }
  };


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
    if (computeDelayInSeconds(lockIn) <= 0) return false;
    return true;
  };

  const handleDeploy = () => {
    if (!isValidDeployment()) return;
    const lockInDelay = computeDelayInSeconds(lockIn);
    const config = {
      owner,
      heirs: heirs.map((h) => h.address),
      threshold,
      lockInDelay
    };
    navigate("/deploy", { state: { config } });
  };

 return (
    <div className="page-padding">
      <h1 className="header-title">Inheritance Contract Setup</h1>

      <section className="vertical-stack">
        <h2 className="subheader-title">Owner Address</h2>
        <div className="flex space-x-2">
          <input
            className="form-control input-text"
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onBlur={handleOwnerBlur}
            placeholder="0x..."
          />
          <button
            className="form-control btn-secondary"
            onClick={handleGenerateOwner}
          >
            🎲
          </button>
          <label className="form-control btn-secondary">
            📂 
            <input
              type="file"
              accept="application/json"
              onChange={handleImportOwner}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {ownerError && <div className="text-error">{ownerError}</div>}
      </section>

      <section className="vertical-stack mt-4">
        <h2 className="subheader-title">Heirs</h2>
        {heirs.map((heir, index) => (
          <div key={index} className="flex space-x-2 items-center">
            <input
              className="form-control input-text"
              type="text"
              value={heir.address}
              onChange={(e) => handleHeirChange(index, e.target.value)}
              onBlur={() => handleHeirBlur(index)}
              placeholder="0x..."
            />
            <button
              className="form-control btn-secondary"
              onClick={() => handleGenerateHeir(index)}
            >
              🎲
            </button>
            <label className="form-control btn-secondary">
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
                className="form-control btn-secondary"
                onClick={() => setHeirs(heirs.filter((_, i) => i !== index))}
              >
                ❌
              </button>
            )}
            {heir.error && <div className="text-error">{heir.error}</div>}
          </div>
        ))}
        </section>
        <br/>
        <section>
        <button
          className="btn btn-primary mt-2"
          onClick={() => setHeirs([...heirs, { address: "", error: "" }])}
        >
          Add Heir
        </button>
      </section>

      <section className="vertical-stack mt-4">
        <h2 className="subheader-title">Threshold</h2>
        <input
          className="input-default"
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          min={1}
          max={heirs.length}
        />
      </section>

      <section className="vertical-stack mt-4">
        <h2 className="subheader-title">Lock-in Period</h2>
        <div className="flex space-x-2">
          {["days", "hours", "minutes", "seconds"].map((field) => (
            <div key={field} className="vertical-stack">
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                className="input-default input-sm"
                type="number"
                min="0"
                value={lockIn[field]}
                onChange={(e) => handleLockInChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>
        {lockInError && <span className="text-error">{lockInError}</span>}
      </section>

      <button
        className="btn btn-primary mt-6"
        disabled={!isValidDeployment()}
        onClick={handleDeploy}
      >
        Deploy
      </button>
    </div>
  );
}