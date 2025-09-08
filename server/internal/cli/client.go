package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/spf13/viper"
)

// HTTPClient provides HTTP client functionality for CLI
type HTTPClient struct {
	baseURL string
	client  *http.Client
}

// NewHTTPClient creates a new HTTP client
func NewHTTPClient() *HTTPClient {
	baseURL := viper.GetString("api.endpoint")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	
	timeout := viper.GetDuration("api.timeout")
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	
	return &HTTPClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// makeAPICall makes an HTTP API call without authentication
func makeAPICall(method, path string, data interface{}) ([]byte, error) {
	client := NewHTTPClient()
	return client.makeRequest(method, path, data, "")
}

// makeAuthenticatedAPICall makes an HTTP API call with authentication
func makeAuthenticatedAPICall(method, path string, data interface{}) ([]byte, error) {
	token := viper.GetString("auth.access_token")
	if token == "" {
		return nil, fmt.Errorf("not authenticated. Please login first")
	}
	
	client := NewHTTPClient()
	return client.makeRequest(method, path, data, token)
}

// makeRequest makes an HTTP request
func (c *HTTPClient) makeRequest(method, path string, data interface{}, token string) ([]byte, error) {
	url := c.baseURL + path
	
	var body io.Reader
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request data: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "cmdb-cli/1.0.0")
	
	// Add tenant ID if available
	if tenantID := viper.GetString("tenant.id"); tenantID != "" {
		req.Header.Set("X-Tenant-ID", tenantID)
	}
	
	// Add authentication token if provided
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	
	if verbose {
		fmt.Printf("Making %s request to %s\n", method, url)
		if data != nil {
			fmt.Printf("Request body: %+v\n", data)
		}
	}
	
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if verbose {
		fmt.Printf("Response status: %d\n", resp.StatusCode)
		fmt.Printf("Response body: %s\n", string(responseBody))
	}
	
	if resp.StatusCode >= 400 {
		// Try to parse error response
		var errorResponse struct {
			Error struct {
				Message string `json:"message"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		
		if err := json.Unmarshal(responseBody, &errorResponse); err == nil && errorResponse.Error.Message != "" {
			return responseBody, fmt.Errorf("API error (%d): %s", resp.StatusCode, errorResponse.Error.Message)
		}
		
		return responseBody, fmt.Errorf("API error (%d): %s", resp.StatusCode, resp.Status)
	}
	
	return responseBody, nil
}

// handleAPIError handles common API errors
func handleAPIError(err error) {
	if err == nil {
		return
	}
	
	// Check for authentication errors
	if err.Error() == "not authenticated. Please login first" {
		fmt.Printf("Error: %s\n", err.Error())
		fmt.Println("Use 'cmdb auth login' to authenticate.")
		return
	}
	
	fmt.Printf("Error: %s\n", err.Error())
}

// formatOutput formats output based on the configured format
func formatOutput(data interface{}) error {
	format := viper.GetString("output.format")
	
	switch format {
	case "json":
		return formatJSON(data)
	case "yaml":
		return formatYAML(data)
	case "table":
		return formatTable(data)
	default:
		return formatTable(data)
	}
}

// formatJSON formats output as JSON
func formatJSON(data interface{}) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to format JSON: %w", err)
	}
	fmt.Println(string(jsonData))
	return nil
}

// formatYAML formats output as YAML (placeholder)
func formatYAML(data interface{}) error {
	// For now, just use JSON formatting
	// In a real implementation, you would use a YAML library
	return formatJSON(data)
}

// formatTable formats output as a table (placeholder)
func formatTable(data interface{}) error {
	// For now, just use JSON formatting
	// In a real implementation, you would format as a table
	return formatJSON(data)
}