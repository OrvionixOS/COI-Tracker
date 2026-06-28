import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  s1_problem: 5000,
  s2_solution: 4500,
  s3_features1: 5500,
  s4_features2: 5000,
  s5_payoff: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  s1_problem: Scene1,
  s2_solution: Scene2,
  s3_features1: Scene3,
  s4_features2: Scene4,
  s5_payoff: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  // suppress unused warning — currentScene used by persistent layers
  void currentScene;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#1a1714]">
      {/* Background Video */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen">
        <video
          src={`${import.meta.env.BASE_URL}videos/bg-dark-gold.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Persistent overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1714] via-transparent to-[#1a1714]/50 pointer-events-none" />

      {/* Persistent Gold Accents */}
      <motion.div
        className="absolute top-0 left-0 w-full h-[2px] bg-[#c9a84c]"
        animate={{
          scaleX: [0, 1, 0, 1, 0][sceneIndex] ?? 1,
          opacity: [0.2, 0.8, 0.3, 0.9, 0.1][sceneIndex] ?? 0.5,
          transformOrigin: ['left', 'right', 'left', 'center', 'right'][sceneIndex] ?? 'left',
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute bottom-0 right-0 w-[1px] h-full bg-[#c9a84c]/20"
        animate={{
          scaleY: [1, 0.5, 1, 0.8, 1][sceneIndex] ?? 1,
          opacity: [0.1, 0.4, 0.1, 0.5, 0.2][sceneIndex] ?? 0.2,
          transformOrigin: ['top', 'bottom', 'center', 'bottom', 'top'][sceneIndex] ?? 'top',
        }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      />

      <AnimatePresence mode="sync">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
