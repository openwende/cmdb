import React from 'react';
import AIAssistantEntry from './aiAssistant';
import Language from './language';
import Login from './login';
import '../style.css';

const Function: React.FC = () => {
  return (
    <div className="header-function">
      <AIAssistantEntry />
      <Language />
      <Login />
    </div>
  );
};

export default Function;
