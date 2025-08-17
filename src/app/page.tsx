// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import { useState, useRef, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Progress } from "@/components/ui/progress";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Badge } from "@/components/ui/badge";
// import {
//   Pause,
//   Play,
//   X,
//   AlertCircle,
//   CheckCircle2,
//   DownloadIcon,
// } from "lucide-react";
// import { cn } from "@/lib/utils";

// interface DownloadItem {
//   id: string;
//   url: string;
//   filename: string;
//   totalSize: number;
//   downloadedSize: number;
//   status: "downloading" | "paused" | "completed" | "error";
//   error?: string;
//   speed: number;
//   eta: number;
//   chunks: Chunk[];
//   startTime: number;
// }

// interface Chunk {
//   id: number;
//   start: number;
//   end: number;
//   completed: boolean;
//   data?: ArrayBuffer;
// }

// const getChunkSize = (fileSize: number): number => {
//   if (fileSize < 50 * 1024 * 1024) return 1 * 1024 * 1024; // 1MB for < 50MB
//   if (fileSize < 500 * 1024 * 1024) return 5 * 1024 * 1024; // 5MB for < 500MB
//   if (fileSize < 5 * 1024 * 1024 * 1024) return 10 * 1024 * 1024; // 10MB for < 5GB
//   if (fileSize < 20 * 1024 * 1024 * 1024) return 20 * 1024 * 1024; // 20MB for < 20GB
//   return 50 * 1024 * 1024; // 50MB for >= 20GB
// };

// export default function ResumableDownloader() {
//   const [downloads, setDownloads] = useState<DownloadItem[]>([]);
//   const [url, setUrl] = useState("");
//   const abortControllers = useRef<Map<string, AbortController>>(new Map());

//   useEffect(() => {
//     const saved = localStorage.getItem("downloads");
//     if (saved) {
//       try {
//         const parsed = JSON.parse(saved);
//         setDownloads(
//           parsed.filter((d: DownloadItem) => d.status !== "completed")
//         );
//       } catch (e) {
//         console.error("Failed to load downloads:", e);
//       }
//     }
//   }, []);

//   useEffect(() => {
//     localStorage.setItem("downloads", JSON.stringify(downloads));
//   }, [downloads]);

//   useEffect(() => {
//     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
//       const activeDownloads = downloads.filter(
//         (d) => d.status === "downloading"
//       );
//       if (activeDownloads.length > 0) {
//         e.preventDefault();
//         e.returnValue =
//           "You have active downloads in progress. Are you sure you want to leave?";
//         return "You have active downloads in progress. Are you sure you want to leave?";
//       }
//     };

//     window.addEventListener("beforeunload", handleBeforeUnload);

//     return () => {
//       window.removeEventListener("beforeunload", handleBeforeUnload);
//     };
//   }, [downloads]);

//   const formatBytes = (bytes: number) => {
//     if (bytes === 0) return "0 B";
//     const k = 1024;
//     const sizes = ["B", "KB", "MB", "GB", "TB"];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
//   };

//   const formatTime = (seconds: number) => {
//     if (!isFinite(seconds)) return "--:--";
//     const h = Math.floor(seconds / 3600);
//     const m = Math.floor((seconds % 3600) / 60);
//     const s = Math.floor(seconds % 60);
//     return h > 0
//       ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
//       : `${m}:${s.toString().padStart(2, "0")}`;
//   };

//   const getFileInfo = async (url: string) => {
//     const response = await fetch(url, { method: "HEAD" });
//     if (!response.ok)
//       throw new Error(`Failed to fetch file info: ${response.statusText}`);

//     const size = Number.parseInt(response.headers.get("content-length") || "0");
//     const supportsRanges = response.headers.get("accept-ranges") === "bytes";

//     let filename = "download";
//     const contentDisposition = response.headers.get("content-disposition");
//     if (contentDisposition) {
//       const match = contentDisposition.match(
//         /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
//       );
//       if (match) filename = match[1].replace(/['"]/g, "");
//     } else {
//       const urlPath = new URL(url).pathname;
//       const urlFilename = urlPath.split("/").pop();
//       if (urlFilename && urlFilename.includes(".")) filename = urlFilename;
//     }

//     return { size, filename, supportsRanges };
//   };

