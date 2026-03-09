import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Button, Skeleton } from 'antd';
import {
  ApartmentOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ImportOutlined,
  NodeIndexOutlined,
  FileSearchOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import StatCard from '@/components/common/StatCard';
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

  const quickActions = [
    {
      icon: <PlusOutlined />,
      title: t('dashboard.quickActions.createModel'),
      desc: t('dashboard.quickActions.createModelDesc'),
      color: 'var(--color-primary)',
      bg: 'var(--color-primary-bg)',
      path: '/model/overview',
    },
    {
      icon: <ImportOutlined />,
      title: t('dashboard.quickActions.importHost'),
      desc: t('dashboard.quickActions.importHostDesc'),
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      path: '/resource/host',
    },
    {
      icon: <NodeIndexOutlined />,
      title: t('dashboard.quickActions.viewTopology'),
      desc: t('dashboard.quickActions.viewTopologyDesc'),
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-bg)',
      path: '/model/topology',
    },
    {
      icon: <FileSearchOutlined />,
      title: t('dashboard.quickActions.auditLog'),
      desc: t('dashboard.quickActions.auditLogDesc'),
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
      path: '/analysis/audit',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <div>
          <h1 className="dashboard__welcome-title">{t('dashboard.welcome')}</h1>
          <p className="dashboard__welcome-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} className="dashboard__stats">
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label={t('dashboard.stats.models')}
            value={loading ? 0 : models.length}
            icon={<ApartmentOutlined />}
            color="blue"
            loading={loading}
            onClick={() => navigate('/model/overview')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label={t('dashboard.stats.instances')}
            value={loading ? 0 : '--'}
            icon={<CloudServerOutlined />}
            color="green"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label={t('dashboard.stats.hosts')}
            value={loading ? 0 : '--'}
            icon={<DatabaseOutlined />}
            color="orange"
            loading={loading}
            onClick={() => navigate('/resource/host')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label={t('dashboard.stats.businesses')}
            value={loading ? 0 : '--'}
            icon={<AppstoreOutlined />}
            color="purple"
            loading={loading}
            onClick={() => navigate('/resource/business')}
          />
        </Col>
      </Row>

      {/* Quick Actions */}
      <div className="dashboard__section">
        <h2 className="dashboard__section-title">{t('dashboard.quickActions.title')}</h2>
        <Row gutter={[16, 16]}>
          {quickActions.map((action) => (
            <Col xs={24} sm={12} lg={6} key={action.title}>
              <div
                className="dashboard__action-card"
                onClick={() => navigate(action.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(action.path);
                  }
                }}
                aria-label={action.title}
              >
                <div
                  className="dashboard__action-icon"
                  style={{ background: action.bg, color: action.color }}
                >
                  {action.icon}
                </div>
                <div className="dashboard__action-content">
                  <div className="dashboard__action-title">{action.title}</div>
                  <div className="dashboard__action-desc">{action.desc}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
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
