declare module '*.xlsx' {
    const content: string;
    export default content;
}

declare module '*.svg?react' {
  import React = require('react');
  const ReactComponent: React.FunctionComponent<React.ComponentProps<'svg'>>;
  export default ReactComponent;
}
