import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { academyAPI } from '../services/api';

/**
 * ResourceRecommendations - Shows relevant academy resources based on topics or weak areas
 * Used in: exam results, pathway modules, dashboard
 */
export default function ResourceRecommendations({ 
  topics = [], 
  title = 'Recommended Resources',
  compact = false,
  maxItems = 3 
}) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      if (!topics.length) {
        setLoading(false);
        return;
      }
      try {
        // Search for resources matching the topics
        const searchQuery = topics.slice(0, 3).join(' ');
        const res = await academyAPI.getResources({ search: searchQuery, limit: maxItems });
        setResources(res.data?.resources || []);
      } catch {
        // Silently fail - resource recommendations are optional
      } finally {
        setLoading(false);
      }
    }
    fetchResources();
  }, [topics, maxItems]);

  if (loading || resources.length === 0) return null;

  const typeIcons = {
    article: '📄',
    video: '🎬',
    quiz: '📝',
    case_study: '📋'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📚</span>
        <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
      </div>
      
      <div className={`space-y-2 ${compact ? '' : 'sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3'}`}>
        {resources.slice(0, maxItems).map((resource, idx) => (
          <Link
            key={resource.id}
            href={`/academy/resources?highlight=${resource.id}`}
            className={`flex items-start gap-2 p-2 rounded-lg bg-white/60 hover:bg-white transition-colors ${compact ? '' : 'sm:block'}`}
          >
            <span className="text-lg flex-shrink-0">{typeIcons[resource.resource_type] || '📄'}</span>
            <div className="min-w-0">
              <p className="font-medium text-xs text-gray-800 truncate">{resource.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{resource.category}</p>
            </div>
          </Link>
        ))}
      </div>
      
      <Link 
        href="/academy/resources" 
        className="inline-block mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        Browse all resources →
      </Link>
    </motion.div>
  );
}

/**
 * InlineTopicTags - Shows clickable topic tags that link to filtered resources
 */
export function InlineTopicTags({ topics = [], className = '' }) {
  if (!topics.length) return null;
  
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {topics.map((topic, idx) => (
        <Link
          key={idx}
          href={`/academy/resources?topic=${encodeURIComponent(topic)}`}
          className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full hover:bg-primary-100 transition-colors"
        >
          {topic}
        </Link>
      ))}
    </div>
  );
}
