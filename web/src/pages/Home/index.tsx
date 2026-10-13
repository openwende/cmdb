import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Button } from 'antd';
import {
  ApartmentOutlined,
  NodeIndexOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  RightOutlined,
  ClusterOutlined,
  PlusOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { listModels, getBusinessList } from '@/api';
import { ModelDefinition } from '@/api/types/model';
import { useAuthStore } from '@/store/AuthStore';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import SparklesIcon from '@/components/AIAssistant/SparklesIcon';
import { EXAMPLE_PROMPT_KEYS } from '@/components/AIAssistant/examplePrompts';
import PageLoading from '@/components/common/PageLoading';
import './style.css';

interface DashStats {
  businessCount: number;
  modelCount: number;
}

const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canWrite = useAuthStore((state) => state.canWrite());
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [stats, setStats] = useState<DashStats>({ businessCount: 0, modelCount: 0 });
  const [loading, setLoading] = useState(true);
  const setAIOpen = useAIAssistantSceneStore((s) => s.setOpen);
  const newAIConversation = useAIAssistantSceneStore((s) => s.newConversation);
  const sendAI = useAIAssistantSceneStore((s) => s.send);
  const aiStreaming = useAIAssistantSceneStore((s) => s.streaming);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [modelData, bizResponse] = await Promise.allSettled([
          listModels(),
          getBusinessList({ limit: 1, offset: 0 }),
        ]);

        const resolvedModels = modelData.status === 'fulfilled' ? modelData.value : [];
        const resolvedBizTotal =
          bizResponse.status === 'fulfilled'
            ? (bizResponse.value?.data?.pagination?.total ?? bizResponse.value?.data?.total ?? 0)
            : 0;

        setModels(resolvedModels);
        setStats({
          businessCount: resolvedBizTotal,
          modelCount: resolvedModels.length,
        });
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

  // Filter out models with identical updated_at to surface real diffs
  const recentModelsDeduped = recentModels.filter(
    (m, idx, arr) => idx === 0 || m.updated_at !== arr[idx - 1].updated_at || idx < 3,
  );

  const statsCards = [
    {
      key: 'business',
      icon: <ClusterOutlined />,
      label: t('dashboard.stats.businesses'),
      value: stats.businessCount,
      suffix: undefined,
      color: '#4f7fff',
      bg: '#eef2ff',
      path: '/resource/business',
    },
    {
      key: 'models',
      icon: <AppstoreOutlined />,
      label: t('dashboard.stats.models'),
      value: stats.modelCount,
      suffix: undefined,
      color: '#7c3aed',
      bg: '#f5f3ff',
      path: '/model/overview',
    },
  ];

  const workspaceActions = [
    {
      key: 'topology',
      icon: <NodeIndexOutlined />,
      title:
        stats.businessCount === 0
          ? t('dashboard.workspace.primaryCtaNoBusiness')
          : t('dashboard.workspace.primaryCta'),
      desc:
        stats.businessCount === 0
          ? t('dashboard.workspace.primaryDescNoBusiness')
          : t('dashboard.workspace.primaryDesc'),
      path: stats.businessCount === 0 ? '/resource/business' : '/business',
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

  // 首页的示例问题总是开一个新会话；已有回答在生成时只打开抽屉，不打断它
  const askAI = (question: string) => {
    if (!aiStreaming) {
      newAIConversation();
      void sendAI(question);
    }
    setAIOpen(true);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(path);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="dashboard">
      {/* ── Stats row ── */}
      <div className="dashboard__stats">
        {statsCards.map((card) => {
          const statContent = (
            <>
              <span
                className="dashboard__stat-icon"
                style={{ color: card.color, background: card.bg }}
              >
                {card.icon}
              </span>
              <span className="dashboard__stat-body">
                <span className="dashboard__stat-value">
                  <span className="dashboard__stat-value-number">{card.value}</span>
                  {card.suffix && (
                    <span className="dashboard__stat-value-suffix">{card.suffix}</span>
                  )}
                </span>
                <span className="dashboard__stat-label">{card.label}</span>
              </span>
            </>
          );

          return card.path ? (
            <button
              key={card.key}
              type="button"
              className="dashboard__stat-card dashboard__stat-card--link"
              onClick={() => navigate(card.path)}
              aria-label={card.label}
            >
              {statContent}
            </button>
          ) : (
            <div key={card.key} className="dashboard__stat-card">
              {statContent}
            </div>
          );
        })}
      </div>

      {/* ── Welcome + AI + Actions ── */}
      <div className="dashboard__welcome">
        <div className="dashboard__welcome-copy">
          <h1 className="dashboard__welcome-title">{t('dashboard.welcome')}</h1>
          <p className="dashboard__welcome-subtitle">{t('dashboard.subtitle')}</p>
        </div>
        <section className="dashboard__ai-card" aria-labelledby="dashboard-ai-title">
          <div className="dashboard__ai-header">
            <span className="dashboard__ai-icon">
              <SparklesIcon />
            </span>
            <div className="dashboard__ai-heading">
              <h2 id="dashboard-ai-title" className="dashboard__ai-title">
                {t('dashboard.ai.title')}
              </h2>
              <p className="dashboard__ai-desc">{t('dashboard.ai.desc')}</p>
            </div>
          </div>
          <div className="dashboard__ai-prompts">
            <span className="dashboard__ai-prompts-title">{t('dashboard.ai.promptsTitle')}</span>
            <div className="dashboard__ai-prompt-list">
              {EXAMPLE_PROMPT_KEYS.map((key) => {
                const question = t(`aiAssistant.welcome.prompts.${key}`);
                return (
                  <button
                    key={key}
                    type="button"
                    className="dashboard__ai-prompt"
                    onClick={() => askAI(question)}
                  >
                    {question}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="dashboard__ai-footer">
            <Button
              type="primary"
              size="large"
              className="dashboard__ai-open"
              onClick={() => setAIOpen(true)}
            >
              <SparklesIcon />
              <span>{t('dashboard.ai.open')}</span>
            </Button>
          </div>
        </section>
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

      {/* ── Onboarding next-step cards ── */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">{t('dashboard.onboarding.title')}</h2>
        </div>
        <Row gutter={[16, 16]}>
          {(() => {
            if (stats.businessCount === 0) {
              if (!canWrite) {
                return (
                  <Col xs={24} sm={12} lg={8}>
                    <Card className="dashboard__onboarding-card">
                      <div
                        className="dashboard__onboarding-icon"
                        style={{ color: '#4f7fff', background: '#eef2ff' }}
                      >
                        <ClusterOutlined />
                      </div>
                      <h3>{t('dashboard.onboarding.noBusiness.title')}</h3>
                      <p>{t('dashboard.onboarding.noBusiness.viewerDesc')}</p>
                    </Card>
                  </Col>
                );
              }
              return (
                <Col xs={24} sm={12} lg={8}>
                  <Card className="dashboard__onboarding-card">
                    <div
                      className="dashboard__onboarding-icon"
                      style={{ color: '#4f7fff', background: '#eef2ff' }}
                    >
                      <PlusOutlined />
                    </div>
                    <h3>{t('dashboard.onboarding.noBusiness.title')}</h3>
                    <p>{t('dashboard.onboarding.noBusiness.desc')}</p>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => navigate('/resource/business')}
                    >
                      {t('dashboard.onboarding.noBusiness.action')}
                    </Button>
                  </Card>
                </Col>
              );
            }
            if (stats.modelCount === 0) {
              return (
                <Col xs={24} sm={12} lg={8}>
                  <Card className="dashboard__onboarding-card">
                    <div
                      className="dashboard__onboarding-icon"
                      style={{ color: '#7c3aed', background: '#f5f3ff' }}
                    >
                      <AppstoreOutlined />
                    </div>
                    <h3>{t('dashboard.onboarding.noModel.title')}</h3>
                    <p>{t('dashboard.onboarding.noModel.desc')}</p>
                    <Button type="primary" size="small" onClick={() => navigate('/model/overview')}>
                      {t('dashboard.onboarding.noModel.action')}
                    </Button>
                  </Card>
                </Col>
              );
            }
            return (
              <Col xs={24} sm={12} lg={8}>
                <Card className="dashboard__onboarding-card">
                  <div
                    className="dashboard__onboarding-icon"
                    style={{ color: '#059669', background: '#ecfdf5' }}
                  >
                    <ImportOutlined />
                  </div>
                  <h3>{t('dashboard.onboarding.readyImport.title')}</h3>
                  <p>{t('dashboard.onboarding.readyImport.desc')}</p>
                  <Button type="primary" size="small" onClick={() => navigate('/resource/host')}>
                    {t('dashboard.onboarding.readyImport.action')}
                  </Button>
                </Card>
              </Col>
            );
          })()}
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
        <Row gutter={[16, 16]}>
          {recentModelsDeduped.map((model) => (
            <Col xs={24} sm={12} lg={8} key={model.id}>
              <Card
                className="dashboard__model-card"
                hoverable
                onClick={() => navigate(`/model/${model.name}/basic`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleCardKeyDown(event, `/model/${model.name}/basic`)}
                aria-label={t('resource.model.actions.viewModelDetail', {
                  name: model.display_name,
                  defaultValue: `查看 ${model.display_name} 详情`,
                })}
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
                  <span className="dashboard__model-meta-item">{model.classification}</span>
                  {model.updated_at && (
                    <span className="dashboard__model-meta-item">
                      {t('dashboard.recentModels.updatedAt', {
                        time: dayjs(model.updated_at).format('MM-DD HH:mm'),
                      })}
                    </span>
                  )}
                </div>
              </Card>
            </Col>
          ))}
          {recentModelsDeduped.length === 0 && (
            <Col span={24}>
              <div className="dashboard__empty">{t('dashboard.recentModels.noModels')}</div>
            </Col>
          )}
        </Row>
      </div>
    </div>
  );
};

export default Home;
