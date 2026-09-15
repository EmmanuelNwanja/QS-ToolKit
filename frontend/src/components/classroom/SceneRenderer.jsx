import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const SCENE_COMPONENTS = {
  lecture:       dynamic(() => import('./LectureScene')),
  quiz:          dynamic(() => import('./QuizScene')),
  boq:           dynamic(() => import('./BOQScene')),
  rate_analysis: dynamic(() => import('./RateAnalysisScene')),
  measurement:   dynamic(() => import('./MeasurementScene')),
  cost_plan:     dynamic(() => import('./CostPlanScene')),
  pbl:           dynamic(() => import('./PBLScene')),
  discussion:    dynamic(() => import('./DiscussionScene')),
};

function LoadingFallback() {
  return (
    <div className="card text-center py-16">
      <motion.span
        className="text-4xl block mb-4"
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        🧠
      </motion.span>
      <p className="text-sm text-gray-500">Loading scene…</p>
    </div>
  );
}

function PlaceholderScene({ sceneType }) {
  return (
    <div className="card text-center py-16">
      <p className="text-4xl mb-3">🚧</p>
      <p className="text-sm font-medium text-gray-700 mb-1">
        {sceneType?.replace(/_/g, ' ')} scene coming soon
      </p>
      <p className="text-xs text-gray-400">This scene type is under development.</p>
    </div>
  );
}

export default function SceneRenderer({ scene, onComplete, onNext }) {
  const [SceneComponent, setSceneComponent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const Comp = SCENE_COMPONENTS[scene?.scene_type];
    setSceneComponent(() => Comp || null);
    setLoading(false);
  }, [scene?.scene_type, scene?.id]);

  if (loading) return <LoadingFallback />;
  if (!SceneComponent) return <PlaceholderScene sceneType={scene?.scene_type} />;

  return <SceneComponent scene={scene} onComplete={onComplete} onNext={onNext} />;
}
