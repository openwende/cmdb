import React from 'react';
import Language from './language';
import Help from './help';
import Login from './login';
import '../style.css';

const Function: React.FC = () => {
  return (
    <div className="header-function">
      <Language />
      <Help />
      <Login />
    </div>
  );
};

export default Function;
