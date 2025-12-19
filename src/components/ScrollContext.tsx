"use client";

import { useEffect, useRef, createContext, useContext, type ReactNode } from "react";

import Lenis from "lenis";

type LenisInstance = InstanceType<typeof Lenis> | null;

const SmoothScrollerContext = createContext<LenisInstance>(null);

export const useSmoothScroller = () => useContext(SmoothScrollerContext);

export default function ScrollContext({ children }: { children: ReactNode }) {
    const lenisRef = useRef<LenisInstance>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (prefersReducedMotion.matches) return; // keep native scroll for accessibility

        const scroller = new Lenis({
            smoothWheel: true,
            // smoothTouch defaults to false; removed to satisfy current typings
        });

        lenisRef.current = scroller;

        const raf = (time: number) => {
            scroller.raf(time);
            rafRef.current = requestAnimationFrame(raf);
        };

        rafRef.current = requestAnimationFrame(raf);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            scroller.destroy();
            lenisRef.current = null;
        };
    }, []);

    return (
        <SmoothScrollerContext.Provider value={lenisRef.current}>
            {children}
        </SmoothScrollerContext.Provider>
    );
}