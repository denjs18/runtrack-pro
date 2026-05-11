// GPX file validation utilities

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Check if file is a valid GPX file
export function validateGpxFile(file: File): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file extension
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    errors.push('File must have .gpx extension');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
  }

  // Check MIME type
  const validTypes = ['application/gpx+xml', 'application/xml', 'text/xml', ''];
  if (!validTypes.includes(file.type)) {
    warnings.push(`Unexpected file type: ${file.type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate GPX content structure
export function validateGpxContent(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for GPX root element
  if (!content.includes('<gpx')) {
    errors.push('Missing GPX root element');
  }

  // Check for track element
  if (!content.includes('<trk>') && !content.includes('<trk ')) {
    errors.push('No track (trk) element found');
  }

  // Check for track segment
  if (!content.includes('<trkseg>') && !content.includes('<trkseg ')) {
    errors.push('No track segment (trkseg) element found');
  }

  // Check for track points
  if (!content.includes('<trkpt')) {
    errors.push('No track points (trkpt) found');
  }

  // Check for time data
  if (!content.includes('<time>')) {
    warnings.push('No time data found - some features may be limited');
  }

  // Check for elevation data
  if (!content.includes('<ele>')) {
    warnings.push('No elevation data found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate multiple files
export function validateGpxFiles(files: File[]): {
  validFiles: File[];
  invalidFiles: { file: File; errors: string[] }[];
  totalWarnings: string[];
} {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; errors: string[] }[] = [];
  const totalWarnings: string[] = [];

  for (const file of files) {
    const result = validateGpxFile(file);

    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, errors: result.errors });
    }

    totalWarnings.push(...result.warnings.map((w) => `${file.name}: ${w}`));
  }

  return { validFiles, invalidFiles, totalWarnings };
}
