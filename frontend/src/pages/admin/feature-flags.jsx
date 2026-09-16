import { useState, useEffect } from 'react';
import { Table, Card, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, Switch, message, Slider, Popconfirm } from 'antd';
import { ReloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

const api = {
  list: () => adminAPI.get('/feature-flags'),
  create: (data) => adminAPI.post('/feature-flags', data),
  update: (id, data) => adminAPI.patch(`/feature-flags/${id}`, data),
  remove: (id) => adminAPI.delete(`/feature-flags/${id}`),
};

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const { data } = await api.list();
      setFlags(data?.data?.flags || []);
    } catch { message.error('Failed to load flags'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleToggle = async (record, enabled) => {
    try {
      await api.update(record.id, { enabled_globally: enabled });
      message.success(`${record.feature_key} ${enabled ? 'enabled' : 'disabled'}`);
      fetchFlags();
    } catch { message.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.remove(id);
      message.success('Flag deleted');
      fetchFlags();
    } catch { message.error('Failed to delete'); }
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      enabled_for_plans: record.enabled_for_plans || [],
      enabled_for_users: record.enabled_for_users || [],
    });
    setModal(true);
  };

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ rollout_percentage: 100, environment: 'all', enabled_globally: false });
    setModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.update(editing.id, values);
        message.success('Flag updated');
      } else {
        await api.create(values);
        message.success('Flag created');
      }
      setModal(false);
      fetchFlags();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const columns = [
    {
      title: 'Feature',
      dataIndex: 'feature_key',
      key: 'key',
      render: (v) => <span className="font-mono text-sm">{v}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'desc',
      ellipsis: true,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled_globally',
      key: 'enabled',
      width: 100,
      render: (v, r) => <Switch checked={v} onChange={(c) => handleToggle(r, c)} size="small" />,
    },
    {
      title: 'Plans',
      dataIndex: 'enabled_for_plans',
      key: 'plans',
      render: (v) => v?.length ? <Space wrap>{v.map(p => <Tag key={p}>{p}</Tag>)}</Space> : <Tag>All</Tag>,
    },
    {
      title: 'Rollout',
      dataIndex: 'rollout_percentage',
      key: 'rollout',
      width: 100,
      render: (v) => <span className="text-sm">{v}%</span>,
    },
    {
      title: 'Env',
      dataIndex: 'environment',
      key: 'env',
      width: 80,
      render: (v) => <Tag color={v === 'all' ? 'default' : v === 'staging' ? 'orange' : 'green'}>{v}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <Popconfirm title="Delete this flag?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Feature Flags</h2>
              <p className="text-sm text-gray-500">Control feature rollouts, plans, and environments</p>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchFlags}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>Add Flag</Button>
            </Space>
          </div>

          <Card bordered={false}>
            <Table dataSource={flags} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
          </Card>

          <Modal
            title={editing ? 'Edit Feature Flag' : 'Create Feature Flag'}
            open={modal}
            onOk={handleSave}
            onCancel={() => setModal(false)}
            width={600}
          >
            <Form form={form} layout="vertical">
              {!editing && (
                <Form.Item name="feature_key" label="Feature Key" rules={[{ required: true }]}>
                  <Input placeholder="e.g. classroom, new_dashboard" className="font-mono" />
                </Form.Item>
              )}
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={2} placeholder="What does this flag control?" />
              </Form.Item>
              <Form.Item name="enabled_globally" label="Enabled Globally" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="enabled_for_plans" label="Enabled for Plans">
                <Select mode="multiple" options={['free', 'basic', 'pro', 'enterprise'].map(p => ({ label: p, value: p }))} placeholder="Leave empty for all plans" />
              </Form.Item>
              <Form.Item name="rollout_percentage" label="Rollout Percentage">
                <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
              </Form.Item>
              <Form.Item name="environment" label="Environment">
                <Select options={[{ label: 'All', value: 'all' }, { label: 'Staging Only', value: 'staging' }, { label: 'Production Only', value: 'production' }]} />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
