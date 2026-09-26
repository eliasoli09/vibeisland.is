"use client";

import { useEffect, useRef } from "react";

export function PixelPongGame({ gamePath }: { gamePath: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = iframeRef.current;

    // React may reactivate a cached route after its effects were cleaned up.
    if (frame && frame.getAttribute("src") !== gamePath) {
      frame.src = gamePath;
    }

    return () => {
      if (frame) {
        frame.src = "about:blank";
      }
    };
  }, [gamePath]);

  return (
    <iframe
      ref={iframeRef}
      src={gamePath}
      title="Pixel Pong - Claude á móti Codex"
      allow="fullscreen; autoplay"
      allowFullScreen
      className="block h-full w-full border-0 bg-[#070b1a]"
    />
  );
}
