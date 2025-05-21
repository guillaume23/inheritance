// App.jsx
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import ContractInteraction from './pages/ContractInteraction';
import Update from './pages/Update';
import PrepareSignature from './pages/PrepareSignature';

function App() {
  return (
    <div className="container">
      <nav>
        <ul>
          <li><Link to="/">Configure & Deploy</Link></li>
          <li><Link to="/interact">Interact with contract</Link></li>
          <li><Link to="/transferApproval">Sign for transfer approval</Link></li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/interact" element={<ContractInteraction />} />
        <Route path="/update" element={<Update />} />
        <Route path="/transferApproval" element={<PrepareSignature />} />
      </Routes>
    </div>
  );
}

export default App;

