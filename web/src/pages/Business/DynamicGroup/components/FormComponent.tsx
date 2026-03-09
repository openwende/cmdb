import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Property, ConditionType, OperatorType } from '../../Types';
import { QUERY_OPERATOR, PROPERTY_TYPES } from '../../constants';
import DynamicComponent from '@/components/Business/FormComponents/DynamicComponent';
import { usePropertyInfo } from '../../hooks/usePropertyInfo';

const SELECT_TYPES = [
  PROPERTY_TYPES.LIST,
  PROPERTY_TYPES.ENUM,
  PROPERTY_TYPES.TIMEZONE,
  PROPERTY_TYPES.ORGANIZATION,
  PROPERTY_TYPES.DATE,
  PROPERTY_TYPES.TIME,
  PROPERTY_TYPES.ENUMQUOTE,
  PROPERTY_TYPES.ENUMMULTI,
  PROPERTY_TYPES.FOREIGNKEY,
];
const OPTION_PROP_TYPES = [
  PROPERTY_TYPES.INT,
  PROPERTY_TYPES.LIST,
  PROPERTY_TYPES.ENUM,
  PROPERTY_TYPES.ENUMQUOTE,
  PROPERTY_TYPES.ENUMMULTI,
];
const UNSUPPORTED_OPERATORS = [QUERY_OPERATOR.CONTAINS, QUERY_OPERATOR.LIKE] as OperatorType[];

interface ComponentProps {
  bizId: number | string;
  property: Property;
  conditionType: ConditionType;
  operator: OperatorType;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

const FormComponent: React.FC<ComponentProps> = ({
  bizId,
  property,
  conditionType,
  operator,
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const { propertyType, options, isSetName, isModuleName } = usePropertyInfo(property);

  // Component type determination
  const componentType = useMemo(() => {
    if ((isSetName || isModuleName) && !UNSUPPORTED_OPERATORS.includes(operator)) {
      return PROPERTY_TYPES.OBJNAME;
    }
    return propertyType;
  }, [operator]);

  const additionalProps = useMemo(() => {
    const props: { [key: string]: any } = {};
    if (OPTION_PROP_TYPES.includes(propertyType as PROPERTY_TYPES)) {
      props.options = options || [];
    } else if (propertyType === PROPERTY_TYPES.OBJUSER) {
      props.fastSelect = true;
    }
    if (isSetName || isModuleName) {
      props.bizId = bizId;
    }
    return props;
  }, [propertyType, operator, bizId]);

  const placeholder = useMemo(() => {
    const name =
      conditionType === ConditionType.IMMUTABLE
        ? t('business.dynamicGroupForm.formComponent.placeholders.immutableValue')
        : t('business.dynamicGroupForm.formComponent.placeholders.variableValue');
    if (SELECT_TYPES.includes(propertyType as PROPERTY_TYPES)) {
      return conditionType === ConditionType.IMMUTABLE
        ? t('business.dynamicGroupForm.formComponent.placeholders.immutableSelect')
        : t('business.dynamicGroupForm.formComponent.placeholders.variableSelect');
    }
    return name;
  }, [property, conditionType, t]);

  return (
    <DynamicComponent
      componentType={componentType}
      property={property}
      value={value}
      operator={operator}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      {...additionalProps}
      className="form-element"
    />
  );
};

export default FormComponent;
