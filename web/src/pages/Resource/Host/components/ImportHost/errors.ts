interface BackendImportError {
  index?: number;
  host_name?: string;
  error?: string;
  message?: string;
}

interface ImportErrorData {
  error?: string | string[];
  errors?: Array<string | BackendImportError>;
  message?: string;
}

interface ImportErrorResponse {
  response?: {
    data?: ImportErrorData;
  };
}

const isValidMessage = (message?: string) => Boolean(message?.trim());

const formatBackendImportError = (item: string | BackendImportError) => {
  if (typeof item === 'string') {
    return item.trim();
  }

  const rowText = typeof item.index === 'number' ? `行 ${item.index + 2}` : '';
  const hostText = item.host_name ? ` (${item.host_name})` : '';
  const errorText = item.error || item.message || '';

  return rowText ? `${rowText}${hostText}: ${errorText}`.trim() : errorText.trim();
};

export const formatBatchImportErrors = (errors?: BackendImportError[]) => {
  return (errors ?? []).map(formatBackendImportError).filter(isValidMessage);
};

export const getImportResponseErrors = (error: unknown): string[] | undefined => {
  const data = (error as ImportErrorResponse)?.response?.data;

  if (Array.isArray(data?.errors)) {
    const errors = data.errors.map(formatBackendImportError).filter(isValidMessage);
    if (errors.length > 0) {
      return errors;
    }
  }

  if (Array.isArray(data?.error)) {
    const errors = data.error.map((item) => item.trim()).filter(isValidMessage);
    if (errors.length > 0) {
      return errors;
    }
  }

  if (typeof data?.error === 'string' && isValidMessage(data.error)) {
    return [data.error.trim()];
  }

  if (typeof data?.message === 'string' && isValidMessage(data.message)) {
    return [data.message.trim()];
  }

  return undefined;
};
