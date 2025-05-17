// src/pages/Deploy.jsx

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { generateDeploymentFiles, downloadJSONFile } from "../lib/deployment";
import { ContractFactory, BrowserProvider } from "ethers";
import { defaultAbiCoder } from "@ethersproject/abi";
import { isAddress } from "@ethersproject/address";
import successionManagerContract from "../contract/SuccessionManager.json";

export default function Deploy() {
  const [status, setStatus] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [networkId, setNetworkId] = useState("0x");
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state?.config;
  const sepoliaChainId="0xaa36a7";
  const mainnetChainId="0x1";

  const goToContract = () => {
    navigate(`/interact?address=${contractAddress}&networkId=${networkId}`);
  };

  useEffect(() => {
    if (!config) navigate("/");
  }, [config, navigate]);

  if (!config) return null;

  const { configFile, argsFile, deploymentFile } =
    generateDeploymentFiles(config);

  // Connect to MetaMask
  async function connectToMetaMask(chainId) {
    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainId }],
      });
      const signer = provider.getSigner();
      return signer;
    } else {
      alert("Please install MetaMask!");
      return null;
    }
  }

  // Deploy Contract using MetaMask
  async function deployWithMetaMask() {
    try {
      setStatus("Connecting to MetaMask...");

      const contractAbi = successionManagerContract.abi; // Contract ABI
      const contractBytecode = successionManagerContract.bytecode; // Contract Bytecode
      const constructorArgs = config; // Arguments for the contract constructor

      const signer = await connectToMetaMask(networkId);
      if (!signer) return;

      const contractFactory = new ContractFactory(
        contractAbi,
        contractBytecode,
        signer
      );

      setStatus("Deploying contract...");

      console.log(constructorArgs);
      const argsArray = [
        constructorArgs.owner,
        constructorArgs.heirs,
        constructorArgs.threshold,
        constructorArgs.lockInDelay,
      ];
      const contract = await contractFactory.deploy(...argsArray); // Deploy contract
      console.log("contract", contract);
      setContractAddress(contract.target);
      setStatus("Contract deployed successfully at address ", contract.target);
    } catch (err) {
      setStatus("Deployment failed: " + err.message);
    }
  }

  return (
    <div className="container">
      <h1>Deployment</h1>

      <p>
        You have successfully configured your inheritance contract. Below are
        the deployment files. Download them and use them with your preferred
        method.
      </p>

      <section>
        <h2>1. Configuration File</h2>
        <p>
          This file contains basic contract settings: owner, heirs, threshold, lockIn period (sec).
        </p>
        <button
          onClick={() => downloadJSONFile(configFile, "succession-config.json")}
        >
          Download Config File
        </button>
      </section>

      <section>
        <h2>2. Full Deployment Payload</h2>
        <p>
          Use this payload to deploy manually with low-level tools (e.g., Remix,
          CLI, or raw Ethereum transaction).
        </p>
        <button
          onClick={() =>
            downloadJSONFile(deploymentFile, "succession-deployment.json")
          }
        >
          Download Deployment File
        </button>
      </section>

      <section>
        <h1>3. Deploy Contract with Metamask</h1>
        <button onClick={() => {setNetworkId(mainnetChainId); deployWithMetaMask();}}>Mainnet</button>{" "}
        <button onClick={() => {setNetworkId(sepoliaChainId); deployWithMetaMask();}}>Testnet (Sepolia)</button>

        {status && <p>{status}</p>}
        {contractAddress && (
          <div>
            <p>Contract Address: {contractAddress}</p>
            <a
              href={`https://etherscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Contract on Etherscan
            </a>
            <br/>
            <button onClick={goToContract}>Interact with this contract</button>
          </div>

        )}
      </section>
    </div>
  );
}
