import React from 'react';
import Directory, { unmodifiableDirIds } from '../Directory';
import HostList from '../HostList';
import { useDirectoryStore } from '@/store/DirectoryStore';
import './style.css';

const HostPage: React.FC = () => {
  const selectedId = useDirectoryStore((state) => state.activeDirectoryId) || unmodifiableDirIds[0];
  const setSelectedId = useDirectoryStore((state) => state.setActiveDirectory);

  return (
    <div className="host-wrapper">
      <div className="host-layout">
        <Directory selectedId={selectedId} onSelect={setSelectedId} />
        <div className="host-layout__content">
          <HostList selectedId={selectedId} />
        </div>
      </div>
    </div>
  );
};

export default HostPage;
