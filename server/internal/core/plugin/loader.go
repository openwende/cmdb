package plugin

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Loader handles plugin loading and installation
type Loader interface {
	LoadPackage(ctx context.Context, packagePath string) (*PluginManifest, error)
	InstallPlugin(ctx context.Context, packagePath, installPath string) error
	UninstallPlugin(ctx context.Context, installPath string) error
	ValidatePackage(ctx context.Context, packagePath string) error
}

type loader struct {
	config *ManagerConfig
}

// NewLoader creates a new plugin loader
func NewLoader(config *ManagerConfig) Loader {
	return &loader{
		config: config,
	}
}

// LoadPackage loads and validates a plugin package
func (l *loader) LoadPackage(ctx context.Context, packagePath string) (*PluginManifest, error) {
	// Determine package type
	ext := strings.ToLower(filepath.Ext(packagePath))
	
	var manifest *PluginManifest
	var err error
	
	switch ext {
	case ".zip":
		manifest, err = l.loadZipPackage(ctx, packagePath)
	case ".gz", ".tgz":
		manifest, err = l.loadTarGzPackage(ctx, packagePath)
	case ".tar":
		manifest, err = l.loadTarPackage(ctx, packagePath)
	default:
		// Try to load as directory
		if stat, statErr := os.Stat(packagePath); statErr == nil && stat.IsDir() {
			manifest, err = l.loadDirectoryPackage(ctx, packagePath)
		} else {
			return nil, fmt.Errorf("unsupported package format: %s", ext)
		}
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to load package: %w", err)
	}
	
	// Validate manifest
	if err := l.validateManifest(manifest); err != nil {
		return nil, fmt.Errorf("invalid manifest: %w", err)
	}
	
	return manifest, nil
}

// InstallPlugin installs a plugin from a package to the specified path
func (l *loader) InstallPlugin(ctx context.Context, packagePath, installPath string) error {
	// Create install directory
	if err := os.MkdirAll(installPath, 0755); err != nil {
		return fmt.Errorf("failed to create install directory: %w", err)
	}
	
	// Extract package
	ext := strings.ToLower(filepath.Ext(packagePath))
	
	switch ext {
	case ".zip":
		return l.extractZipPackage(packagePath, installPath)
	case ".gz", ".tgz":
		return l.extractTarGzPackage(packagePath, installPath)
	case ".tar":
		return l.extractTarPackage(packagePath, installPath)
	default:
		// Copy directory
		if stat, err := os.Stat(packagePath); err == nil && stat.IsDir() {
			return l.copyDirectory(packagePath, installPath)
		}
		return fmt.Errorf("unsupported package format: %s", ext)
	}
}

// UninstallPlugin removes a plugin installation
func (l *loader) UninstallPlugin(ctx context.Context, installPath string) error {
	return os.RemoveAll(installPath)
}

// ValidatePackage validates a plugin package without installing it
func (l *loader) ValidatePackage(ctx context.Context, packagePath string) error {
	_, err := l.LoadPackage(ctx, packagePath)
	return err
}

// Private methods

func (l *loader) loadZipPackage(ctx context.Context, packagePath string) (*PluginManifest, error) {
	reader, err := zip.OpenReader(packagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open zip file: %w", err)
	}
	defer reader.Close()
	
	// Find manifest file
	var manifestFile *zip.File
	for _, file := range reader.File {
		if file.Name == "plugin.yaml" || file.Name == "plugin.yml" || file.Name == "plugin.json" {
			manifestFile = file
			break
		}
	}
	
	if manifestFile == nil {
		return nil, fmt.Errorf("manifest file not found")
	}
	
	// Read manifest
	rc, err := manifestFile.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open manifest file: %w", err)
	}
	defer rc.Close()
	
	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest file: %w", err)
	}
	
	return l.parseManifest(data, manifestFile.Name)
}

func (l *loader) loadTarGzPackage(ctx context.Context, packagePath string) (*PluginManifest, error) {
	file, err := os.Open(packagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open tar.gz file: %w", err)
	}
	defer file.Close()
	
	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()
	
	tarReader := tar.NewReader(gzReader)
	
	return l.findManifestInTar(tarReader)
}

func (l *loader) loadTarPackage(ctx context.Context, packagePath string) (*PluginManifest, error) {
	file, err := os.Open(packagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open tar file: %w", err)
	}
	defer file.Close()
	
	tarReader := tar.NewReader(file)
	
	return l.findManifestInTar(tarReader)
}

func (l *loader) loadDirectoryPackage(ctx context.Context, packagePath string) (*PluginManifest, error) {
	// Look for manifest files
	manifestFiles := []string{"plugin.yaml", "plugin.yml", "plugin.json"}
	
	for _, filename := range manifestFiles {
		manifestPath := filepath.Join(packagePath, filename)
		if _, err := os.Stat(manifestPath); err == nil {
			data, err := os.ReadFile(manifestPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read manifest file: %w", err)
			}
			return l.parseManifest(data, filename)
		}
	}
	
	return nil, fmt.Errorf("manifest file not found")
}

func (l *loader) findManifestInTar(tarReader *tar.Reader) (*PluginManifest, error) {
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read tar entry: %w", err)
		}
		
		if header.Typeflag == tar.TypeReg {
			basename := filepath.Base(header.Name)
			if basename == "plugin.yaml" || basename == "plugin.yml" || basename == "plugin.json" {
				data, err := io.ReadAll(tarReader)
				if err != nil {
					return nil, fmt.Errorf("failed to read manifest file: %w", err)
				}
				return l.parseManifest(data, basename)
			}
		}
	}
	
	return nil, fmt.Errorf("manifest file not found")
}

