import React from "react";
import fs from "fs";
import path from "path";
import DocumentationClient, { DocFile } from "./DocumentationClient";

export const dynamic = "force-dynamic";

const DocumentationPage = () => {
  // Lokasi folder PDF di folder public/docs
  const docsDirectory = path.join(process.cwd(), "public", "docs");
  
  let docs: DocFile[] = [];

  try {
    // Baca isi folder
    if (fs.existsSync(docsDirectory)) {
      const filenames = fs.readdirSync(docsDirectory);
      
      // Filter hanya file .pdf dan format menjadi objek DocFile
      docs = filenames
        .filter((file) => file.toLowerCase().endsWith(".pdf"))
        .map((file) => ({
          // Nama yang tampil di UI (hapus extensi .pdf)
          name: file.replace(/\.[^/.]+$/, ""),
          filename: file,
        }));
    }
  } catch (error) {
    console.error("Gagal membaca direktori dokumentasi:", error);
  }

  return <DocumentationClient initialDocs={docs} />;
};

export default DocumentationPage;
