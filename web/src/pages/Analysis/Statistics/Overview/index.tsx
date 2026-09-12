import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  BlockOutlined,
  DatabaseOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import StatisticsCard from '../components/Card';
import { getHostList } from '@/api/services/business';
import { getBusinessList } from '@/api/services/resource';
import { listDynamicModels, listModels } from '@/api/services/model';
import { listAggregateInstances } from '@/api/services/modelInstance';
import './style.css';

type StatisticsId = 'biz' | 'host' | 'model' | 'inst';

// 卡片的静态定义：顺序、图标、主色、名称 key。数量之外的一切都不依赖接口，
// 这样页面一挂载就能把四张卡片渲染出来，数字先用占位符顶着。
const STATISTICS_CARDS: {
  id: StatisticsId;
  nameKey: string;
  icon: React.ReactNode;
  color: string;
  tooltipKey?: string;
}[] = [
  {
    id: 'biz',
    nameKey: 'analysis.statistics.overview.businessTotal',
    icon: <AppstoreOutlined />,
    color: '#2563eb',
  },
  {
    id: 'host',
    nameKey: 'analysis.statistics.overview.hostTotal',
    icon: <DatabaseOutlined />,
    color: '#13c2c2',
  },
  {
    id: 'model',
    nameKey: 'analysis.statistics.overview.modelTotal',
    icon: <BlockOutlined />,
    color: '#52c41a',
  },
  {
    id: 'inst',
    nameKey: 'analysis.statistics.overview.instanceTotal',
    icon: <ClusterOutlined />,
    color: '#fa8c16',
    tooltipKey: 'analysis.statistics.overview.instanceTooltip',
  },
];

// Define route mapping
const STATISTICS_ROUTE_MAP = {
  biz: '/resource/business',
  host: '/resource/host',
  model: '/model/overview',
};

// null 表示对应的统计值还没拿到，卡片上显示 “-”
type StatisticsCounts = Record<StatisticsId, number | null>;

const INITIAL_COUNTS: StatisticsCounts = {
  biz: null,
  host: null,
  model: null,
  inst: null,
};

const Overview: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<StatisticsCounts>(INITIAL_COUNTS);

  useEffect(() => {
    const fetchStatistics = async () => {
      const [businessResult, hostResult, modelResult, dynamicModelResult] =
        await Promise.allSettled([
          getBusinessList({ limit: 1, offset: 0 }),
          getHostList({ params: { page: 1, page_size: 1 } }),
          listModels(),
          listDynamicModels(),
        ]);

      const businessTotal =
        businessResult.status === 'fulfilled'
          ? (businessResult.value?.data?.pagination?.total ??
            businessResult.value?.data?.total ??
            0)
          : 0;
      // R8 统一响应：主机列表为 {code,data:{items,pagination}}，读 pagination.total；
      // 回退旧扁平 total（迁移过渡期兼容）。
      const hostTotal =
        hostResult.status === 'fulfilled'
          ? ((hostResult.value as any)?.data?.pagination?.total ??
            (hostResult.value as any)?.total ??
            0)
          : 0;
      const models = modelResult.status === 'fulfilled' ? modelResult.value : [];
      const dynamicModels =
        dynamicModelResult.status === 'fulfilled' ? dynamicModelResult.value : [];

      const instanceModelUIDs = dynamicModels
        .map((model) => model.uid)
        .filter((uid) => uid !== 'business' && uid !== 'host');
      const instanceResults = await Promise.allSettled(
        instanceModelUIDs.map((modelUID) =>
          listAggregateInstances(modelUID, { page: 1, page_size: 1 }),
        ),
      );
      const instanceTotal = instanceResults.reduce((total, result) => {
        if (result.status !== 'fulfilled') {
          return total;
        }
        return (
          total + (result.value.data?.pagination?.total || result.value.data?.items?.length || 0)
        );
      }, 0);

      setCounts({
        biz: businessTotal,
        host: hostTotal,
        model: models.length,
        inst: instanceTotal,
      });
    };

    void fetchStatistics();
  }, []);

  const cards = useMemo(
    () =>
      STATISTICS_CARDS.map((card) => ({
        ...card,
        name: t(card.nameKey),
        tooltip: card.tooltipKey ? t(card.tooltipKey) : undefined,
      })),
    [t],
  );

  const handleCardClick = (id: string) => {
    const route = STATISTICS_ROUTE_MAP[id as keyof typeof STATISTICS_ROUTE_MAP];
    if (route) {
      navigate(route);
    }
  };

  const getCardClickHandler = (id: string) => {
    return STATISTICS_ROUTE_MAP[id as keyof typeof STATISTICS_ROUTE_MAP]
      ? () => handleCardClick(id)
      : undefined;
  };

  return (
    <div className="statistics-overview">
      <Row gutter={[24, 24]}>
        {cards.map((card) => (
          <Col key={card.id} xs={24} sm={12} xl={6}>
            <StatisticsCard
              name={card.name}
              value={counts[card.id]}
              icon={card.icon}
              color={card.color}
              tooltip={card.tooltip}
              onClick={getCardClickHandler(card.id)}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Overview;
