'use client';
// Client component hook that constructs an S2 client in the browser — the
// NEXT_PUBLIC_ token is inlined into the bundle and visible to every visitor.
import { useEffect, useState } from 'react';
import { S2 } from '@s2-dev/streamstore';

export function useLiveFeed(basinName: string, streamName: string) {
  const [records, setRecords] = useState<string[]>([]);

  useEffect(() => {
    const s2 = new S2({ accessToken: process.env.NEXT_PUBLIC_S2_ACCESS_TOKEN! });
    const stream = s2.basin(basinName).stream(streamName);

    let cancelled = false;
    (async () => {
      const { tail } = await stream.checkTail();
      if (!cancelled) setRecords((prev) => [...prev, `tail at ${tail.seqNum}`]);
    })();

    return () => {
      cancelled = true;
    };
  }, [basinName, streamName]);

  return records;
}
