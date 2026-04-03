import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Button, Skeleton } from 'antd';
import {
  ApartmentOutlined,
  NodeIndexOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { listModels } from '@/api';
import { ModelDefinition } from '@/api/types/model';
import './style.css';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const modelData = await listModels();
        setModels(modelData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const recentModels = [...models]
    .sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 6);

  const connectedModelSummary = t('dashboard.workspace.connectedModels', {
    count: loading ? 0 : models.length,
  });

  const workspaceActions = [
    {
      key: 'topology',
      icon: <NodeIndexOutlined />,
      title: t('dashboard.workspace.primaryCta'),
      desc: t('dashboard.workspace.primaryDesc'),
      path: '/business',
      primary: true,
    },
    {
      key: 'resources',
      icon: <DatabaseOutlined />,
      title: t('dashboard.workspace.secondary.resources'),
      desc: t('dashboard.workspace.secondary.resourcesDesc'),
      path: '/resource/host',
    },
    {
      key: 'models',
      icon: <AppstoreOutlined />,
      title: t('dashboard.workspace.secondary.models'),
      desc: t('dashboard.workspace.secondary.modelsDesc'),
      path: '/model/overview',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <div className="dashboard__welcome-copy">
          <h1 className="dashboard__welcome-title">{t('dashboard.welcome')}</h1>
          <p className="dashboard__welcome-subtitle">{t('dashboard.subtitle')}</p>
          <div className="dashboard__workspace-summary">
            <span className="dashboard__summary-pill">{connectedModelSummary}</span>
            <span className="dashboard__summary-note">{t('dashboard.workspace.pendingSummary')}</span>
          </div>
        </div>
        <div className="dashboard__workspace-actions">
          {workspaceActions.map((action) =>
            action.primary ? (
              <Button
                key={action.key}
                type="primary"
                size="large"
                className="dashboard__workspace-primary"
                onClick={() => navigate(action.path)}
                aria-label={action.title}
              >
                {action.icon}
                <span>{action.title}</span>
              </Button>
            ) : (
              <button
                key={action.key}
                type="button"
                className="dashboard__workspace-secondary"
                onClick={() => navigate(action.path)}
                aria-label={action.title}
              >
                <span className="dashboard__workspace-secondary-icon">{action.icon}</span>
                <span className="dashboard__workspace-secondary-copy">
                  <span className="dashboard__workspace-secondary-title">{action.title}</span>
                  <span className="dashboard__workspace-secondary-desc">{action.desc}</span>
                </span>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Recent Models */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">{t('dashboard.recentModels.title')}</h2>
          <Button
            type="link"
            onClick={() => navigate('/model/overview')}
            className="dashboard__view-all"
          >
            {t('dashboard.recentModels.viewAll')} <RightOutlined />
          </Button>
        </div>
        {loading ? (
          <Row gutter={[16, 16]}>
            {[1, 2, 3].map((i) => (
              <Col xs={24} sm={12} lg={8} key={i}>
                <Card>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            {recentModels.map((model) => (
              <Col xs={24} sm={12} lg={8} key={model.id}>
                <Card
                  className="dashboard__model-card"
                  hoverable
                  onClick={() => navigate(`/model/${model.name}/basic`)}
                >
                  <div className="dashboard__model-card-header">
                    <div className="dashboard__model-icon">
                      <ApartmentOutlined />
                    </div>
                    <div className="dashboard__model-info">
                      <div className="dashboard__model-name">{model.display_name}</div>
                      <div className="dashboard__model-id">{model.name}</div>
                    </div>
                  </div>
                  <div className="dashboard__model-meta">
                    <span className="dashboard__model-meta-item">
                      {model.classification}
                    </span>
                    {model.updated_at && (
                      <span className="dashboard__model-meta-item">
                        {dayjs(model.updated_at).format('MM-DD HH:mm')}
                      </span>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
            {recentModels.length === 0 && (
              <Col span={24}>
                <div className="dashboard__empty">
                  {t('dashboard.recentModels.noModels')}
                </div>
              </Col>
            )}
          </Row>
        )}
      </div>
    </div>
  );
};

export default Home;