//   const downloadChunk = async (
//     url: string,
//     chunk: Chunk,
//     abortSignal: AbortSignal
//   ): Promise<ArrayBuffer> => {
//     const response = await fetch(url, {
//       headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
//       signal: abortSignal,
//     });
//     if (!response.ok)
//       throw new Error(`Chunk ${chunk.id} failed: ${response.statusText}`);
//     return response.arrayBuffer();
//   };

//   const startDownload = async (downloadUrl: string, resumeId?: string) => {
//     try {
//       let download: DownloadItem;

//       if (resumeId) {
//         const existing = downloads.find((d) => d.id === resumeId);
//         if (!existing) throw new Error("Download not found");

//         download = { ...existing, status: "downloading", error: undefined };
//         setDownloads((prev) =>
//           prev.map((d) => (d.id === resumeId ? download : d))
//         );
//       } else {
//         const { size, filename, supportsRanges } = await getFileInfo(
//           downloadUrl
//         );
//         if (!supportsRanges)
//           throw new Error("Server doesn't support resumable downloads");

//         const chunkSize = getChunkSize(size);
//         const chunks: Chunk[] = [];

//         for (let start = 0; start < size; start += chunkSize) {
//           chunks.push({
//             id: chunks.length,
//             start,
//             end: Math.min(start + chunkSize - 1, size - 1),
//             completed: false,
//           });
//         }

//         download = {
//           id: `${Date.now()}-${Math.random()}`,
//           url: downloadUrl,
//           filename,
//           totalSize: size,
//           downloadedSize: 0,
//           status: "downloading",
//           speed: 0,
//           eta: 0,
//           chunks,
//           startTime: Date.now(),
//         };

//         setDownloads((prev) => [...prev, download]);
//       }

//       const controller = new AbortController();
//       abortControllers.current.set(download.id, controller);

//       const maxConcurrent = 4;
//       const incompleteChunks = download.chunks.filter((c) => !c.completed);
//       let completed = 0;
//       let lastUpdate = Date.now();

//       const downloadNext = async (): Promise<void> => {
//         if (controller.signal.aborted) return;

//         const chunk = incompleteChunks[completed];
//         if (!chunk) return;

//         try {
//           const data = await downloadChunk(
//             downloadUrl,
//             chunk,
//             controller.signal
//           );

//           if (!controller.signal.aborted) {
//             chunk.data = data;
//             chunk.completed = true;
//             completed++;

//             const now = Date.now();
//             const elapsed = (now - lastUpdate) / 1000;
//             const speed =
//               elapsed > 0
//                 ? (download.downloadedSize - download.downloadedSize) / elapsed
//                 : 0;
//             const remaining = download.totalSize - download.downloadedSize;
//             const eta = speed > 0 ? remaining / speed : 0;

//             lastUpdate = now;

//             setDownloads((prev) =>
//               prev.map((d) => {
//                 if (d.id !== download.id) return d;

//                 const downloadedSize = d.chunks.reduce(
//                   (sum, c) => sum + (c.completed ? c.end - c.start + 1 : 0),
//                   0
//                 );

//                 return {
//                   ...d,
//                   downloadedSize,
//                   speed,
//                   eta,
//                   chunks: [...d.chunks],
//                 };
//               })
//             );

//             if (completed < incompleteChunks.length) {
//               await downloadNext();
//             }
//           }
//         } catch (error) {
//           if (!controller.signal.aborted) {
//             console.error(`Chunk ${chunk.id} failed:`, error);
//           }
//         }
//       };

//       const promises = Array(Math.min(maxConcurrent, incompleteChunks.length))
//         .fill(0)
//         .map(() => downloadNext());

//       await Promise.all(promises);

//       if (!controller.signal.aborted) {
//         const allCompleted = download.chunks.every((chunk) => chunk.completed);

//         if (allCompleted) {
//           const allChunks = download.chunks.sort((a, b) => a.start - b.start);

//           // Create a ReadableStream that yields chunks without loading everything into memory
//           const stream = new ReadableStream({
//             start(controller) {
//               let chunkIndex = 0;

//               const pump = () => {
//                 if (chunkIndex >= allChunks.length) {
//                   controller.close();
//                   return;
//                 }

//                 const chunk = allChunks[chunkIndex];
//                 if (chunk.data) {
//                   controller.enqueue(new Uint8Array(chunk.data));
//                 }
//                 chunkIndex++;

