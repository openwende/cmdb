import { useEffect, useMemo, useRef, useState } from 'react';
import { getResourceDirectoryTree } from '@/api/services/business';
import { buildDirectoryNameMap, recordUsesDirectory } from '@/pages/Analysis/auditChange';
import type { OperationDetail } from '@/pages/Analysis/Types';

/**
 * 资源池目录 id → 名称。只有当前列表里出现资源池位置时才请求一次；
 * 请求失败时保持空表，位置文案回退为 `资源池 / 目录 #<id>`。
 */
export const useAuditDirectoryNames = (records: OperationDetail[]) => {
  const [directoryNames, setDirectoryNames] = useState<Map<number, string>>(() => new Map());
  const requestedRef = useRef(false);
  const needsDirectories = useMemo(() => records.some(recordUsesDirectory), [records]);

  useEffect(() => {
    if (!needsDirectories || requestedRef.current) return;
    requestedRef.current = true;
    getResourceDirectoryTree()
      .then((response) => setDirectoryNames(buildDirectoryNameMap(response?.data)))
      .catch(() => {
        // 目录名只是展示增强，失败时回退到 #id，不打断页面
      });
  }, [needsDirectories]);

  return directoryNames;
};
