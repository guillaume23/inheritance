// src/pages/PrepareSignature.jsx

import React, { useState, useEffect } from "react";
import { solidityPackedKeccak256, Wallet, ethers } from "ethers";
import { useSearchParams } from "react-router-dom";

export default function PrepareSignature() {
  const [searchParams] = useSearchParams();
  const [contractAddress, setContractAddress] = useState("");
  const [nonce, setNonce] = useState(0);
  const [destination, setDestination] = useState("");
  const [signature, setSignature] = useState(null);
  const [signingAddress, setSigningAddress] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const contractaddr = searchParams.get("contract");
    const destaddr = searchParams.get("destination");
    const no = searchParams.get("nonce");

    if (contractaddr) setContractAddress(contractaddr);
    if (destaddr) setDestination(destaddr);
    if (no) setNonce(no);
  }, [searchParams]);

  const handleCopySignature = () => {
    if (signature) {
      navigator.clipboard.writeText(signature).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.privateKey) throw new Error("Missing privateKey in file");

      const wallet = new ethers.Wallet(json.privateKey);
      setSigningAddress(wallet.address);

      // Build the message hash: keccak256(abi.encodePacked(contract, nonce, destination))
      const messageHash = solidityPackedKeccak256(
        ["address", "uint256", "address"],
        [contractAddress, nonce, destination]
      );

      console.log("messageHash", messageHash);

      const sig = await wallet.signMessage(ethers.getBytes(messageHash));
      setSignature(sig);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to sign: " + err.message);
      setSignature(null);
      setSigningAddress(null);
    }
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

  const handleGenerateDestination = () => {
    const wallet = Wallet.createRandom();
    setDestination(wallet.address);
    downloadKeyFile(wallet, "destination");
  };

  return (
    <div
      className="page-padding"
      style={{ maxWidth: "640px", margin: "0 auto" }}
    >
      <h1 className="header-title">Prepare Signature</h1>

      <div className="vertical-stack">
        <h2 className="subheader-title">Contract Address</h2>
        <input
          className="form-control input-text"
          placeholder="0x..."
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
      </div>
      <div>
        <h2 className="subheader-title">Nonce</h2>
        <input
          className="form-control input-text input-compact"
          type="number"
          min={0}
          value={nonce}
          onChange={(e) => setNonce(e.target.value)}
        />
      </div>
      <div className="vertical-stack">
        <h2 className="subheader-title">Destination address</h2>
        <div className="flex space-x-2">
          <input
            className="form-control input-text"
            placeholder="0x..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button
            className="form-control btn-secondary"
            onClick={handleGenerateDestination}
          >
            🎲
          </button>
        </div>
        <div>
          {destination && contractAddress && (
            <>
              <h2 className="subheader-title">
                Load the private key for signing
              </h2>
              <label className="form-control btn-secondary">
                📂
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </>
          )}
        </div>
        {signingAddress && (
          <div className="mt-2 text-sm">
            Signer address: <code>{signingAddress}</code>
          </div>
        )}

        {signature && (
          <>
            <div className="mt-4 vertical-stack">
              <label className="subheader-title">
                Signature:
                <button
                  type="button"
                  onClick={handleCopySignature}
                  title="Copy to clipboard"
                  className="copy-button"
                >
                  📋
                </button>
              </label>
            </div>
            <textarea
              className="form-control input-text text-mono"
              rows={4}
              readOnly
              value={signature}
            />
            {copied && (
              <div className="copy-feedback">
                Signature copied into the clipboard
              </div>
            )}
          </>
        )}

        {error && <div className="text-error mt-2">{error}</div>}
      </div>
    </div>
  );
}
