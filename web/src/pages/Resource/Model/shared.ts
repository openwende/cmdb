import { ModelAttribute, ModelAttributeOptions } from '@/api/types/model';

export const normalizeAttributeOptions = (
  options?: Record<string, unknown> | ModelAttributeOptions | null,
): ModelAttributeOptions => {
  if (!options || typeof options !== 'object') {
    return {};
  }

  return options as ModelAttributeOptions;
};

export const buildAttributeDefaultValues = (attributes: ModelAttribute[]) => {
  return attributes.reduce<Record<string, string | number | boolean>>((acc, attribute) => {
    const options = normalizeAttributeOptions(attribute.options);
    if (options.default !== undefined) {
      acc[attribute.name] = options.default;
    }
    return acc;
  }, {});
};

export const formatAttributeOptions = (attribute: ModelAttribute) => {
  const options = normalizeAttributeOptions(attribute.options);
  const parts: string[] = [];

  if (Array.isArray(options.enum_values) && options.enum_values.length > 0) {
    parts.push(`enum: ${options.enum_values.join(', ')}`);
  }
  if (options.default !== undefined && options.default !== '') {
    parts.push(`default: ${String(options.default)}`);
  }
  if (options.placeholder) {
    parts.push(`placeholder: ${options.placeholder}`);
  }
  if (options.help_text) {
    parts.push(`help: ${options.help_text}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '--';
};
