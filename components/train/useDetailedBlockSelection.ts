"use client";

import { useEffect, useMemo, useState } from "react";
import type { DetailedBlock, DetailedBlockDay } from "@/lib/types";

export function useDetailedBlockSelection(detailedBlocks: DetailedBlock[]) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  useEffect(() => {
    if (detailedBlocks.length === 0) {
      setSelectedBlockId(null);
      setSelectedDayId(null);
      return;
    }
    if (!selectedBlockId || !detailedBlocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(detailedBlocks[detailedBlocks.length - 1].id);
    }
  }, [detailedBlocks, selectedBlockId]);

  const block = useMemo(
    () => detailedBlocks.find((item) => item.id === selectedBlockId) ?? null,
    [detailedBlocks, selectedBlockId]
  );

  useEffect(() => {
    if (!block) {
      setSelectedDayId(null);
      return;
    }
    if (!selectedDayId || !block.days.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(block.days[0]?.id ?? null);
    }
  }, [block, selectedDayId]);

  const dayIndex = useMemo(() => {
    if (!block || !selectedDayId) return -1;
    return block.days.findIndex((day) => day.id === selectedDayId);
  }, [block, selectedDayId]);

  const day: DetailedBlockDay | null =
    dayIndex >= 0 && block ? block.days[dayIndex] : null;

  const selectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    setSelectedDayId(null);
  };

  return {
    selectedBlockId,
    selectedDayId,
    block,
    day,
    dayIndex,
    selectBlock,
    selectDay: setSelectedDayId,
  };
}
