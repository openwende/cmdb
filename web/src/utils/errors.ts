/**
 * Maps HTTP status codes and common backend error codes to i18n keys.
 * Use this to get a localized message for any API error.
 */
export function getErrorI18nKey(status?: number, backendCode?: string): string {
  if (status === 401 || status === 403) {
    return 'common.errors.unauthorized';
  }
  if (status === 404) {
    return 'common.errors.notFound';
  }
  if (status === 500 || status === 502 || status === 503) {
    return 'common.errors.serverError';
  }
  if (backendCode === 'INVALID_CREDENTIALS') {
    return 'auth.login.messages.invalidCredentials';
  }
  return 'common.errors.requestFailed';
}