//                 // Use setTimeout to avoid blocking the main thread
//                 setTimeout(pump, 0);
//               };

//               pump();
//             },
//           });

//           // Create blob from stream - this doesn't load everything into memory at once
//           const blob = new Blob([stream as any]);
//           const blobUrl = URL.createObjectURL(blob);
//           const a = document.createElement("a");
//           a.href = blobUrl;
//           a.download = download.filename;
//           document.body.appendChild(a);
//           a.click();
//           document.body.removeChild(a);
//           URL.revokeObjectURL(blobUrl);

//           setDownloads((prev) =>
//             prev.map((d) =>
//               d.id === download.id
//                 ? {
//                     ...d,
//                     status: "completed",
//                     downloadedSize: d.totalSize,
//                     speed: 0,
//                     eta: 0,
//                   }
//                 : d
//             )
//           );
//         }
//       }
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Unknown error";
//       setDownloads((prev) =>
//         prev.map((d) =>
//           d.id === (resumeId || d.id)
//             ? { ...d, status: "error", error: errorMessage }
//             : d
//         )
//       );
//     } finally {
//       if (resumeId) {
//         abortControllers.current.delete(resumeId);
//       }
//     }
//   };

//   const pauseDownload = (id: string) => {
//     const controller = abortControllers.current.get(id);
//     if (controller) {
//       controller.abort();
//       abortControllers.current.delete(id);
//     }
//     setDownloads((prev) =>
//       prev.map((d) =>
//         d.id === id ? { ...d, status: "paused", speed: 0, eta: 0 } : d
//       )
//     );
//   };

//   const resumeDownload = (id: string) => {
//     startDownload("", id);
//   };

//   const removeDownload = (id: string) => {
//     const controller = abortControllers.current.get(id);
//     if (controller) {
//       controller.abort();
//       abortControllers.current.delete(id);
//     }
//     setDownloads((prev) => prev.filter((d) => d.id !== id));
//   };

//   return (
//     <div className="container mx-auto py-16 px-4 max-w-xl space-y-10">
//       <div className="">
//         <h1 className="text-3xl font-bold text-center">
//           <span className="text-blue-600">File</span> Downloader
//         </h1>
//       </div>

//       <div className="w-full h-fit bg-secondary p-1 rounded-xl border">
//         <div className="p-4 space-y-2">
//           <h1 className="text-xl font-semibold">Add Download</h1>
//         </div>
//         <div className="bg-background p-4 rounded-lg space-y-6 shadow">
//           <div className="space-y-2">
//             <p className="text-sm font-medium">
//               Enter a URL to start downloading
//             </p>
//             <Input
//               placeholder="https://example.com/file.zip"
//               value={url}
//               onChange={(e) => setUrl(e.target.value)}
//               onKeyDown={(e) =>
//                 e.key === "Enter" && url.trim() && startDownload(url.trim())
//               }
//             />
//           </div>
//           <div className="w-fit ms-auto">
//             <Button
//               onClick={() => url.trim() && startDownload(url.trim())}
//               disabled={!url.trim()}
//             >
//               <DownloadIcon className="w-4 h-4 mr-2" />
//               Download
//             </Button>
//           </div>
//         </div>
//       </div>

//       <div className="space-y-4">
//         {downloads.map((download) => (
//           <div
//             key={download?.id}
//             className="w-full h-fit bg-secondary p-1 rounded-xl border"
//           >
//             <div className="p-4 space-y-2">
//               <h1 className={cn("text-base font-medium")}>
//                 {download?.filename}
//               </h1>
//               <span className="text-sm text-muted-foreground truncate flex items-center gap-1">
//                 <p className="font-medium">url: </p>
//                 <p className="blur-[3px] select-none">{download?.url}</p>
//               </span>
//             </div>
//             <div className="bg-background p-4 rounded-lg space-y-6 shadow">
//               <div className="space-y-2">
//                 <div className="flex justify-between text-sm">
//                   <span>
//                     {formatBytes(download.downloadedSize)} /{" "}
//                     {formatBytes(download.totalSize)}
//                   </span>
//                   <span>
//                     {(
//                       (download.downloadedSize / download.totalSize) *
//                       100
//                     ).toFixed(1)}
//                     %
//                   </span>
//                 </div>
//                 <Progress
//                   value={(download.downloadedSize / download.totalSize) * 100}
//                 />
//                 {/* <div className="flex justify-between text-xs text-muted-foreground">
//                   <span>Speed: {formatBytes(download.speed)}/s</span>
//                   <span>ETA: {formatTime(download.eta)}</span>
//                 </div> */}
//               </div>

