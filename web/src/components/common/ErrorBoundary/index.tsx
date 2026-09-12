import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Result } from 'antd';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  t?: (key: string) => string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={t?.('common.errors.boundary.title') ?? 'Something went wrong'}
          subTitle={
            t?.('common.errors.boundary.subtitle') ??
            'An unexpected error occurred. Please try again.'
          }
          extra={
            <Button type="primary" onClick={this.handleReset}>
              {t?.('common.errors.boundary.retry') ?? 'Try Again'}
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

const ErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 't'>> = (props) => {
  const { t } = useTranslation();
  return <ErrorBoundaryClass {...props} t={t} />;
};

export default ErrorBoundary;
