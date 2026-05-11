'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { parseGpxFile, ParseResult } from '@/lib/gpx/parser';
import { validateGpxFile } from '@/lib/gpx/validator';
import { addActivity } from '@/lib/storage/sync-manager';
import GpxPreview from './GpxPreview';

interface GpxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onImportComplete?: (count: number) => void;
}

type ImportStage = 'select' | 'preview' | 'importing' | 'complete';

interface FileWithResult {
  file: File;
  result?: ParseResult;
  status: 'pending' | 'parsing' | 'valid' | 'invalid' | 'importing' | 'imported' | 'error';
  error?: string;
}

export default function GpxImportModal({
  isOpen,
  onClose,
  userId,
  onImportComplete,
}: GpxImportModalProps) {
  const [stage, setStage] = useState<ImportStage>('select');
  const [files, setFiles] = useState<FileWithResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importProgress, setImportProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const gpxFiles = acceptedFiles.filter((f) => f.name.toLowerCase().endsWith('.gpx'));

      if (gpxFiles.length === 0) {
        return;
      }

      // Initialize file states
      const fileStates: FileWithResult[] = gpxFiles.map((file) => ({
        file,
        status: 'pending',
      }));
      setFiles(fileStates);
      setStage('preview');

      // Parse each file
      for (let i = 0; i < gpxFiles.length; i++) {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'parsing' } : f))
        );

        const validation = validateGpxFile(gpxFiles[i]);
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

        const result = await parseGpxFile(gpxFiles[i], { userId, onlyRunning: true });

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
    },
    [userId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/gpx+xml': ['.gpx'],
      'application/xml': ['.gpx'],
      'text/xml': ['.gpx'],
    },
    multiple: true,
  });

  const handleImport = async () => {
    const validFiles = files.filter((f) => f.status === 'valid' && f.result?.activity);

    if (validFiles.length === 0) return;

    setStage('importing');
    setImportProgress(0);

    let imported = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const fileState = validFiles[i];
      if (!fileState.result?.activity) continue;

      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileState.file ? { ...f, status: 'importing' } : f
        )
      );

      try {
        await addActivity(fileState.result.activity);
        imported++;

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

      setImportProgress(((i + 1) / validFiles.length) * 100);
    }

    setStage('complete');
    onImportComplete?.(imported);
  };

  const handleClose = () => {
    setStage('select');
    setFiles([]);
    setSelectedIndex(0);
    setImportProgress(0);
    onClose();
  };

  const validCount = files.filter((f) => f.status === 'valid').length;
  const invalidCount = files.filter((f) => f.status === 'invalid').length;
  const importedCount = files.filter((f) => f.status === 'imported').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {stage === 'select' && 'Importer des fichiers GPX'}
            {stage === 'preview' && `Aperçu (${validCount} valide${validCount > 1 ? 's' : ''})`}
            {stage === 'importing' && 'Import en cours...'}
            {stage === 'complete' && 'Import terminé'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {stage === 'select' && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                {isDragActive
                  ? 'Déposez les fichiers ici...'
                  : 'Glissez-déposez vos fichiers GPX'}
              </p>
              <p className="text-sm text-gray-500">ou cliquez pour sélectionner</p>
            </div>
          )}

          {stage === 'preview' && files.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File list */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500 mb-3">
                  Fichiers ({files.length})
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {files.map((f, idx) => (
                    <button
                      key={f.file.name}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedIndex === idx
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {f.status === 'parsing' && (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        )}
                        {f.status === 'valid' && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                        {f.status === 'invalid' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        {f.status === 'pending' && (
                          <FileText className="w-5 h-5 text-gray-400" />
                        )}
                        {f.status === 'imported' && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                          {f.file.name}
                        </p>
                        {f.error && (
                          <p className="text-xs text-red-500 truncate">{f.error}</p>
                        )}
                        {f.result?.activity && (
                          <p className="text-xs text-gray-500">
                            {(f.result.activity.stats.distanceMeters / 1000).toFixed(2)} km
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                {files[selectedIndex]?.result?.activity && (
                  <GpxPreview activity={files[selectedIndex].result!.activity!} />
                )}
                {files[selectedIndex]?.status === 'invalid' && (
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <p className="text-red-600 dark:text-red-400">
                      {files[selectedIndex].error}
                    </p>
                  </div>
                )}
                {files[selectedIndex]?.status === 'parsing' && (
                  <div className="p-6 text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-gray-500">Analyse en cours...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'importing' && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-blue-500" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import en cours...
              </p>
              <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {Math.round(importProgress)}%
              </p>
            </div>
          )}

          {stage === 'complete' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import terminé
              </p>
              <p className="text-gray-500">
                {importedCount} activité{importedCount > 1 ? 's' : ''} importée{importedCount > 1 ? 's' : ''}
                {invalidCount > 0 && `, ${invalidCount} ignorée${invalidCount > 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {stage === 'complete' ? 'Fermer' : 'Annuler'}
          </button>
          {stage === 'preview' && validCount > 0 && (
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Importer {validCount} fichier{validCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
