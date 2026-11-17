const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem('fv_access_token');
}

export function setAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem('fv_access_token', token);
  } else {
    localStorage.removeItem('fv_access_token');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If payload is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle Token Expiry & Refresh
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.data?.accessToken) {
          setAccessToken(refreshData.data.accessToken);
          headers.set('Authorization', `Bearer ${refreshData.data.accessToken}`);
          const retryRes = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
          if (!retryRes.ok) {
            const err = await retryRes.json();
            throw new ApiError(err.error || 'Request failed', retryRes.status, err.details);
          }
          return retryRes.json();
        }
      }
    } catch {
      setAccessToken(null);
      window.location.href = '/login';
    }
  }

  // Handle blob responses (PDFs, CSVs, Vault files)
  const contentType = response.headers.get('content-type');
  if (
    contentType &&
    (contentType.includes('application/pdf') ||
      contentType.includes('text/csv') ||
      contentType.includes('application/octet-stream'))
  ) {
    if (!response.ok) {
      throw new ApiError('Failed to download file', response.status);
    }
    return (await response.blob()) as unknown as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'API request failed', response.status, data.details);
  }

  return data;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
