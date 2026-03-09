import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionPlaceholder from '../../components/SectionPlaceholder';

const TemplatesPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SectionPlaceholder
      message={t('resource.model.tabs.templates')}
      description={t('resource.model.helper.importExportPending')}
    />
  );
};

export default TemplatesPage;
