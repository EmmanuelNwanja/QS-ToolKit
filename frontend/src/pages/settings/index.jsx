import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import useAuthStore from '../../context/authStore';
import { userAPI } from '../../services/api';

const TABS = ['Profile', 'Branding', 'Team'];

export default function SettingsPage() {
  const { user, refreshUser } = useAuthStore();
  const [tab, setTab]         = useState('Profile');
  const [profile, setProfile] = useState({ name: '', phone: '', company_name: '', qs_cert_no: '', company_address: '' });
  const [branding, setBranding] = useState({ brand_name: '', company_details: '', contact_info: '', primary_color: '#1a3c5e', secondary_color: '#f59e0b' });
  const [team, setTeam]       = useState({ members: [], pending_invites: [] });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'manager' });
  const [saving, setSaving]   = useState(false);
  const logoRef      = useRef();
  const signatureRef = useRef();

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', phone: user.phone || '', company_name: user.company_name || '', qs_cert_no: user.qs_cert_no || '', company_address: user.company_address || '' });
    }
    userAPI.getProfile().then(res => {
      const u = res.data.user;
      if (u.branding_settings) {
        setBranding({
          brand_name: u.branding_settings.brand_name || '',
          company_details: u.branding_settings.company_details || '',
          contact_info: u.branding_settings.contact_info || '',
          primary_color: u.branding_settings.primary_color || '#1a3c5e',
          secondary_color: u.branding_settings.secondary_color || '#f59e0b'
        });
      }
    }).catch(() => {});
    userAPI.getTeam().then(res => setTeam(res.data)).catch(() => {});
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userAPI.updateProfile(profile);
      await refreshUser();
      toast.success('Profile saved!');
    } catch { toast.error('Could not save profile'); }
    finally { setSaving(false); }
  };

  const saveBranding = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userAPI.updateBranding(branding);
      toast.success('Branding saved!');
    } catch { toast.error('Could not save branding'); }
    finally { setSaving(false); }
  };

  const uploadAsset = async (file, type) => {
    try {
      const fn = type === 'logo' ? userAPI.uploadLogo : userAPI.uploadSignature;
      await fn(file);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!`);
    } catch { toast.error(`Could not upload ${type}`); }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    try {
      await userAPI.inviteMember(inviteForm);
      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: '', role: 'manager' });
      const res = await userAPI.getTeam();
      setTeam(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send invitation');
    }
  };

  const removeTeamMember = async (id) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await userAPI.removeMember(id);
      const res = await userAPI.getTeam();
      setTeam(res.data);
      toast.success('Member removed');
    } catch { toast.error('Could not remove member'); }
  };

  return (
    <ProtectedRoute>
      <Head><title>Settings — QSToolkit</title></Head>
      <Layout title="⚙️ Settings">
        <div className="max-w-3xl space-y-6">

          {/* Tab nav */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === 'Profile' && (
            <form onSubmit={saveProfile} className="card space-y-4">
              <h2 className="section-title">👤 Profile Details</h2>
              {[
                { label: 'Full Name', key: 'name', type: 'text' },
                { label: 'Phone Number', key: 'phone', type: 'tel' },
                { label: 'Company / Practice Name', key: 'company_name', type: 'text' },
                { label: 'NIQS / QS Reg. No.', key: 'qs_cert_no', type: 'text' }
              ].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input type={f.type} className="input" value={profile[f.key]} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="label">Company Address</label>
                <textarea className="input" rows={2} value={profile.company_address} onChange={e => setProfile(p => ({ ...p, company_address: e.target.value }))} />
              </div>
              <div className="pt-2">
                <p className="text-xs text-gray-400 mb-3">Account email: <strong>{user?.email}</strong> (cannot be changed)</p>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
              </div>
            </form>
          )}

          {/* Branding tab */}
          {tab === 'Branding' && (
            <div className="space-y-4">
              <form onSubmit={saveBranding} className="card space-y-4">
                <h2 className="section-title">🎨 Brand Settings</h2>
                <p className="text-sm text-gray-500">These details appear on your BOQs, invoices, and quotations.</p>
                {[
                  { label: 'Brand / Company Name', key: 'brand_name', ph: 'e.g. Obi QS Consult Ltd' },
                  { label: 'Company Details', key: 'company_details', ph: 'RC No., NIQS No., etc.' },
                  { label: 'Contact Info', key: 'contact_info', ph: 'Phone, email, website…' }
                ].map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <input className="input" placeholder={f.ph} value={branding[f.key]} onChange={e => setBranding(b => ({ ...b, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Primary Colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={branding.primary_color} onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                      <input className="input" value={branding.primary_color} onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Accent Colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={branding.secondary_color} onChange={e => setBranding(b => ({ ...b, secondary_color: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                      <input className="input" value={branding.secondary_color} onChange={e => setBranding(b => ({ ...b, secondary_color: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Branding'}</button>
              </form>

              {/* File uploads */}
              <div className="card space-y-4">
                <h2 className="section-title">📁 Upload Assets</h2>
                {[
                  { label: 'Company Logo', ref: logoRef, type: 'logo', desc: 'PNG or JPG, max 5MB. Appears on all documents.' },
                  { label: 'Signature', ref: signatureRef, type: 'signature', desc: 'PNG with transparent background recommended.' }
                ].map(a => (
                  <div key={a.type}>
                    <label className="label">{a.label}</label>
                    <p className="text-xs text-gray-400 mb-2">{a.desc}</p>
                    <input type="file" ref={a.ref} accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && uploadAsset(e.target.files[0], a.type)} />
                    <button type="button" onClick={() => a.ref.current?.click()} className="btn-secondary text-sm">
                      📤 Upload {a.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team tab */}
          {tab === 'Team' && (
            <div className="space-y-4">
              {/* Invite form */}
              <form onSubmit={sendInvite} className="card space-y-3">
                <h2 className="section-title">📩 Invite Team Member</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email Address</label>
                    <input type="email" className="input" placeholder="colleague@example.com"
                      value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select className="input" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary text-sm">Send Invitation</button>
              </form>

              {/* Team members */}
              <div className="card">
                <h2 className="section-title mb-4">👥 Team Members</h2>
                {team.members?.length === 0 ? (
                  <p className="text-sm text-gray-400">No team members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {team.members?.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.email} · <span className="capitalize font-medium">{m.org_role}</span></p>
                        </div>
                        {m.id !== user?.id && (
                          <button onClick={() => removeTeamMember(m.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {team.pending_invites?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pending Invitations</p>
                    {team.pending_invites.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-sm">
                        <span className="text-gray-700">{inv.email}</span>
                        <span className="badge-amber capitalize">{inv.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
