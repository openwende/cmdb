import React, { useMemo } from 'react';
import { Property, ConditionType, OperatorType } from '../../Types';
import { QUERY_OPERATOR } from '../../constants';
import DynamicComponent from '@/components/Business/FormComponents/DynamicComponent';
import { usePropertyInfo } from '../../hooks/usePropertyInfo';

const SELECT_TYPES = [
    'list',
    'enum',
    'timezone',
    'organization',
    'date',
    'time',
    'enumquote',
    'enummulti',
    'foreignkey'
];
const OPTION_PROP_TYPES = [
    'int',
    'list',
    'enum',
    'enumquote',
    'enummulti'
];
const UNSUPPORTED_OPERATORS = [
    QUERY_OPERATOR.CONTAINS,
    QUERY_OPERATOR.LIKE,
] as OperatorType[];

interface ComponentProps {
    bizId: number;
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
    disabled
}) => {
    const { propertyType, options, isSetName, isModuleName } = usePropertyInfo(property);

    // Component type determination
    const componentType = useMemo(() => {
        if (
            (isSetName || isModuleName) &&
            !UNSUPPORTED_OPERATORS.includes(operator)
        ) {
            return 'objname';
        }
        return propertyType;
    }, [operator]);

    const additionalProps = useMemo(() => {
        const props: { [key: string]: any } = {};
        if (OPTION_PROP_TYPES.includes(propertyType)) {
            props.options = options || [];
        } else if (propertyType === 'objuser') {
            props.fastSelect = true;
        }
        if (isSetName || isModuleName) {
            props.bizId = bizId;
        }
        return props;
    }, [propertyType, operator, bizId]);

    const placeholder = useMemo(() => {
        const name = conditionType === ConditionType.IMMUTABLE
            ? '条件值'
            : '默认值';
        if (SELECT_TYPES.includes(propertyType)) {
            return `请选择${name}`;
        }
        return `请输入${name}`;
    }, [property, conditionType]);

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
}

export default FormComponent;