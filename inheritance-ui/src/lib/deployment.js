// src/lib/deployment.js

import SuccessionManagerArtifact from '../contract/SuccessionManager.json';
import { defaultAbiCoder } from '@ethersproject/abi';

export function generateDeploymentFiles({ owner, heirs, threshold, lockInDelay }) {
  if (!owner || !Array.isArray(heirs) || heirs.length === 0 || !threshold || lockInDelay === 0) {
    throw new Error('Invalid deployment config');
  }

  // 1. Minimal Config File (public, user-friendly)
  const configFile = {
    owner,
    heirs,
    threshold,
    lockInDelay
  };

  // 2. Args File for use in scripts (e.g., with Hardhat, Ethers.js)
  const argsFile = [owner, heirs, threshold, lockInDelay];

  // 3. Encoded Deployment File (for full offline deploy)
  const abi = SuccessionManagerArtifact.abi;
  const bytecode = SuccessionManagerArtifact.bytecode;

  const encodedArgs = defaultAbiCoder.encode([
    'address',
    'address[]',
    'uint256',
    'uint256'
  ], [owner, heirs, threshold, lockInDelay]);

  const deploymentFile = {
    abi,
    bytecode,
    encodedConstructorArgs: encodedArgs,
    fullDeploymentPayload: bytecode + encodedArgs.slice(2) // remove '0x' prefix from encodedArgs
  };

  return {
    configFile,
    argsFile,
    deploymentFile
  };
}

// Optional utility to download files
export function downloadJSONFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
} 
