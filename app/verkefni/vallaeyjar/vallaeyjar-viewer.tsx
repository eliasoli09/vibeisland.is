"use client";

import { useEffect, useRef } from "react";

export function VallaeyjarViewer({ viewerPath }: { viewerPath: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = iframeRef.current;

    // React may reactivate a cached route after its effects were cleaned up.
    if (frame && frame.getAttribute("src") !== viewerPath) {
      frame.src = viewerPath;
    }

    return () => {
      if (frame) {
        frame.src = "about:blank";
      }
    };
  }, [viewerPath]);

  return (
    <iframe
      ref={iframeRef}
      src={viewerPath}
      title="Vallaeyjar - gagnvirkur þrívíddarskoðari"
      allow="clipboard-read; clipboard-write; fullscreen"
      allowFullScreen
      className="block h-full w-full border-0 bg-[#060915]"
    />
  );
}
