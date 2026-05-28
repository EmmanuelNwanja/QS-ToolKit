/**
 * useAIEnginePersistence.js
 * Custom hook for persisting AI engine state across sessions.
 * Stores conversation history, drawing annotations, and user preferences
 * in localStorage for quick recovery.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'qst_ai_engine_state';

const DEFAULT_STATE = {
  conversations: {},
  drawingAnnotations: {},
  preferences: {
    showCritique: false,
    autoExportToBoq: true,
    defaultDrawingType: 'floor_plan'
  },
  lastSession: null
};

function loadState() {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save AI engine state:', err);
  }
}

export default function useAIEnginePersistence() {
  const [state, setState] = useState(loadState);

  // Persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Conversation persistence
  const saveConversation = useCallback((sessionId, messages) => {
    setState((prev) => ({
      ...prev,
      conversations: {
        ...prev.conversations,
        [sessionId]: {
          messages,
          updatedAt: new Date().toISOString()
        }
      },
      lastSession: sessionId
    }));
  }, []);

  const loadConversation = useCallback((sessionId) => {
    return state.conversations[sessionId]?.messages || [];
  }, [state.conversations]);

  const clearConversation = useCallback((sessionId) => {
    setState((prev) => {
      const { [sessionId]: _, ...rest } = prev.conversations;
      return { ...prev, conversations: rest };
    });
  }, []);

  // Drawing annotation persistence
  const saveAnnotation = useCallback((annotationId, data) => {
    setState((prev) => ({
      ...prev,
      drawingAnnotations: {
        ...prev.drawingAnnotations,
        [annotationId]: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      }
    }));
  }, []);

  const loadAnnotation = useCallback((annotationId) => {
    return state.drawingAnnotations[annotationId] || null;
  }, [state.drawingAnnotations]);

  // Preferences
  const setPreference = useCallback((key, value) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }));
  }, []);

  const getPreference = useCallback((key) => {
    return state.preferences[key];
  }, [state.preferences]);

  return {
    state,
    saveConversation,
    loadConversation,
    clearConversation,
    saveAnnotation,
    loadAnnotation,
    setPreference,
    getPreference
  };
}
