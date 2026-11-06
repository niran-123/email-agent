import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Database, Wifi, Server, Clock } from 'lucide-react';
import { healthApi } from '../services/api.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

function StatusRow({ icon: Icon, label, status }) {
  const variant = status === 'connected' ? 'success' : status === 'connecting' ? 'warning' : 'error';
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 text-gray-700">
        <Icon size={18} className="text-gray-400" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={variant}>{status}</Badge>
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await healthApi.getHealth();
      setData(res.data);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.response?.data?.error?.message ?? err.message ?? 'Failed to reach the backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastFetched ? `Last checked: ${lastFetched.toLocaleTimeString()}` : 'Checking…'}
          </p>
        </div>
        <Button
          onClick={fetchHealth}
          disabled={loading}
          variant="outline"
          size="sm"
          icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
        >
          Refresh
        </Button>
      </div>

      {loading && !data && <Loading label="Fetching health status…" />}

      {error && (
        <ErrorMessage
          title="Cannot reach backend"
          message={error}
          onRetry={fetchHealth}
        />
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overall status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Overall Status</h3>
              <Badge variant={data.success ? 'success' : 'error'}>
                {data.status}
              </Badge>
            </div>
            <StatusRow icon={Database} label="MongoDB" status={data.services.database} />
            <StatusRow icon={Wifi} label="Redis" status={data.services.redis} />
            <StatusRow icon={Server} label="API Server" status="connected" />
          </Card>

          {/* Meta */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Server Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-mono font-medium">{data.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Environment</span>
                <Badge variant={data.environment === 'production' ? 'info' : 'warning'}>
                  {data.environment}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Clock size={13} /> Server Time
                </span>
                <span className="font-mono text-xs">{new Date(data.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

