interface DirectorySearchItem {
  bk_module_name?: unknown;
}

export const normalizeDirectorySearchKeyword = (keyword: string) => keyword.trim().toLowerCase();

export const filterDirectoriesByKeyword = <T extends DirectorySearchItem>(
  directories: T[],
  keyword: string,
): T[] => {
  const normalizedKeyword = normalizeDirectorySearchKeyword(keyword);
  if (!normalizedKeyword) {
    return directories;
  }

  return directories.filter((dir) =>
    String(dir.bk_module_name || '')
      .toLowerCase()
      .includes(normalizedKeyword),
  );
};