//               {download?.error && (
//                 <div className="p-4 rounded-md bg-rose-50 text-rose-600 text-sm font-medium flex items-center gap-2">
//                   <AlertCircle className="size-4" />
//                   <p> {download?.error}</p>
//                 </div>
//               )}
//               {download?.status === "completed" && (
//                 <div className="p-4 rounded-md bg-emerald-50 text-emerald-600 text-sm font-medium flex items-center gap-2">
//                   <CheckCircle2 className="size-4" />
//                   <p>Download completed!</p>
//                 </div>
//               )}

//               <div className="flex gap-2">
//                 {download.status !== "completed" && (
//                   <div className="flex items-center gap-2">
//                     {download.status === "downloading" && (
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => pauseDownload(download.id)}
//                       >
//                         <Pause className="w-4 h-4 mr-2" />
//                         Pause
//                       </Button>
//                     )}
//                     {(download.status === "paused" ||
//                       download.status === "error") && (
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => resumeDownload(download.id)}
//                       >
//                         <Play className="w-4 h-4 mr-2" />
//                         {download.status === "error" ? "Retry" : "Resume"}
//                       </Button>
//                     )}
//                   </div>
//                 )}
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => removeDownload(download.id)}
//                 >
//                   <X className="w-4 h-4 mr-2" />
//                   Remove
//                 </Button>
//               </div>
//             </div>
//           </div>
//         ))}

//         {downloads.length === 0 && (
//           <Card>
//             <CardContent className="pt-6">
//               <div className="text-center py-8">
//                 <DownloadIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
//                 <h3 className="text-lg font-semibold mb-2">No downloads</h3>
//                 <p className="text-muted-foreground">
//                   Add a URL above to start downloading
//                 </p>
//               </div>
//             </CardContent>
//           </Card>
//         )}
//       </div>
//     </div>
//   );
// }

"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Pause,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  DownloadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  totalSize: number;
  downloadedSize: number;
  status: "downloading" | "paused" | "completed" | "error";
  error?: string;
  speed: number;
  eta: number;
  chunks: Chunk[];
  startTime: number;
}

interface Chunk {
  id: number;
  start: number;
  end: number;
  completed: boolean;
  data?: ArrayBuffer;
}

const getChunkSize = (fileSize: number): number => {
  if (fileSize < 50 * 1024 * 1024) return 1 * 1024 * 1024; // 1MB for < 50MB
  if (fileSize < 500 * 1024 * 1024) return 5 * 1024 * 1024; // 5MB for < 500MB
  if (fileSize < 5 * 1024 * 1024 * 1024) return 10 * 1024 * 1024; // 10MB for < 5GB
  if (fileSize < 20 * 1024 * 1024 * 1024) return 20 * 1024 * 1024; // 20MB for < 20GB
  return 50 * 1024 * 1024; // 50MB for >= 20GB
};

