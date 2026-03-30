import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';
import { adminAPI } from '../../services/api';

export default function AdminPaystackPlans() {
  const [plans, setPlans] = useState([]);
  const [formState, setFormState] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPaystackPlanMappings();
      const nextPlans = response.data?.plans || [];
      setPlans(nextPlans);
      setFormState(Object.fromEntries(nextPlans.map((plan) => ([plan.id, {
        paystack_plan_code: plan.paystack_plan_code || '',
        paystack_plan_code_annual: plan.paystack_plan_code_annual || ''
      }]))));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Paystack plan mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (planId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value.toUpperCase()
      }
    }));
  };

  const handleSave = async (plan) => {
    try {
      setSavingPlanId(plan.id);
      const payload = formState[plan.id] || {};
      await adminAPI.updatePaystackPlanMapping(plan.id, payload);
      toast.success(`${plan.name} mapping updated`);
      await fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan mapping');
    } finally {
      setSavingPlanId('');
    }
  };

  return (
    <ProtectedAdminRoute superAdminOnly>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Paystack Plan Mapping</h2>
            <p className="text-gray-600 mt-1">
              Manage the Paystack monthly and annual plan codes used for recurring billing. This page is restricted to Super Admins.
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Paid plans require both a monthly and annual Paystack plan code. Free plans may be left blank.
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Monthly Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Annual Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Monthly Paystack Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Annual Paystack Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {plans.map((plan) => {
                      const values = formState[plan.id] || {
                        paystack_plan_code: '',
                        paystack_plan_code_annual: ''
                      };
                      const isPaidPlan = Number(plan.price_monthly || 0) > 0;

                      return (
                        <tr key={plan.id} className="hover:bg-gray-50 align-top">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-semibold text-gray-900 capitalize">{plan.name}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            ₦{Number(plan.price_monthly || 0).toLocaleString('en-NG')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            ₦{Number(plan.price_annual || 0).toLocaleString('en-NG')}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={values.paystack_plan_code}
                              onChange={(event) => handleChange(plan.id, 'paystack_plan_code', event.target.value)}
                              placeholder={isPaidPlan ? 'PLN_MONTHLY_CODE' : 'Not required'}
                              className="w-full min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={values.paystack_plan_code_annual}
                              onChange={(event) => handleChange(plan.id, 'paystack_plan_code_annual', event.target.value)}
                              placeholder={isPaidPlan ? 'PLN_ANNUAL_CODE' : 'Not required'}
                              className="w-full min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSave(plan)}
                              disabled={savingPlanId === plan.id}
                              className="px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 disabled:opacity-60 text-sm font-medium"
                            >
                              {savingPlanId === plan.id ? 'Saving...' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
