import { useCallback, useRef, useState } from "react";
import type { ProcessingJob, ProcessedAsset } from "../types/media";
import { createJobId } from "../utils/imageProcessing";

export function useBatchProcessing(
  processor: (file: File, signal: AbortSignal) => Promise<ProcessedAsset>,
) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const processFiles = useCallback(async (files: File[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const nextJobs = files.map((file) => ({
      id: createJobId(file),
      file,
      status: "pending" as const,
    }));
    setJobs(nextJobs);

    for (const job of nextJobs) {
      if (controller.signal.aborted) break;
      setJobs((current) => current.map((item) =>
        item.id === job.id ? { ...item, status: "processing" } : item
      ));
      try {
        if (job.file.size > 100 * 1024 * 1024) throw new Error("File exceeds the 100 MB browser-processing limit");
        const result = await processor(job.file, controller.signal);
        if (controller.signal.aborted) break;
        setJobs((current) => current.map((item) =>
          item.id === job.id ? { ...item, status: "done", result } : item
        ));
      } catch (error) {
        setJobs((current) => current.map((item) =>
          item.id === job.id
            ? { ...item, status: "error", error: error instanceof Error ? error.message : "Processing failed" }
            : item
        ));
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }, [processor]);

  return {
    jobs,
    processFiles,
    reset() {
      controllerRef.current?.abort();
      setJobs([]);
    },
    cancel() {
      controllerRef.current?.abort();
      setJobs((current) => current.map((job) =>
        job.status === "processing" || job.status === "pending" ? { ...job, status: "cancelled" } : job
      ));
    },
  };
}
