import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import { integrityAPI } from '../../services/api';

export default function VerifyPage() {
  const router = useRouter();
  const [token, setToken] = useState(router.query.token || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!token.trim()) { toast.error('Enter a certificate token'); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await integrityAPI.verify(token.trim());
      setResult(data);
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadCert = async () => {
    try {
      const { data } = await integrityAPI.downloadCert(token.trim());
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QSToolkit-Certificate-${token.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <Layout title="Verify Document">
      <Head><title>Verify Document | QSToolkit</title></Head>
      <div className="max-w-xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Document Integrity</h1>
        <p className="text-sm text-gray-500 mb-6">Enter a certificate token to verify a document has not been tampered with.</p>

        <div className="flex gap-2 mb-6">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Certificate token"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button onClick={verify} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {result && (
          <div className={`border rounded-lg p-5 ${result.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-lg ${result.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.valid ? '✓' : '✗'}
              </span>
              <span className={`font-semibold ${result.valid ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.valid ? 'Document Verified' : 'Verification Failed'}
              </span>
            </div>

            {result.isRevoked && (
              <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700 font-medium">
                This certificate has been revoked{result.revokedAt ? ` on ${new Date(result.revokedAt).toLocaleString()}` : ''}.
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Document Type</span>
                <span className="font-medium text-gray-900">{result.documentType?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Title</span>
                <span className="font-medium text-gray-900">{result.summary?.title || 'N/A'}</span>
              </div>
              {result.summary?.totalAmount != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-medium text-gray-900">₦{Number(result.summary.totalAmount).toLocaleString()}</span>
                </div>
              )}
              {result.summary?.clientName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Client</span>
                  <span className="font-medium text-gray-900">{result.summary.clientName}</span>
                </div>
              )}
              <hr className="border-gray-200" />
              <div className="flex justify-between">
                <span className="text-gray-600">Hash Match</span>
                <span className={result.hashMatch ? 'text-emerald-600' : 'text-red-600'}>{result.hashMatch ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Chain Integrity</span>
                <span className={result.chainValid ? 'text-emerald-600' : 'text-red-600'}>{result.chainValid ? 'Intact' : 'Broken'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Certified At</span>
                <span className="font-medium text-gray-900">{result.createdAt ? new Date(result.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="mt-2">
                <span className="text-gray-600 text-xs">SHA-256:</span>
                <p className="font-mono text-xs text-gray-500 break-all mt-0.5">{result.hash}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={downloadCert} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50">
                Download Certificate
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
