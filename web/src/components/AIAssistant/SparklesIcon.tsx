import React from 'react';

/** AI 入口用的星光图标（antd 图标库里没有），颜色跟随 currentColor，大小跟随字号 */
const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span role="img" aria-hidden="true" className={`anticon${className ? ` ${className}` : ''}`}>
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false">
      <path d="M10 2.5l1.6 4.9a3 3 0 0 0 1.9 1.9l4.9 1.6-4.9 1.6a3 3 0 0 0-1.9 1.9L10 19.3l-1.6-4.9a3 3 0 0 0-1.9-1.9L1.6 10.9l4.9-1.6a3 3 0 0 0 1.9-1.9L10 2.5z" />
      <path d="M18.5 13.5l.8 2.2a1.5 1.5 0 0 0 .9.9l2.2.8-2.2.8a1.5 1.5 0 0 0-.9.9l-.8 2.2-.8-2.2a1.5 1.5 0 0 0-.9-.9l-2.2-.8 2.2-.8a1.5 1.5 0 0 0 .9-.9l.8-2.2z" />
    </svg>
  </span>
);

export default SparklesIcon;
