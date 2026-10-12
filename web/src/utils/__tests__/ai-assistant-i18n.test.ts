import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enUS from '@/locales/en-US.json';
import zhCN from '@/locales/zh-CN.json';

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: { 'zh-CN': { translation: zhCN }, 'en-US': { translation: enUS } },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
  });
});

const collectKeys = (value: unknown, prefix = ''): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) =>
        collectKeys(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

describe('AI assistant copy', () => {
  const vars = { elapsed: '1.2 s', input: 10, output: 2 };

  it('uses singular and plural forms in English', () => {
    const en = i18n.getFixedT('en-US');
    expect(en('aiAssistant.message.stats', { count: 1, ...vars })).toBe(
      '1 tool call · 1.2 s · 10 input / 2 output tokens',
    );
    expect(en('aiAssistant.message.stats', { count: 0, ...vars })).toMatch(/^0 tool calls /);
    expect(en('aiAssistant.message.stats', { count: 4, ...vars })).toMatch(/^4 tool calls /);
  });

  it('keeps one form in Chinese', () => {
    const zh = i18n.getFixedT('zh-CN');
    expect(zh('aiAssistant.message.stats', { count: 1, ...vars })).toBe(
      '工具调用 1 次 · 耗时 1.2 s · 输入 10 / 输出 2 tokens',
    );
  });

  it('has the same aiAssistant keys in both locales', () => {
    expect(collectKeys(enUS.aiAssistant).sort()).toEqual(collectKeys(zhCN.aiAssistant).sort());
  });
});
