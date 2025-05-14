// App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import QrGenerator from './pages/QrGenerator';
import ContractInteraction from './pages/ContractInteraction';
import Finalize from './pages/Finalize';

function App() {
  return (
    <div className="container">
      <nav>
        <ul>
          <li><Link to="/">Configuration</Link></li>
          <li><Link to="/qr">QR Codes</Link></li>
          <li><Link to="/contract">Contrat</Link></li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/qr" element={<QrGenerator />} />
        <Route path="/contract" element={<ContractInteraction />} />
        <Route path="/finalize" element={<Finalize />} />
      </Routes>
    </div>
  );
}

export default App;

