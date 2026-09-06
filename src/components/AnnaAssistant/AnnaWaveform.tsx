import React, { useEffect, useRef } from 'react';
import { AnnaStatus } from '../../types/anna';

interface AnnaWaveformProps {
  status: AnnaStatus;
  audioLevel: number;
  audioSource: 'user' | 'anna';
  isMuted?: boolean;
}

export const AnnaWaveform: React.FC<AnnaWaveformProps> = ({
  status,
  audioLevel,
  audioSource,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = 320);
    const height = (canvas.height = 140);
    const numBars = 32;

    const render = () => {
      // Smooth interpolation of audio level
      const targetLevel = status === 'listening' || status === 'speaking' ? Math.max(audioLevel, 0.08) : 0.04;
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.2;
      const level = smoothedLevelRef.current;

      phaseRef.current += status === 'speaking' ? 0.08 : status === 'listening' ? 0.04 : 0.015;
      const phase = phaseRef.current;

      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const barWidth = 4;
      const spacing = (width - numBars * barWidth) / (numBars + 1);

      // Select color theme based on status and source
      let primaryColor = 'rgba(20, 184, 166, '; // Teal/Emerald for listening
      if (status === 'speaking') {
        primaryColor = 'rgba(56, 189, 248, '; // Sky blue for Anna speaking
      } else if (status === 'emergency') {
        primaryColor = 'rgba(239, 68, 68, '; // Crimson for emergency
      } else if (status === 'connecting') {
        primaryColor = 'rgba(168, 85, 247, '; // Violet for connecting
      } else if (status === 'interrupted') {
        primaryColor = 'rgba(245, 158, 11, '; // Amber for interrupted
      } else if (status === 'disconnected') {
        primaryColor = 'rgba(100, 116, 139, '; // Slate for disconnected
      }

      // Draw subtle background ambient glow
      const gradient = ctx.createRadialGradient(width / 2, centerY, 10, width / 2, centerY, 80);
      gradient.addColorStop(0, `${primaryColor}${Math.min(0.35, level * 0.6)})`);
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw audio bars
      for (let i = 0; i < numBars; i++) {
        const x = spacing + i * (barWidth + spacing);
        const normX = (i - numBars / 2) / (numBars / 2);
        const windowCurve = Math.cos(normX * (Math.PI / 2)); // Hanning-style window

        // Multi-harmonic oscillation
        const wave =
          Math.sin(phase + i * 0.35) * 0.45 +
          Math.sin(phase * 1.5 + i * 0.2) * 0.35 +
          Math.cos(phase * 0.8 - i * 0.25) * 0.2;

        let barHeight = Math.max(4, Math.abs(wave) * level * 100 * windowCurve);

        if (status === 'disconnected') {
          barHeight = 4 + Math.sin(phase + i * 0.2) * 2;
        }

        const topY = centerY - barHeight / 2;

        // Gradient for each bar
        const barGrad = ctx.createLinearGradient(x, topY, x, topY + barHeight);
        barGrad.addColorStop(0, `${primaryColor}0.95)`);
        barGrad.addColorStop(0.5, `${primaryColor}0.75)`);
        barGrad.addColorStop(1, `${primaryColor}0.4)`);

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, topY, barWidth, barHeight, [2, 2, 2, 2]);
        } else {
          ctx.rect(x, topY, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status, audioLevel, audioSource]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full my-2">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[320px] h-[120px] rounded-xl pointer-events-none"
      />
    </div>
  );
};