export default function ResumableDownloader() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [url, setUrl] = useState("");
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    const saved = localStorage.getItem("downloads");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDownloads(
          parsed.filter((d: DownloadItem) => d.status !== "completed")
        );
      } catch (e) {
        console.error("Failed to load downloads:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("downloads", JSON.stringify(downloads));
  }, [downloads]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const activeDownloads = downloads.filter(
        (d) => d.status === "downloading"
      );
      if (activeDownloads.length > 0) {
        e.preventDefault();
        e.returnValue =
          "You have active downloads in progress. Are you sure you want to leave?";
        return "You have active downloads in progress. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [downloads]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // const formatTime = (seconds: number) => {
  //   if (!isFinite(seconds)) return "--:--";
  //   const h = Math.floor(seconds / 3600);
  //   const m = Math.floor((seconds % 3600) / 60);
  //   const s = Math.floor(seconds % 60);
  //   return h > 0
  //     ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  //     : `${m}:${s.toString().padStart(2, "0")}`;
  // };

  const getFileInfo = async (url: string) => {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok)
      throw new Error(`Failed to fetch file info: ${response.statusText}`);

    const size = Number.parseInt(response.headers.get("content-length") || "0");
    const supportsRanges = response.headers.get("accept-ranges") === "bytes";

    let filename = "download";
    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition) {
      const match = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (match) filename = match[1].replace(/['"]/g, "");
    } else {
      const urlPath = new URL(url).pathname;
      const urlFilename = urlPath.split("/").pop();
      if (urlFilename && urlFilename.includes(".")) filename = urlFilename;
    }

    return { size, filename, supportsRanges };
  };

  const downloadChunk = async (
    url: string,
    chunk: Chunk,
    abortSignal: AbortSignal
  ): Promise<ArrayBuffer> => {
    const response = await fetch(url, {
      headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
      signal: abortSignal,
    });
    if (!response.ok)
      throw new Error(`Chunk ${chunk.id} failed: ${response.statusText}`);
    return response.arrayBuffer();
  };

  const startDownload = async (downloadUrl: string, resumeId?: string) => {
    try {
      let download: DownloadItem;

      if (resumeId) {
        const existing = downloads.find((d) => d.id === resumeId);
        if (!existing) throw new Error("Download not found");

        download = { ...existing, status: "downloading", error: undefined };
        setDownloads((prev) =>
          prev.map((d) => (d.id === resumeId ? download : d))
        );
      } else {
        const { size, filename, supportsRanges } = await getFileInfo(
          downloadUrl
        );
        if (!supportsRanges)
          throw new Error("Server doesn't support resumable downloads");

        const chunkSize = getChunkSize(size);
        const chunks: Chunk[] = [];

        for (let start = 0; start < size; start += chunkSize) {
          chunks.push({
            id: chunks.length,
            start,
            end: Math.min(start + chunkSize - 1, size - 1),
            completed: false,
          });
        }

        download = {
          id: `${Date.now()}-${Math.random()}`,
          url: downloadUrl,
          filename,
          totalSize: size,
          downloadedSize: 0,
          status: "downloading",
          speed: 0,
          eta: 0,
          chunks,
          startTime: Date.now(),
        };

        setDownloads((prev) => [...prev, download]);
      }

      const controller = new AbortController();
      abortControllers.current.set(download.id, controller);

      const maxConcurrent = 4;
      const incompleteChunks = download.chunks.filter((c) => !c.completed);
      let completed = 0;
      let lastUpdate = Date.now();
      let previousDownloadedSize = download.chunks.reduce(
        (sum, c) => sum + (c.completed ? c.end - c.start + 1 : 0),
        0
      );

      const downloadNext = async (): Promise<void> => {
        if (controller.signal.aborted) return;

        const chunk = incompleteChunks[completed];
        if (!chunk) return;

        try {
          const data = await downloadChunk(
            downloadUrl,
            chunk,
            controller.signal
          );

          if (!controller.signal.aborted) {
            chunk.data = data;
            chunk.completed = true;
            completed++;

            const now = Date.now();
            const elapsed = (now - lastUpdate) / 1000;

            setDownloads((prev) =>
              prev.map((d) => {
                if (d.id !== download.id) return d;

                const downloadedSize = d.chunks.reduce(
                  (sum, c) => sum + (c.completed ? c.end - c.start + 1 : 0),
                  0
                );
                const speed =
                  elapsed > 0
                    ? (downloadedSize - previousDownloadedSize) / elapsed
                    : 0;
                const remaining = d.totalSize - downloadedSize;
                const eta = speed > 0 ? remaining / speed : 0;

                return {
                  ...d,
                  downloadedSize,
                  speed,
                  eta,
                  chunks: [...d.chunks],
                };
              })
            );

            previousDownloadedSize = download.chunks.reduce(
              (sum, c) => sum + (c.completed ? c.end - c.start + 1 : 0),
              0
            );
            lastUpdate = now;

            if (completed < incompleteChunks.length) {
              await downloadNext();
            }
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(`Chunk ${chunk.id} failed:`, error);
          }
        }
      };

      const promises = Array(Math.min(maxConcurrent, incompleteChunks.length))
        .fill(0)
        .map(() => downloadNext());

      await Promise.all(promises);

      if (!controller.signal.aborted) {
        const allCompleted = download.chunks.every((chunk) => chunk.completed);

        if (allCompleted) {
          const allChunks = download.chunks.sort((a, b) => a.start - b.start);

          const stream = new ReadableStream({
            start(controller) {
              let chunkIndex = 0;

              const pump = () => {
                if (chunkIndex >= allChunks.length) {
                  controller.close();
                  return;
                }

                const chunk = allChunks[chunkIndex];
                if (chunk.data) {
                  controller.enqueue(new Uint8Array(chunk.data));
                }
                chunkIndex++;

                setTimeout(pump, 0);
              };

              pump();
            },
          });

          const response = new Response(stream);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = download.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);

          setDownloads((prev) =>
            prev.map((d) =>
              d.id === download.id
                ? {
                    ...d,
                    status: "completed",
                    downloadedSize: d.totalSize,
                    speed: 0,
                    eta: 0,
                  }
                : d
            )
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === (resumeId || d.id)
            ? { ...d, status: "error", error: errorMessage }
            : d
        )
      );
    } finally {
      if (resumeId) {
        abortControllers.current.delete(resumeId);
      }
    }
  };

  const pauseDownload = (id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setDownloads((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "paused", speed: 0, eta: 0 } : d
      )
    );
  };

  const resumeDownload = async (id: string) => {
    const download = downloads.find((d) => d.id === id);
    if (!download) {
      console.error("Download not found for resume");
      return;
    }

    setDownloads((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "downloading", error: undefined } : d
      )
    );

    await startDownload(download.url, id);
  };

  const removeDownload = (id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="container mx-auto py-16 px-4 max-w-xl space-y-10">
      <div className="">
        <h1 className="text-3xl font-bold text-center">
          <span className="text-blue-600">File</span> Downloader
        </h1>
      </div>

      <div className="w-full h-fit bg-secondary p-1 rounded-xl border">
        <div className="p-4 space-y-2">
          <h1 className="text-xl font-semibold">Add Download</h1>
        </div>
        <div className="bg-background p-4 rounded-lg space-y-6 shadow">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Enter a URL to start downloading
            </p>
            <Input
              placeholder="https://example.com/file.zip"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && url.trim() && startDownload(url.trim())
              }
              // className="blur-[3px]"
            />
          </div>
          <div className="w-fit ms-auto">
            <Button
              onClick={() => url.trim() && startDownload(url.trim())}
              disabled={!url.trim()}
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {downloads.map((download) => (
          <div
            key={download?.id}
            className="w-full h-fit bg-secondary p-1 rounded-xl border"
          >
            <div className="p-4 space-y-2">
              <h1 className={cn("text-base font-medium")}>
                {download?.filename}
              </h1>
              <span className="text-sm text-muted-foreground truncate flex items-center gap-1">
                <p className="font-medium">url: </p>
                <p className="blur-[3px] select-none">{download?.url}</p>
              </span>
            </div>
            <div className="bg-background p-4 rounded-lg space-y-6 shadow">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {formatBytes(download.downloadedSize)} /{" "}
                    {formatBytes(download.totalSize)}
                  </span>
                  <span>
                    {(
                      (download.downloadedSize / download.totalSize) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <Progress
                  value={(download.downloadedSize / download.totalSize) * 100}
                />
                {/* <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Speed: {formatBytes(download.speed)}/s</span>
                  <span>ETA: {formatTime(download.eta)}</span>
                </div> */}
              </div>

              {download?.error && (
                <div className="p-4 rounded-md bg-rose-50 text-rose-600 text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  <p> {download?.error}</p>
                </div>
              )}
              {download?.status === "completed" && (
                <div className="p-4 rounded-md bg-emerald-50 text-emerald-600 text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="size-4" />
                  <p>Download completed!</p>
                </div>
              )}

              <div className="flex gap-2">
                {download.status !== "completed" && (
                  <div className="flex items-center gap-2">
                    {download.status === "downloading" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pauseDownload(download.id)}
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    {(download.status === "paused" ||
                      download.status === "error") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resumeDownload(download.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {download.status === "error" ? "Retry" : "Resume"}
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeDownload(download.id)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}

        {downloads.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <DownloadIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No downloads</h3>
                <p className="text-muted-foreground">
                  Add a URL above to start downloading
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
