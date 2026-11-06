import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import Button from '../components/Button.jsx';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-6">
        <AlertTriangle size={36} className="text-gray-400" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">404 — Not Found</h2>
      <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
      <Button as={Link} to="/" icon={<Home size={16} />}>
        Back to Dashboard
      </Button>
    </div>
  );
}

