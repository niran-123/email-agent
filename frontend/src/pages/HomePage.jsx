import { Mail, Zap, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';

const FEATURES = [
  {
    icon: Mail,
    title: 'Gmail API Integration',
    description: 'Read-only Gmail OAuth2 access with AES-256-GCM encrypted token storage and MIME email parsing.',
    badge: 'Phase 2 (Ready)',
    badgeVariant: 'success',
  },
  {
    icon: Shield,
    title: 'Secure Authentication',
    description: 'Cryptographic state validation against CSRF, JWT authentication, and automatic token refresh.',
    badge: 'Phase 2 (Ready)',
    badgeVariant: 'success',
  },
  {
    icon: Zap,
    title: 'AI Processing & WhatsApp',
    description: 'Smart classification, reply drafting with GPT-4, and instant notifications via WhatsApp Cloud API.',
    badge: 'Phase 3 (Next)',
    badgeVariant: 'warning',
  },
];

export default function HomePage() {
  const { user, primaryAccount, isAuthenticated, loginWithGoogle } = useAuth();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-10 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Phase 2 Implemented — Google OAuth & Gmail API Ready
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
          Intelligent Email Automation for <span className="text-brand-600">Gmail</span>
        </h1>
        <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
          Connect your Google account with read-only permissions. Securely sync messages, parse MIME structures,
          and prepare for autonomous AI triage.
        </p>

        {/* CTA */}
        <div className="mt-8 flex justify-center gap-3">
          {isAuthenticated ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>Connected as <strong className="text-gray-900">{primaryAccount?.emailAddress || user.email}</strong></span>
              </div>
              <Button as={Link} to="/inbox" iconRight={<ArrowRight size={15} />}>
                Go to Gmail Inbox
              </Button>
            </div>
          ) : (
            <Button
              onClick={loginWithGoogle}
              size="lg"
              icon={
                <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              }
            >
              Connect with Google
            </Button>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map(({ icon: Icon, title, description, badge, badgeVariant }) => (
          <Card key={title} className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 bg-brand-50 rounded-lg">
                <Icon size={22} className="text-brand-600" />
              </div>
              <Badge variant={badgeVariant}>{badge}</Badge>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
