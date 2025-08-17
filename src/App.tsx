/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx

import { useState, useEffect } from "react";

const DB_NAME = "downloadDB";
const STORE_NAME = "downloads";
const DB_VERSION = 2; // bumped version to avoid VersionError

interface DownloadState {
  url: string;
  chunks: Blob[];
  downloadedBytes: number;
  totalSize: number;
  eTag: string;
  fileName: string;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };
    request.onsuccess = (event) =>
      resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as any)?.error);
  });
}

async function getDownloadState(
  url: string
): Promise<DownloadState | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(url);
    request.onsuccess = () =>
      resolve(request.result as DownloadState | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function saveDownloadState(state: DownloadState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(state);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteDownloadState(url: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(url);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function App() {
  const [url, setUrl] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  useEffect(() => {
    if (url) {
      getDownloadState(url)
        .then((state) => {
          if (state) {
            setDownloadState(state);
            setProgress((state.downloadedBytes / state.totalSize) * 100);
            setIsDownloading(true);
            setIsPaused(true);
          }
        })
        .catch(() => {});
    }
  }, [url]);

  useEffect(() => {
    if (isDownloading && !isPaused) {
      window.onbeforeunload = () =>
        "Download is in progress. Are you sure you want to leave?";
    } else {
      window.onbeforeunload = null;
    }
    return () => {
      window.onbeforeunload = null;
    };
  }, [isDownloading, isPaused]);

  const startDownload = async () => {
    setError(null);
    if (!url) return;
    let state = await getDownloadState(url);
    if (!state) {
      try {
        const headResponse = await fetch(url, { method: "HEAD" });
        if (!headResponse.ok) throw new Error("Failed to fetch file info");
        const totalSize = parseInt(
          headResponse.headers.get("content-length") || "0"
        );
        if (!totalSize) throw new Error("No content-length");
        const eTag = headResponse.headers.get("etag") || "";
        let fileName = url.split("/").pop() || "download";
        const contentDisposition = headResponse.headers.get(
          "content-disposition"
        );
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+?)"?/);
          if (match) fileName = match[1];
        }
        state = {
          url,
          chunks: [],
          downloadedBytes: 0,
          totalSize,
          eTag,
          fileName,
        };
        await saveDownloadState(state);
        setDownloadState(state);
      } catch (err: unknown) {
        setError((err as Error).message);
        return;
      }
    }
    setIsDownloading(true);
    setIsPaused(false);
    downloadLoop(state);
  };

  const pauseDownload = () => {
    setIsPaused(true);
    if (abortController) abortController.abort();
  };

  const resumeDownload = () => {
    setIsPaused(false);
    if (downloadState) downloadLoop(downloadState);
  };

  const downloadLoop = async (state: DownloadState) => {
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const response = await fetch(state.url, {
        signal: controller.signal,
        headers: {
          Range: `bytes=${state.downloadedBytes}-`,
          ...(state.eTag ? { "If-Range": state.eTag } : {}),
        },
      });
      if (!response.ok && response.status !== 206)
        throw new Error("Failed to download");
      if (response.status === 200) {
        state.chunks = [];
        state.downloadedBytes = 0;
        await saveDownloadState(state);
        setProgress(0);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          state.chunks.push(new Blob([value]));
          state.downloadedBytes += value.length;
          await saveDownloadState(state);
          setProgress((state.downloadedBytes / state.totalSize) * 100);
        }
      }
      const { done } = await reader.read();
      if (done && state.downloadedBytes >= state.totalSize) {
        const fullBlob = new Blob(state.chunks);
        const downloadUrl = URL.createObjectURL(fullBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = state.fileName;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        await deleteDownloadState(state.url);
        setIsDownloading(false);
        setDownloadState(null);
        setProgress(0);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setAbortController(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Resumable File Downloader</h1>
        <input
          type="text"
          placeholder="Enter file URL (Cloudflare R2)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-4"
        />
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {!isDownloading ? (
          <button
            onClick={startDownload}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Start Download
          </button>
        ) : isPaused ? (
          <button
            onClick={resumeDownload}
            className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
          >
            Resume
          </button>
        ) : (
          <button
            onClick={pauseDownload}
            className="w-full bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600"
          >
            Pause
          </button>
        )}
        {progress > 0 && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-center mt-2">{Math.round(progress)}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
