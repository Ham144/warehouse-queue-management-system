"use client";

import React, { useState } from "react";
import { FileText, ChevronRight, X, BookOpen, Download } from "lucide-react";

export interface DocFile {
  name: string;
  filename: string;
}

interface Props {
  initialDocs: DocFile[];
}

const BASE_PATH = "/antrian/docs";

const DocumentationClient = ({ initialDocs }: Props) => {
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Dokumentasi
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {initialDocs.length} panduan tersedia
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {initialDocs.map((doc) => {
            const isActive = selectedDoc?.filename === doc.filename;
            return (
              <button
                key={doc.filename}
                onClick={() => setSelectedDoc(doc)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all group ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent"
                }`}
              >
                <FileText
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                  }`}
                />
                <span
                  className={`text-sm leading-snug flex-1 ${
                    isActive
                      ? "font-medium text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {doc.name}
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 transition-opacity ${
                    isActive
                      ? "opacity-100 text-blue-500"
                      : "opacity-0 group-hover:opacity-50"
                  }`}
                />
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {selectedDoc.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <a
                  href={`${BASE_PATH}/${encodeURIComponent(selectedDoc.filename)}`}
                  download={selectedDoc.filename}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh
                </a>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Tutup
                </button>
              </div>
            </div>

            <iframe
              key={selectedDoc.filename}
              src={`${BASE_PATH}/${encodeURIComponent(selectedDoc.filename)}`}
              title={selectedDoc.name}
              className="flex-1 w-full border-0"
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              Pilih Dokumen
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Pilih salah satu panduan dari daftar di sebelah kiri untuk mulai membaca.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentationClient;
