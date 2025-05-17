// App.jsx
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import ContractInteraction from './pages/ContractInteraction';
import Deploy from './pages/Deploy';
import PrepareSignature from './pages/PrepareSignature';

function App() {
  return (
    <div className="container">
      <nav>
        <ul>
          <li><Link to="/">Configuration</Link></li>
          {/* <li><Link to="/deploy">Deploy</Link></li> */}
          <li><Link to="/interact">Interact</Link></li>
          <li><Link to="/transferApproval">Transfer approval</Link></li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/deploy" element={<Deploy />} />
        <Route path="/interact" element={<ContractInteraction />} />
        <Route path="/transferApproval" element={<PrepareSignature />} />
      </Routes>
    </div>
  );
}

export default App;

