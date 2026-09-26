"use client";

import { useEffect, useRef } from "react";

type ProjectEmbedProps = {
  src: string;
  title: string;
  loading?: "eager" | "lazy";
};

export function ProjectEmbed({ src, title, loading = "eager" }: ProjectEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = iframeRef.current;

    // React may reactivate a cached route after its effects were cleaned up.
    if (frame && frame.getAttribute("src") !== src) {
      frame.src = src;
    }

    return () => {
      if (frame) {
        frame.src = "about:blank";
      }
    };
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      loading={loading}
      allow="fullscreen; autoplay"
      allowFullScreen
      className="block h-full w-full border-0 bg-[#070b1a]"
    />
  );
}
