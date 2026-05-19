import React from 'react';
import Language from './language';
import Login from './login';
import '../style.css';

const Function: React.FC = () => {
  return (
    <div className="header-function">
      <Language />
      <Login />
    </div>
  );
};

export default Function;
