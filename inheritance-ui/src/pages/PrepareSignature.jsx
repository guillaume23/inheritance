// src/pages/PrepareSignature.jsx

import React, { useState } from 'react';
import { solidityPackedKeccak256, Wallet, ethers } from "ethers";

export default function PrepareSignature() {
  const [contractAddress, setContractAddress] = useState('');
  const [nonce, setNonce] = useState('');
  const [destination, setDestination] = useState('');
  const [signature, setSignature] = useState(null);
  const [signingAddress, setSigningAddress] = useState(null);
  const [error, setError] = useState(null);

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
      const messageHash = solidityPackedKeccak256(["address", "uint256", "address"], [contractAddress, nonce, destination]);

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
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Prepare Signature</h1>

      <div className="space-y-2">
        <input
          className="border p-2 w-full"
          placeholder="Contract address"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Nonce (number)"
          type="number"
          value={nonce}
          onChange={(e) => setNonce(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Destination address"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
         <button onClick={handleGenerateDestination}>🎲</button>
        <label className="block mt-4">
          <span className="font-semibold">Import key file (JSON)</span>
          <input type="file" accept="application/json" onChange={handleFileUpload} />
        </label>

        {signingAddress && (
          <div className="mt-2 text-sm">Signer address: <code>{signingAddress}</code></div>
        )}

        {signature && (
          <div className="mt-4">
            <label className="font-semibold">Signature:</label>
            <textarea
              className="w-full border p-2 mt-1 font-mono"
              rows={4}
              readOnly
              value={signature}
            />
          </div>
        )}

        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
    </div>
  );
}
