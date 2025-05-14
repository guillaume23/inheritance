// src/pages/Finalize.jsx

import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateDeploymentFiles, downloadJSONFile } from '../lib/deployment';

export default function Finalize() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state?.config;

  useEffect(() => {
    if (!config) navigate('/');
  }, [config, navigate]);

  if (!config) return null;

  const { configFile, argsFile, deploymentFile } = generateDeploymentFiles(config);

  return (
    <div className="container">
      <h1>Finalize Deployment</h1>

      <p>
        You have successfully configured your inheritance contract. Below are the deployment files. Download them and use them with your preferred method.
      </p>

      <section>
        <h2>1. Configuration File</h2>
        <p>This file contains basic contract settings: owner, heirs, threshold.</p>
        <button onClick={() => downloadJSONFile(configFile, 'succession-config.json')}>Download Config File</button>
      </section>


      <section>
        <h2>2. Full Deployment Payload</h2>
        <p>Use this payload to deploy manually with low-level tools (e.g., Remix, CLI, or raw Ethereum transaction).</p>
        <button onClick={() => downloadJSONFile(deploymentFile, 'succession-deployment.json')}>Download Deployment File</button>
      </section>
    </div>
  );
}
