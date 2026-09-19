import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Row, Col, Card, Statistic, Progress, Table, Tag, Button, Space, Skeleton } from 'antd';
import {
  FolderOutlined, ThunderboltOutlined, CheckCircleOutlined,
  DollarOutlined, RobotOutlined, RocketOutlined, CalculatorOutlined,
} from '@ant-design/icons';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import useAuthStore from '../context/authStore';
import { projectAPI, leaderboardAPI, userAPI } from '../services/api';
import { formatNaira, CALCULATORS } from '../utils/helpers';

const STAT_CARDS = [
  { key: 'total',     label: 'Total Projects',  icon: <FolderOutlined />,     color: '#1a3c5e', getValue: (s) => s?.total || 0 },
  { key: 'active',    label: 'Active Projects',  icon: <ThunderboltOutlined />, color: '#3b82f6', getValue: (s) => s?.active || 0 },
  { key: 'completed', label: 'Completed',         icon: <CheckCircleOutlined />, color: '#10b981', getValue: (s) => s?.completed || 0 },
  { key: 'value',     label: 'Total Value',       icon: <DollarOutlined />,    color: '#f59e0b', getValue: (s) => formatNaira(s?.total_value || 0), isText: true },
];

const PROJECT_COLUMNS = [
  {
    title: 'Project',
    dataIndex: 'title',
    key: 'title',
    render: (text, record) => (
      <Link href={`/projects/${record.id}`} className="font-medium text-primary-700 hover:underline">
        {text}
      </Link>
    ),
  },
  {
    title: 'Client',
    dataIndex: 'client_name',
    key: 'client_name',
    render: (v) => v || '--',
  },
  {
    title: 'Value',
    dataIndex: 'estimated_value',
    key: 'value',
    align: 'right',
    render: (v) => formatNaira(v),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (s) => {
      const map = { active: 'blue', completed: 'green', paused: 'gold' };
      return <Tag color={map[s] || 'default'}>{s}</Tag>;
    },
  },
];

const QUICK_TOOLS = [
  { href: '/engine?tool=forecast', title: 'Cost Forecasting', desc: 'Predict overruns before they happen.', color: '#7c3aed', icon: '$' },
  { href: '/engine?tool=variance', title: 'Variance Detection', desc: 'Compare BOQ revisions side-by-side.', color: '#3b82f6', icon: '~' },
];