func (l *loader) parseManifest(data []byte, filename string) (*PluginManifest, error) {
	var manifest PluginManifest
	
	ext := strings.ToLower(filepath.Ext(filename))
	
	switch ext {
	case ".yaml", ".yml":
		if err := yaml.Unmarshal(data, &manifest); err != nil {
			return nil, fmt.Errorf("failed to parse YAML manifest: %w", err)
		}
	case ".json":
		if err := json.Unmarshal(data, &manifest); err != nil {
			return nil, fmt.Errorf("failed to parse JSON manifest: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported manifest format: %s", ext)
	}
	
	return &manifest, nil
}

func (l *loader) validateManifest(manifest *PluginManifest) error {
	if manifest.ID == "" {
		return fmt.Errorf("plugin ID is required")
	}
	if manifest.Name == "" {
		return fmt.Errorf("plugin name is required")
	}
	if manifest.Version == "" {
		return fmt.Errorf("plugin version is required")
	}
	if manifest.Type == "" {
		return fmt.Errorf("plugin type is required")
	}
	
	// Validate plugin type
	validTypes := []PluginType{
		PluginTypeField, PluginTypeValidator, PluginTypeConnector,
		PluginTypeProcessor, PluginTypeExporter, PluginTypeImporter,
		PluginTypeNotifier, PluginTypeExtension,
	}
	
	validType := false
	for _, validT := range validTypes {
		if manifest.Type == validT {
			validType = true
			break
		}
	}
	if !validType {
		return fmt.Errorf("invalid plugin type: %s", manifest.Type)
	}
	
	// Validate version format (basic check)
	if !isValidVersion(manifest.Version) {
		return fmt.Errorf("invalid version format: %s", manifest.Version)
	}
	
	// Validate dependencies
	for dep, version := range manifest.Dependencies {
		if dep == "" || version == "" {
			return fmt.Errorf("invalid dependency: %s:%s", dep, version)
		}
	}
	
	return nil
}

func (l *loader) extractZipPackage(packagePath, installPath string) error {
	reader, err := zip.OpenReader(packagePath)
	if err != nil {
		return fmt.Errorf("failed to open zip file: %w", err)
	}
	defer reader.Close()
	
	for _, file := range reader.File {
		path := filepath.Join(installPath, file.Name)
		
		// Security check: prevent path traversal
		if !strings.HasPrefix(path, installPath) {
			return fmt.Errorf("invalid file path: %s", file.Name)
		}
		
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(path, file.FileInfo().Mode()); err != nil {
				return fmt.Errorf("failed to create directory: %w", err)
			}
			continue
		}
		
		// Create parent directories
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return fmt.Errorf("failed to create parent directory: %w", err)
		}
		
		// Extract file
		if err := l.extractZipFile(file, path); err != nil {
			return fmt.Errorf("failed to extract file %s: %w", file.Name, err)
		}
	}
	
	return nil
}

func (l *loader) extractZipFile(file *zip.File, destPath string) error {
	rc, err := file.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	
	outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.FileInfo().Mode())
	if err != nil {
		return err
	}
	defer outFile.Close()
	
	_, err = io.Copy(outFile, rc)
	return err
}

func (l *loader) extractTarGzPackage(packagePath, installPath string) error {
	file, err := os.Open(packagePath)
	if err != nil {
		return fmt.Errorf("failed to open tar.gz file: %w", err)
	}
	defer file.Close()
	
	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()
	
	tarReader := tar.NewReader(gzReader)
	
	return l.extractTar(tarReader, installPath)
}

func (l *loader) extractTarPackage(packagePath, installPath string) error {
	file, err := os.Open(packagePath)
	if err != nil {
		return fmt.Errorf("failed to open tar file: %w", err)
	}
	defer file.Close()
	
	tarReader := tar.NewReader(file)
	
	return l.extractTar(tarReader, installPath)
}

func (l *loader) extractTar(tarReader *tar.Reader, installPath string) error {
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar entry: %w", err)
		}
		
		path := filepath.Join(installPath, header.Name)
		
		// Security check: prevent path traversal
		if !strings.HasPrefix(path, installPath) {
			return fmt.Errorf("invalid file path: %s", header.Name)
		}
		
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(path, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to create directory: %w", err)
			}
		case tar.TypeReg:
			// Create parent directories
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				return fmt.Errorf("failed to create parent directory: %w", err)
			}
			
			// Extract file
			if err := l.extractTarFile(tarReader, path, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to extract file %s: %w", header.Name, err)
			}
		}
	}
	
	return nil
}

func (l *loader) extractTarFile(tarReader *tar.Reader, destPath string, mode os.FileMode) error {
	outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer outFile.Close()
	
	_, err = io.Copy(outFile, tarReader)
	return err
}

func (l *loader) copyDirectory(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		// Calculate destination path
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		dstPath := filepath.Join(dst, relPath)
		
		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}
		
		// Copy file
		srcFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer srcFile.Close()
		
		dstFile, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode())
		if err != nil {
			return err
		}
		defer dstFile.Close()
		
		_, err = io.Copy(dstFile, srcFile)
		return err
	})
}

// isValidVersion performs basic version validation
func isValidVersion(version string) bool {
	// Basic semantic version check (simplified)
	parts := strings.Split(version, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return false
	}
	
	for _, part := range parts {
		if part == "" {
			return false
		}
		// Could add more sophisticated version validation here
	}
	
	return true
}