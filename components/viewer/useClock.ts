"use client";

import { useSyncExternalStore } from "react";
import type { Clock } from "@/lib/replay/clock";

/** The clock's time rounded down to `quantum` seconds, so a component re-renders only when the visible value changes. */
export function useClockTime(clock: Clock, quantum = 1): number {
  const get = () => Math.floor(clock.t / quantum) * quantum;
  return useSyncExternalStore(clock.subscribe, get, get);
}

export function useClockPlaying(clock: Clock): boolean {
  const get = () => clock.playing;
  return useSyncExternalStore(clock.subscribe, get, get);
}

export function useClockSpeed(clock: Clock): number {
  const get = () => clock.speed;
  return useSyncExternalStore(clock.subscribe, get, get);
}