const AI_PROMPTS = [
  'How many blocks for 100m2?',
  'Explain SMM7 rules',
  'Suggest concrete mix ratio',
  'Calculate steel for beam',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, planName } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [usage, setUsage] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_VERSION !== 'dev' && user?.is_admin) {
      router.replace('/admin');
    }
  }, [user?.id, router]);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, projectsRes, rankRes, usageRes] = await Promise.allSettled([
          projectAPI.stats(),
          projectAPI.list({ limit: 5 }),
          leaderboardAPI.getMe(),
          userAPI.getUsage(),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.stats);
        if (projectsRes.status === 'fulfilled') setRecentProjects(projectsRes.value.data.projects || []);
        if (rankRes.status === 'fulfilled') setRank(rankRes.value.data.rank);
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const isProUser = ['pro', 'enterprise'].includes(planName());
  const greeting = getGreeting();

  const calcUsage = usage?.calculator;
  const projUsage = usage?.projects;

  return (
    <ProtectedRoute>
      <Head><title>Dashboard | QSToolkit</title></Head>
      <Layout title="Dashboard">
        <div className="space-y-6 max-w-7xl">

          {/* Welcome Banner */}
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #1a3c5e 0%, #0f2744 100%)' }}
            className="!rounded-2xl"
          >
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col flex="auto" style={{ minWidth: 0 }}>
                <p className="text-primary-300 text-sm m-0">{greeting}</p>
                <h1 className="font-display text-xl sm:text-2xl font-bold mt-1 text-white">
                  Welcome back, {user?.name?.split(' ')[0]}
                </h1>
                <p className="text-primary-200 text-sm mt-1 capitalize m-0 truncate">
                  {user?.company_name || user?.university_name || 'QSToolkit Professional'} · {planName()} plan
                </p>
              </Col>
              {rank && (
                <Col>
                  <div className="bg-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-center">
                    <span className="text-2xl sm:text-3xl font-bold font-display text-gold-400">#{rank.rank_by_rating}</span>
                    <p className="text-[11px] sm:text-xs text-primary-200 mt-1 m-0">Leaderboard Rank</p>
                    <p className="text-sm text-white mt-0.5 m-0">{rank.avg_rating}/10</p>
                  </div>
                </Col>
              )}
            </Row>
          </Card>

          {/* Stat Cards */}
          <Row gutter={[16, 16]}>
            {STAT_CARDS.map(s => (
              <Col xs={12} lg={6} key={s.key}>
                <Card bordered={false} className="!rounded-xl shadow-sm">
                  <Statistic
                    title={s.label}
                    value={loading ? '--' : s.getValue(stats)}
                    prefix={!s.isText && s.icon}
                    valueStyle={{ color: s.color, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Usage */}
          {usage && (
            <Card title="Monthly Usage" bordered={false} className="!rounded-xl shadow-sm">
              <Row gutter={48}>
                {[{ label: 'Calculator Uses', data: calcUsage }, { label: 'Projects Logged', data: projUsage }].map(u => {
                  if (!u.data) return null;
                  const pct = u.data.limit ? Math.min((u.data.used_this_month ?? u.data.used / u.data.limit) * 100, 100) : 0;
                  const used = u.data.used_this_month ?? u.data.used;
                  const unlimited = u.data.limit === null;
                  return (
                    <Col xs={24} md={12} key={u.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{u.label}</span>
                        <span className="text-sm text-gray-500">
                          {used} / {unlimited ? 'Unlimited' : u.data.limit}
                        </span>
                      </div>
                      {!unlimited && (
                        <Progress
                          percent={pct}
                          strokeColor={pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#1a3c5e'}
                          showInfo={false}
                          size="small"
                        />
                      )}
                    </Col>
                  );
                })}
              </Row>
              {!isProUser && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-amber-800 m-0">Upgrade for more calculator uses, BOQs & invoices</p>
                  <Link href="/subscription">
                    <Button type="primary" size="small" style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>
                      Upgrade
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          )}

          <Row gutter={[16, 16]}>
            {/* Recent Projects */}
            <Col xs={24} lg={15}>
              <Card
                title="Recent Projects"
                bordered={false}
                className="!rounded-xl shadow-sm"
                extra={<Link href="/projects" className="text-sm text-primary-600">View all</Link>}
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : recentProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No projects yet</p>
                    <Link href="/projects/new">
                      <Button type="primary" className="mt-3">Add First Project</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <Table
                      dataSource={recentProjects}
                      columns={PROJECT_COLUMNS}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                )}
              </Card>
            </Col>

            {/* Right Sidebar */}
            <Col xs={24} lg={9}>
              <Space direction="vertical" size={16} className="w-full">

                {/* Dr. Q Assistant */}
                <Card
                  bordered={false}
                  className="!rounded-xl shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #1a3c5e 0%, #0f2744 100%)' }}
                >
                  <h2 className="text-white text-base font-semibold mb-2">Dr. Q Assistant</h2>
                  <p className="text-primary-200 text-sm mb-4">
                    Ask about standards, calculations, or get help with BOQs.
                  </p>
                  <Row gutter={[8, 8]}>
                    {AI_PROMPTS.map(q => (
                      <Col xs={24} sm={12} key={q}>
                        <Button
                          block
                          size="small"
                          style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'transparent', color: '#fff', textAlign: 'left', height: 'auto', padding: '8px' }}
                          onClick={() => window.dispatchEvent(new CustomEvent('qst-ai-ask', { detail: q }))}
                          className="!text-xs !whitespace-normal"
                        >
                          {q}
                        </Button>
                      </Col>
                    ))}
                  </Row>
                </Card>

                {/* Quick Tools */}
                <Row gutter={[12, 12]}>
                  {QUICK_TOOLS.map(t => (
                    <Col span={12} key={t.href}>
                      <Link href={t.href}>
                        <Card bordered={false} className="!rounded-xl shadow-sm hover:shadow-md transition-shadow" style={{ borderLeft: `4px solid ${t.color}` }}>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${t.color}15` }}>
                              <span style={{ color: t.color }} className="text-sm font-bold">{t.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 text-sm m-0">{t.title}</h3>
                              <p className="text-xs text-gray-500 mt-1 m-0">{t.desc}</p>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </Col>
                  ))}
                </Row>

                {/* Quick Calculators */}
                <Card
                  title="Calculators"
                  bordered={false}
                  className="!rounded-xl shadow-sm"
                  extra={<Link href="/calculators" className="text-sm text-primary-600">All</Link>}
                >
                  <Row gutter={[8, 8]}>
                    {CALCULATORS.slice(0, 6).map(c => (
                      <Col span={8} key={c.id}>
                        <Link href={`/calculators/${c.id}`}>
                          <div className="flex flex-col items-center p-2 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all text-center">
                            <span className="text-lg mb-1">{c.icon}</span>
                            <span className="text-[10px] font-medium text-gray-700 leading-tight">
                              {c.label.split(' ').slice(0, 2).join(' ')}
                            </span>
                          </div>
                        </Link>
                      </Col>
                    ))}
                  </Row>
                  <Link href="/calculators">
                    <Button block className="mt-3">View All Calculators</Button>
                  </Link>
                </Card>
              </Space>
            </Col>
          </Row>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
