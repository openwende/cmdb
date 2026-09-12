import type { Rule } from 'antd/es/form';
import type { TFunction } from 'i18next';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

type PasswordValidationError = 'required' | 'length' | 'outerSpaces';

type ApiErrorLike = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
};

export const normalizePassword = (password: string) => password.trim();

export const validateUserPassword = (password?: string | null): PasswordValidationError | null => {
  if (!password) {
    return 'required';
  }

  if (password !== normalizePassword(password)) {
    return 'outerSpaces';
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return 'length';
  }

  return null;
};

export const getUserPasswordValidationMessage = (
  error: PasswordValidationError,
  t: TFunction,
): string => {
  if (error === 'required') {
    return t('common.form.rulesMessage');
  }

  if (error === 'outerSpaces') {
    return t('auth.userManagement.validation.passwordNoOuterSpaces');
  }

  return t('auth.userManagement.validation.passwordLength', {
    min: PASSWORD_MIN_LENGTH,
    max: PASSWORD_MAX_LENGTH,
  });
};

export const buildPasswordRules = (t: TFunction): Rule[] => [
  {
    required: true,
    message: getUserPasswordValidationMessage('required', t),
  },
  {
    validator: async (_rule, value?: string) => {
      const validationError = validateUserPassword(value);
      if (!validationError || validationError === 'required') {
        return;
      }

      throw new Error(getUserPasswordValidationMessage(validationError, t));
    },
  },
];

export const getUserManagementErrorMessage = (
  error: unknown,
  fallback: string,
  t: TFunction,
): string => {
  const backendMessage =
    (error as ApiErrorLike)?.response?.data?.message ||
    (error as ApiErrorLike)?.response?.data?.error;

  if (!backendMessage) {
    return fallback;
  }

  if (
    backendMessage.includes('Password') &&
    (backendMessage.includes("'min'") || backendMessage.includes("'max'"))
  ) {
    return getUserPasswordValidationMessage('length', t);
  }

  if (backendMessage.includes('Password') && backendMessage.includes("'required'")) {
    return getUserPasswordValidationMessage('required', t);
  }

  return backendMessage;
};
