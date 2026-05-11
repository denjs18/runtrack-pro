'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  Archive,
} from 'lucide-react';
import { parseGpxFile, ParseResult } from '@/lib/gpx/parser';
import { validateGpxFile } from '@/lib/gpx/validator';
import { addActivityLocalOnly } from '@/lib/storage/sync-manager';
import GpxPreview from '@/components/import/GpxPreview';

interface FileWithResult {
  file: File;
  result?: ParseResult;
  status: 'pending' | 'parsing' | 'valid' | 'invalid' | 'importing' | 'imported' | 'error';
  error?: string;
  fromZip?: string; // Name of the ZIP file if extracted from one
}

// TODO: Replace with actual user ID from auth
const TEMP_USER_ID = 'demo-user';

export default function ImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileWithResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const extractGpxFromZip = async (zipFile: File): Promise<FileWithResult[]> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const gpxFiles: FileWithResult[] = [];

    for (const [path, zipEntry] of Object.entries(contents.files)) {
      if (zipEntry.dir) continue;
      if (!path.toLowerCase().endsWith('.gpx')) continue;

      const content = await zipEntry.async('blob');
      const fileName = path.split('/').pop() || path;
      const file = new File([content], fileName, { type: 'application/gpx+xml' });

      gpxFiles.push({
        file,
        status: 'pending',
        fromZip: zipFile.name,
      });
    }

    return gpxFiles;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const allGpxFiles: FileWithResult[] = [];

    // Process each file (GPX or ZIP)
    for (const file of acceptedFiles) {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.zip')) {
        // Extract GPX files from ZIP
        try {
          const extracted = await extractGpxFromZip(file);
          allGpxFiles.push(...extracted);
        } catch (error) {
          console.error('Error extracting ZIP:', error);
        }
      } else if (lowerName.endsWith('.gpx')) {
        allGpxFiles.push({ file, status: 'pending' });
      }
    }

    if (allGpxFiles.length === 0) return;

    // Initialize file states
    setFiles(allGpxFiles);
    setImportComplete(false);

    // Parse each file
    for (let i = 0; i < allGpxFiles.length; i++) {
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'parsing' } : f))
      );

      const validation = validateGpxFile(allGpxFiles[i].file);
      if (!validation.valid) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'invalid', error: validation.errors.join(', ') }
              : f
          )
        );
        continue;
      }

      const result = await parseGpxFile(allGpxFiles[i].file, {
        userId: TEMP_USER_ID,
        onlyRunning: true,
      });

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i
            ? {
                ...f,
                result,
                status: result.success ? 'valid' : 'invalid',
                error: result.error,
              }
            : f
        )
      );
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/gpx+xml': ['.gpx'],
      'application/xml': ['.gpx'],
      'text/xml': ['.gpx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    multiple: true,
  });

  const handleImport = async () => {
    const validFiles = files.filter(
      (f) => f.status === 'valid' && f.result?.activity
    );

    if (validFiles.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: validFiles.length });

    for (let i = 0; i < validFiles.length; i++) {
      const fileState = validFiles[i];
      if (!fileState.result?.activity) continue;

      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileState.file ? { ...f, status: 'importing' } : f
        )
      );

      try {
        await addActivityLocalOnly(fileState.result.activity);
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file ? { ...f, status: 'imported' } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file
              ? { ...f, status: 'error', error: (error as Error).message }
              : f
          )
        );
      }

      setImportProgress({ current: i + 1, total: validFiles.length });
    }

    setIsImporting(false);
    setImportComplete(true);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedIndex >= files.length - 1) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
  };

  const handleClear = () => {
    setFiles([]);
    setSelectedIndex(0);
    setImportComplete(false);
  };

  const validCount = files.filter((f) => f.status === 'valid').length;
  const importedCount = files.filter((f) => f.status === 'imported').length;
  const hasFiles = files.length > 0;

  const StatusIcon = ({ status }: { status: FileWithResult['status'] }) => {
    switch (status) {
      case 'parsing':
      case 'importing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'valid':
      case 'imported':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'invalid':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              disabled={isImporting}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Importer des activités
            </h1>
          </div>
          {hasFiles && !importComplete && !isImporting && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Effacer
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                Importer {validCount > 0 && `(${validCount})`}
              </button>
            </div>
          )}
          {importComplete && (
            <button
              onClick={() => router.push('/activities')}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
            >
              Voir les activités
            </button>
          )}
        </div>

        {/* Progress bar during import */}
        {isImporting && (
          <div className="px-4 pb-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours...
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((importProgress.current / importProgress.total) * 100)}% complété
              </p>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!hasFiles ? (
          /* Dropzone */
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 bg-white dark:bg-gray-900'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center gap-4 mb-6">
              <Upload className="w-12 h-12 text-gray-400" />
              <Archive className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isDragActive
                ? 'Déposez les fichiers ici...'
                : 'Glissez-déposez vos fichiers GPX ou ZIP'}
            </p>
            <p className="text-gray-500 mb-6">ou cliquez pour sélectionner</p>
            <p className="text-sm text-gray-400">
              Supporte les exports Strava (ZIP), Garmin, et autres formats GPX standard
            </p>
          </div>
        ) : (
          /* File list and preview */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File list */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Fichiers ({files.length})
              </h2>
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div
                    key={f.file.name}
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                      selectedIndex === idx
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <StatusIcon status={f.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-gray-900 dark:text-white">
                        {f.file.name}
                      </p>
                      {f.fromZip && (
                        <p className="text-xs text-blue-500 flex items-center gap-1">
                          <Archive className="w-3 h-3" />
                          {f.fromZip}
                        </p>
                      )}
                      {f.error && (
                        <p className="text-sm text-red-500 truncate">{f.error}</p>
                      )}
                      {f.result?.activity && (
                        <p className="text-sm text-gray-500">
                          {(f.result.activity.stats.distanceMeters / 1000).toFixed(2)}{' '}
                          km •{' '}
                          {new Date(f.result.activity.startTime).toLocaleDateString(
                            'fr-FR'
                          )}
                        </p>
                      )}
                    </div>
                    {f.status !== 'importing' && f.status !== 'imported' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add more files */}
              <div
                {...getRootProps()}
                className="mt-4 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                <input {...getInputProps()} />
                <p className="text-gray-500">+ Ajouter d&apos;autres fichiers (GPX ou ZIP)</p>
              </div>

              {/* Summary */}
              {importComplete && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    {importedCount} activité{importedCount > 1 ? 's' : ''} importée
                    {importedCount > 1 ? 's' : ''} avec succès
                  </p>
                </div>
              )}
            </div>

            {/* Preview */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Aperçu
              </h2>
              {files[selectedIndex]?.result?.activity ? (
                <GpxPreview activity={files[selectedIndex].result!.activity!} />
              ) : files[selectedIndex]?.status === 'invalid' ? (
                <div className="p-8 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    Fichier invalide
                  </p>
                  <p className="text-red-500 text-sm mt-2">
                    {files[selectedIndex].error}
                  </p>
                </div>
              ) : files[selectedIndex]?.status === 'parsing' ? (
                <div className="p-8 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-200 dark:border-gray-800">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                  <p className="text-gray-500">Analyse en cours...</p>
                </div>
              ) : (
                <div className="p-8 bg-white dark:bg-gray-900 rounded-xl text-center border border-gray-200 dark:border-gray-800">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Sélectionnez un fichier</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
