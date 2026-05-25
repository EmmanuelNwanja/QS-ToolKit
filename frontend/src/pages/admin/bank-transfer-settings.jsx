import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function BankTransferSettings() {
  const [settings, setSettings] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    additional_instructions: '',
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getBankTransferSettings();
      const s = data?.data;
      if (s) {
        setSettings({
          bank_name: s.bank_name || '',
          account_name: s.account_name || '',
          account_number: s.account_number || '',
          additional_instructions: s.additional_instructions || '',
          is_active: s.is_active !== false,
        });
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.bank_name.trim() || !settings.account_name.trim() || !settings.account_number.trim()) {
      toast.error('Bank name, account name, and account number are required');
      return;
    }
    setSaving(true);
    try {
      await adminAPI.updateBankTransferSettings(settings);
      toast.success('Bank transfer settings updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedAdminRoute requiredPermission="manage_billing">
      <AdminLayout>
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Bank Transfer Settings</h2>
            <p className="text-gray-600 mt-1">Configure the bank account details shown to users during checkout</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name <span className="text-red-500">*</span></label>
                <input value={settings.bank_name} onChange={e => setSettings(s => ({ ...s, bank_name: e.target.value }))}
                  placeholder="e.g. GTBank, Access Bank, etc."
                  className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name <span className="text-red-500">*</span></label>
                <input value={settings.account_name} onChange={e => setSettings(s => ({ ...s, account_name: e.target.value }))}
                  placeholder="e.g. QSToolkit Technologies Ltd"
                  className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number <span className="text-red-500">*</span></label>
                <input value={settings.account_number} onChange={e => setSettings(s => ({ ...s, account_number: e.target.value }))}
                  placeholder="e.g. 0123456789"
                  className="input w-full" maxLength={10} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions</label>
                <textarea value={settings.additional_instructions} onChange={e => setSettings(s => ({ ...s, additional_instructions: e.target.value }))}
                  placeholder="e.g. Please use your email as narration when transferring"
                  className="input w-full" rows={3} />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_active" checked={settings.is_active}
                  onChange={e => setSettings(s => ({ ...s, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-700 focus:ring-primary-700" />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (show to users)</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary px-6">
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button onClick={fetchSettings} disabled={loading}
                  className="btn-secondary px-6">
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Preview</p>
            <p>These bank details will be shown to users when they select &ldquo;Direct Bank Transfer&rdquo; on the subscription page.</p>
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
