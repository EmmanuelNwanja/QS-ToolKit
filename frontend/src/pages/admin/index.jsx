import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Descriptions, Spin, Alert, Typography } from 'antd';
import {
  UserOutlined, CreditCardOutlined, DollarOutlined, TagsOutlined,
  ThunderboltOutlined, CalendarOutlined, RobotOutlined, BankOutlined,
  BellOutlined, BarChartOutlined, TeamOutlined, SafetyOutlined,
} from '@ant-design/icons';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI, aiAPI } from '../../services/api';
import useAuthStore from '../../context/authStore';

const { Title, Text, Paragraph } = Typography;

const formatCurrency = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
}).format(Number(value || 0));

function AdminAIGrantManager() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGrants = async () => {
    try {
      setLoading(true);
      const { data } = await aiAPI.listAdminAIGrants();
      setGrants(data?.data?.grants || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load grants');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchGrants(); }, []);

  const handleRevoke = async (userId) => {
    if (!confirm('Revoke Admin AI access for this user?')) return;
    try {
      await aiAPI.revokeAdminAI(userId);
      toast.success('Access revoked');
      fetchGrants();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Revoke failed');
    }
  };

  const columns = [
    {
      title: 'Admin',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.users?.name || 'Unknown'}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.users?.email}</Text>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: ['users', 'user_type'],
      key: 'role',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button danger size="small" onClick={() => handleRevoke(r.user_id)}>Revoke</Button>
      ),
    },
  ];

  return (
    <div>
      <Table
        dataSource={grants}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No grants yet. Super admins have automatic access.' }}
      />
      <Paragraph type="secondary" className="text-xs mt-3">
        To grant access, add a row to the <code>admin_ai_grants</code> table with the admin&apos;s user_id.
      </Paragraph>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState(null);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchSecurityAlerts();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStats();
      setStats(response.data?.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const fetchSecurityAlerts = async () => {
    try {
      setAlertsLoading(true);
      const response = await adminAPI.getActivityLogs({ action: 'generated_one_time_password', limit: 8 });
      setSecurityAlerts(response.data?.logs || []);
    } catch { setSecurityAlerts([]); }
    finally { setAlertsLoading(false); }
  };

  const lastUpdated = stats?.generated_at
    ? new Date(stats.generated_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const financial = stats?.financialModel;

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers || 0, icon: <UserOutlined />, color: '#1a3c5e', onClick: () => router.push('/admin/users') },
    { title: 'Active Subscriptions', value: stats?.activeSubscriptions || 0, icon: <CreditCardOutlined />, color: '#3b82f6', onClick: () => router.push('/admin/subscriptions') },
    { title: 'Actual Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: <DollarOutlined />, color: '#10b981', isText: true, onClick: () => router.push('/admin/billing') },
    { title: 'Discounts Granted', value: formatCurrency(financial?.discountedPaymentsValue || 0), icon: <TagsOutlined />, color: '#f59e0b', isText: true, onClick: () => router.push('/admin/promo-codes') },
    { title: 'MRR Projection', value: formatCurrency(financial?.monthlyRecurringRevenue || 0), icon: <ThunderboltOutlined />, color: '#8b5cf6', isText: true },
    { title: 'Next 30 Days', value: formatCurrency(financial?.next30DayProjection || 0), icon: <CalendarOutlined />, color: '#06b6d4', isText: true },
    { title: 'Active Promo Codes', value: stats?.activePromoCodes || 0, icon: <TagsOutlined />, color: '#ec4899', onClick: () => router.push('/admin/promo-codes') },
  ];

  const quickActions = [
    { href: '/admin/ai-engine', icon: <RobotOutlined />, title: 'AI Engine', desc: 'Dr. Q Admin - platform analytics, user insights, revenue', color: '#1a3c5e' },
    { href: '/admin/promo-codes', icon: <TagsOutlined />, title: 'Manage Promo Codes', desc: 'Create and manage discount codes', color: '#3b82f6' },
    { href: '/admin/users', icon: <TeamOutlined />, title: 'Manage Users', desc: 'View and manage user accounts', color: '#10b981' },
    { href: '/admin/direct-payments', icon: <BankOutlined />, title: 'Direct Payments', desc: 'Review bank transfer submissions', color: '#f59e0b' },
    { href: '/admin/bank-transfer-settings', icon: <BankOutlined />, title: 'Bank Transfer Settings', desc: 'Configure bank account details', color: '#06b6d4' },
    { href: '/admin/notifications', icon: <BellOutlined />, title: 'Send Notifications', desc: 'Push notifications to users', color: '#8b5cf6' },
    { href: '/admin/referral-discounts', icon: <TeamOutlined />, title: 'Referral Discounts', desc: 'Manage referral discount assignments', color: '#06b6d4' },
  ];

  const planColumns = [
    { title: 'Plan', dataIndex: 'plan_name', key: 'plan', render: (v) => <Text strong className="capitalize">{v}</Text> },
    { title: 'Active', dataIndex: 'active_subscribers', key: 'active' },
    { title: 'Gross', dataIndex: 'gross_revenue', key: 'gross', render: (v) => formatCurrency(v) },
    { title: 'Discounts', dataIndex: 'discounted_revenue', key: 'discount', render: (v) => <Text type="warning">{formatCurrency(v)}</Text> },
    { title: 'Actual', dataIndex: 'actual_revenue', key: 'actual', render: (v) => <Text type="success" strong>{formatCurrency(v)}</Text> },
    { title: 'MRR', dataIndex: 'projected_monthly_revenue', key: 'mrr', render: (v) => formatCurrency(v) },
  ];

  const txColumns = [
    {
      title: 'Customer',
      key: 'customer',
      render: (_, r) => (
        <div>
          <Text strong>{r.customer_name}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.customer_email || 'No email'} · {r.plan_name} · {r.billing_cycle}</Text>
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'transaction_date',
      key: 'date',
      width: 120,
      render: (v) => new Date(v).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    { title: 'Gross', dataIndex: 'gross_amount', key: 'gross', render: (v) => formatCurrency(v) },
    { title: 'Discount', dataIndex: 'discount_amount', key: 'discount', render: (v) => <Text type="warning">{formatCurrency(v)}</Text> },
    { title: 'Paid', dataIndex: 'net_amount', key: 'net', render: (v) => <Text type="success" strong>{formatCurrency(v)}</Text> },
  ];

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">

          {/* Header */}
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={3} className="!mb-0">Admin Dashboard</Title>
              <Text type="secondary">Manage promo codes, users, subscriptions, and more</Text>
            </Col>
            <Col>
              <Button type="primary" onClick={fetchDashboardStats} loading={loading}>Refresh</Button>
            </Col>
          </Row>

          {lastUpdated && <Text type="secondary" className="text-xs">Last refreshed: {lastUpdated}</Text>}

          {loading ? (
            <div className="text-center py-12"><Spin size="large" /></div>
          ) : error ? (
            <Alert type="error" message={error} showIcon />
          ) : (
            <>
              {/* Stat Cards */}
              <Row gutter={[16, 16]}>
                {statCards.map((s, i) => (
                  <Col xs={12} md={8} xl={6} key={i}>
                    <Card
                      bordered={false}
                      className={`!rounded-xl shadow-sm overflow-hidden ${s.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                      onClick={s.onClick}
                    >
                      <Statistic
                        title={s.title}
                        value={s.value}
                        prefix={s.icon}
                        valueStyle={{ color: s.color, fontWeight: 700, fontSize: s.isText ? 18 : 28 }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* Financial Model - Super Admin */}
              {user?.admin_role === 'super_admin' && financial && (
                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <Card bordered={false} className="!rounded-2xl overflow-hidden" bodyStyle={{ padding: 0 }}>
                      <div className="px-6 py-5 border-b border-white/10"
                        style={{ background: 'radial-gradient(circle at top left, rgba(56,189,248,0.28), transparent 45%), linear-gradient(135deg, #0f172a, rgba(30,41,59,0.92))' }}>
                        <Text className="!text-xs !uppercase" style={{ letterSpacing: '0.24em', color: 'rgba(186,230,253,0.8)' }}>
                          Financial Model
                        </Text>
                        <Title level={4} className="!text-white !mt-1 !mb-0">Subscription economics at a glance</Title>
                      </div>
                      <div className="p-6">
                        <Row gutter={[16, 16]}>
                          {[
                            { label: 'List Price Value', value: formatCurrency(financial.grossSubscriptionValue), desc: 'Booked subscription value before promo discounts.' },
                            { label: 'Collected Cash', value: formatCurrency(financial.collectedRevenue), desc: 'Successful subscription payments before refunds.', color: '#10b981' },
                            { label: 'ARR Projection', value: formatCurrency(financial.annualRecurringRevenue), desc: "Annualized recurring revenue from today's active paid subscribers.", color: '#f59e0b' },
                            { label: 'Realization Rate', value: `${Number(financial.revenueRealizationRate || 0).toFixed(1)}%`, desc: 'Share of list-price value converted into collected cash.', color: '#a855f7' },
                          ].map((item, i) => (
                            <Col xs={12} key={i}>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                                <Text type="secondary" className="text-xs uppercase" style={{ letterSpacing: '0.18em' }}>{item.label}</Text>
                                <div className="text-2xl font-bold mt-2" style={{ color: item.color || '#111827' }}>{item.value}</div>
                                <Text type="secondary" className="text-xs mt-2 block">{item.desc}</Text>
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} xl={10}>
                    <Card title="Finance Signals" bordered={false} className="!rounded-2xl shadow"
                      extra={<Tag>{financial.activePaidSubscribers || 0} active paid users</Tag>}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Discounted payments">
                          {financial.discountedTransactionsCount || 0}
                          <Text type="secondary" className="block text-xs">
                            Captured cash: {formatCurrency(financial.discountedCollections || 0)}
                          </Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Average payment value">
                          {formatCurrency(financial.averageTransactionValue || 0)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Refunded revenue">
                          {formatCurrency(financial.refundedRevenue || 0)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Current MRR">
                          {formatCurrency(financial.monthlyRecurringRevenue || 0)}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Plan Performance + Recent Transactions */}
              {user?.admin_role === 'super_admin' && financial && (
                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <Card title="Plan Performance" bordered={false} className="!rounded-2xl shadow">
                      <Table
                        dataSource={financial.planPerformance || []}
                        columns={planColumns}
                        rowKey="plan_name"
                        pagination={false}
                        size="small"
                        scroll={{ x: 600 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} xl={10}>
                    <Card title="Recent Subscription Payments" bordered={false} className="!rounded-2xl shadow">
                      <Table
                        dataSource={financial.recentTransactions || []}
                        columns={txColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: 500 }}
                        locale={{ emptyText: 'No subscription payments recorded yet.' }}
                      />
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Admin AI Engine */}
              {user?.admin_role === 'super_admin' && (
                <Card
                  title={<span><RobotOutlined /> Admin AI Engine</span>}
                  bordered={false}
                  className="!rounded-xl shadow-sm"
                  extra={<Link href="/admin/ai-engine"><Button type="primary">Open AI Engine →</Button></Link>}
                >
                  <Paragraph type="secondary">
                    Dr. Q Admin has real-time access to platform analytics. Only super admins and explicitly granted admins can use it.
                  </Paragraph>
                  <AdminAIGrantManager />
                </Card>
              )}

              {/* Quick Actions */}
              <Card title="Quick Actions" bordered={false} className="!rounded-xl shadow-sm">
                <Row gutter={[16, 16]}>
                  {quickActions.map((a) => (
                    <Col xs={24} md={8} key={a.href}>
                      <Link href={a.href}>
                        <Card bordered hoverable className="!rounded-lg" style={{ borderLeft: `4px solid ${a.color}` }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${a.color}15`, color: a.color, fontSize: 20 }}>
                              {a.icon}
                            </div>
                            <div className="min-w-0">
                              <Text strong>{a.title}</Text>
                              <br />
                              <Text type="secondary" className="text-xs">{a.desc}</Text>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </Col>
                  ))}
                </Row>
              </Card>

              {/* Security Notifications */}
              <Card
                title="Security Notifications"
                bordered={false}
                className="!rounded-xl shadow-sm"
                extra={<Button size="small" onClick={fetchSecurityAlerts} loading={alertsLoading}>Refresh</Button>}
              >
                {alertsLoading ? (
                  <div className="text-center py-8"><Spin /></div>
                ) : securityAlerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No OTP notifications yet</div>
                ) : (
                  <div className="space-y-3">
                    {securityAlerts.map((log) => (
                      <Alert
                        key={log.id}
                        type="warning"
                        showIcon
                        message={`OTP created for ${log.details?.user_email || 'a user'}`}
                        description={
                          <>
                            Expires {log.details?.expires_at ? new Date(log.details.expires_at).toLocaleString() : 'soon'}
                            <br />
                            Logged {new Date(log.created_at).toLocaleString()}
                          </>
                        }
                      />
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
