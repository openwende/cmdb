import type { RuleObject } from 'antd/es/form';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  buildPasswordRules,
  getUserManagementErrorMessage,
  normalizePassword,
  validateUserPassword,
} from '@/pages/Admin/Users/passwordValidation';

const translations: Record<string, string> = {
  'common.form.rulesMessage': '该字段是必填项',
  'auth.userManagement.validation.passwordLength': '密码长度需为 8-128 个字符',
  'auth.userManagement.validation.passwordNoOuterSpaces': '密码不能包含首尾空格',
};

const t = ((key: string) => translations[key] || key) as TFunction;

const isRuleObject = (rule: unknown): rule is RuleObject =>
  typeof rule === 'object' && rule !== null && 'validator' in rule;

describe('user management password validation', () => {
  it('rejects passwords that backend password reset would return as 400', () => {
    expect(validateUserPassword('123456')).toBe('length');
    expect(validateUserPassword(` ${'a'.repeat(8)}`)).toBe('outerSpaces');
    expect(validateUserPassword('newpass123')).toBeNull();
  });

  it('normalizes accepted password payloads before submit', () => {
    expect(normalizePassword('newpass123')).toBe('newpass123');
  });

  it('converts backend password validation errors into a readable message', () => {
    const message = getUserManagementErrorMessage(
      {
        response: {
          data: {
            error:
              "Key: 'AuthResetPasswordRequest.Password' Error:Field validation for 'Password' failed on the 'min' tag",
          },
        },
      },
      '修改失败',
      t,
    );

    expect(message).toBe('密码长度需为 8-128 个字符');
  });

  it('uses the same readable message in Ant Design form rules', async () => {
    const customRule = buildPasswordRules(t).find(isRuleObject);

    await expect(customRule?.validator?.({}, '123456', () => undefined)).rejects.toThrow(
      '密码长度需为 8-128 个字符',
    );
    await expect(
      customRule?.validator?.({}, 'newpass123', () => undefined),
    ).resolves.toBeUndefined();
  });
});
