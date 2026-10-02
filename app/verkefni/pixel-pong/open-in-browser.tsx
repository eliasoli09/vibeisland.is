"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Invite links shared in Instagram, Messenger, Snapchat, TikTok… open in those apps' built-in
// browsers, where the game's live connection and sound are unreliable. Detect that and send the
// player to their real browser: Android can jump straight to Chrome; iOS apps usually block the
// jump to Safari, so we also show how to do it by hand.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|musical_ly|Bytedance|Line\/|LinkedInApp|Twitter|MicroMessenger|KAKAOTALK|Pinterest|GSA\//i;

type Platform = "android" | "ios" | null;
const noSubscribe = () => () => {};
function detect(): Platform {
  const ua = navigator.userAgent;
  if (!IN_APP.test(ua)) return null;
  return /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : null;
}

export function OpenInBrowser() {
  const platform = useSyncExternalStore(noSubscribe, detect, () => null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!platform || sessionStorage.getItem("pp-escaped")) return;
    sessionStorage.setItem("pp-escaped", "1"); // try the jump once
    const { host, pathname, search } = window.location;
    window.location.href = platform === "android"
      ? `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`
      : `x-safari-https://${host}${pathname}${search}`;
  }, [platform]);

  if (!platform) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div role="dialog" aria-label="Opnaðu leikinn í vafra" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
      <div className="max-w-sm rounded border border-mint/40 bg-black p-6 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-mint">Opnaðu í vafra</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Leikurinn virkar best í {platform === "ios" ? "Safari" : "Chrome"}</h2>
        <p className="mt-3 text-sm leading-6 text-white/65">
          {platform === "ios"
            ? "Ýttu á ••• eða deilitáknið efst eða neðst og veldu „Opna í Safari“ (Open in browser)."
            : "Ýttu á ⋮ efst í horninu og veldu „Opna í Chrome“ (Open in browser)."}
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-5 inline-flex h-12 items-center rounded border border-mint bg-mint px-6 font-mono text-xs font-black uppercase tracking-[0.1em] text-black"
        >
          {copied ? "Hlekkur afritaður" : "Afrita hlekk"}
        </button>
      </div>
    </div>
  );
}
