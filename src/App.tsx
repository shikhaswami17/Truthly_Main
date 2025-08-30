// filepath: /home/shikha17/Documents/Truthly/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import TruthlyApp from './components/TruthlyApp';
import DynamicResult from './components/DynamicResult';
import TopicSearchComponent from './components/TopicSearchComponent';
import './styles/index.css';

function App() {
  console.log('App component rendering...'); // Debug log
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<TruthlyApp />} />
          <Route path="/result" element={<DynamicResultWrapper />} />
          <Route path="/search" element={<TopicSearchComponent />} />
          <Route path="*" element={<div>Page Not Found</div>} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

// Wrapper to pass props from location state
// Wrapper to pass props from location state
function DynamicResultWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchUrl } = location.state || {};

  console.log('DynamicResultWrapper rendering...', { searchUrl }); // Debug log

  if (!searchUrl) {
    navigate('/');
    return null;
  }

  return (
    <ErrorBoundary>
      <DynamicResult 
        searchUrl={searchUrl} 
        onBack={() => navigate('/')} 
      />
    </ErrorBoundary>
  );
}

export default App;
