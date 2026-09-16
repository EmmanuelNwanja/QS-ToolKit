import { useState, useEffect } from 'react';
import { Table, Card, Tag, Button, Space, Modal, Form, InputNumber, Select, message, Tabs } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

const api = adminAPI;

export default function AdminQuotasPage() {
  const [configs, setConfigs] = useState([]);
  const [features, setFeatures] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const { data } = await api.getQuotaConfigs();
      setConfigs(data?.data?.configs || []);
    } catch (err) {
      message.error('Failed to load configs');
    } finally { setLoading(false); }
  };

  const fetchFeatures = async () => {
    try {
      const { data } = await api.getQuotaFeatures();
      setFeatures(data?.data?.features || []);
    } catch {}
  };

  const fetchUsage = async () => {
    try {
      const { data } = await api.getQuotaUsage();
      setUsage(data?.data?.users || []);
    } catch {}
  };

  useEffect(() => { fetchConfigs(); fetchFeatures(); fetchUsage(); }, []);

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setEditModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await api.updateQuotaConfig(editing.id, values);
        message.success('Config updated');
      } else {
        await api.createQuotaConfig(values);
        message.success('Config created');
      }
      setEditModal(false);
      fetchConfigs();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const configColumns = [
    { title: 'Tier', dataIndex: 'tier', key: 'tier', render: (v) => <Tag color={v === 'free' ? 'default' : v === 'pro' ? 'blue' : 'green'}>{v}</Tag> },
    { title: 'Feature', dataIndex: 'feature', key: 'feature' },
    { title: 'Daily', dataIndex: 'max_uses_per_day', key: 'daily', render: (v) => v ?? '∞' },
    { title: 'Weekly', dataIndex: 'max_uses_per_week', key: 'weekly', render: (v) => v ?? '∞' },
    { title: 'Monthly', dataIndex: 'max_uses_per_month', key: 'monthly', render: (v) => v ?? '∞' },
    { title: 'Active', dataIndex: 'is_active', key: 'active', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Action', key: 'action', render: (_, r) => <Button size="small" onClick={() => handleEdit(r)}>Edit</Button> },
  ];

  const usageColumns = [
    { title: 'User', key: 'name', render: (_, r) => <div><strong>{r.name}</strong><br /><span className="text-xs text-gray-500">{r.email}</span></div> },
    { title: 'Features Used', key: 'features', render: (_, r) => (
      <Space wrap>{Object.entries(r.features || {}).map(([f, c]) => <Tag key={f}>{f}: {c}</Tag>)}</Space>
    )},
  ];

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">API Quotas</h2>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => { fetchConfigs(); fetchUsage(); }}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setEditModal(true); }}>
                Add Config
              </Button>
            </Space>
          </div>

          <Tabs items={[
            { key: 'configs', label: 'Rate Limit Configs', children: (
              <Card bordered={false}>
                <Table dataSource={configs} columns={configColumns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
              </Card>
            )},
            { key: 'usage', label: 'User Usage', children: (
              <Card bordered={false}>
                <Table dataSource={usage} columns={usageColumns} rowKey="user_id" loading={loading} pagination={{ pageSize: 20 }} />
              </Card>
            )},
          ]} />

          <Modal
            title={editing ? 'Edit Config' : 'Create Config'}
            open={editModal}
            onOk={handleSave}
            onCancel={() => setEditModal(false)}
          >
            <Form form={form} layout="vertical">
              {!editing && (
                <>
                  <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
                    <Select options={['free', 'basic', 'pro', 'enterprise'].map(t => ({ label: t, value: t }))} />
                  </Form.Item>
                  <Form.Item name="feature" label="Feature" rules={[{ required: true }]}>
                    <Select options={features.map(f => ({ label: f, value: f }))} />
                  </Form.Item>
                </>
              )}
              <Form.Item name="max_uses_per_day" label="Daily Limit"><InputNumber min={0} className="w-full" placeholder="Leave empty for unlimited" /></Form.Item>
              <Form.Item name="max_uses_per_week" label="Weekly Limit"><InputNumber min={0} className="w-full" placeholder="Leave empty for unlimited" /></Form.Item>
              <Form.Item name="max_uses_per_month" label="Monthly Limit"><InputNumber min={0} className="w-full" placeholder="Leave empty for unlimited" /></Form.Item>
              {editing && (
                <Form.Item name="is_active" label="Active">
                  <Select options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
                </Form.Item>
              )}
            </Form>
          </Modal>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
