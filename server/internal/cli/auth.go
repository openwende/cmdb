package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/crypto/ssh/terminal"
)

// authCmd represents the auth command
var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication management",
	Long:  `Manage authentication including login, logout, and token management.`,
}

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to CMDB",
	Long:  `Login to CMDB using username and password.`,
	Run: func(cmd *cobra.Command, args []string) {
		username, _ := cmd.Flags().GetString("username")
		password, _ := cmd.Flags().GetString("password")
		
		if username == "" {
			fmt.Print("Username: ")
			fmt.Scanln(&username)
		}
		
		if password == "" {
			fmt.Print("Password: ")
			bytePassword, err := terminal.ReadPassword(int(syscall.Stdin))
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error reading password: %v\n", err)
				os.Exit(1)
			}
			password = string(bytePassword)
			fmt.Println()
		}
		
		// Prepare login request
		loginData := map[string]interface{}{
			"username": username,
			"password": password,
		}
		
		// Make API call
		response, err := makeAPICall("POST", "/api/v1/auth/login", loginData)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Login failed: %v\n", err)
			os.Exit(1)
		}
		
		// Parse response
		var loginResponse struct {
			Success bool `json:"success"`
			Data    struct {
				AccessToken  string `json:"access_token"`
				RefreshToken string `json:"refresh_token"`
				ExpiresIn    int    `json:"expires_in"`
			} `json:"data"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		
		if err := json.Unmarshal(response, &loginResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse login response: %v\n", err)
			os.Exit(1)
		}
		
		if !loginResponse.Success {
			if loginResponse.Error != nil {
				fmt.Fprintf(os.Stderr, "Login failed: %s\n", loginResponse.Error.Message)
			} else {
				fmt.Fprintf(os.Stderr, "Login failed\n")
			}
			os.Exit(1)
		}
		
		// Save tokens to config
		viper.Set("auth.access_token", loginResponse.Data.AccessToken)
		viper.Set("auth.refresh_token", loginResponse.Data.RefreshToken)
		
		// Save config
		configDir := getConfigDir()
		ensureConfigDir()
		configFile := configDir + "/config.yaml"
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Failed to save tokens: %v\n", err)
		}
		
		fmt.Println("Login successful!")
		fmt.Printf("Access token expires in %d seconds\n", loginResponse.Data.ExpiresIn)
	},
}

// logoutCmd represents the logout command
var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from CMDB",
	Long:  `Logout from CMDB and clear stored tokens.`,
	Run: func(cmd *cobra.Command, args []string) {
		token := viper.GetString("auth.access_token")
		
		if token != "" {
			// Call logout endpoint
			_, err := makeAuthenticatedAPICall("POST", "/api/v1/auth/logout", nil)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: Server logout failed: %v\n", err)
			}
		}
		
		// Clear tokens from config
		viper.Set("auth.access_token", "")
		viper.Set("auth.refresh_token", "")
		
		// Save config
		configDir := getConfigDir()
		configFile := configDir + "/config.yaml"
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Failed to clear tokens: %v\n", err)
		}
		
		fmt.Println("Logout successful!")
	},
}

// refreshCmd represents the refresh command
var refreshCmd = &cobra.Command{
	Use:   "refresh",
	Short: "Refresh authentication token",
	Long:  `Refresh the authentication token using the stored refresh token.`,
	Run: func(cmd *cobra.Command, args []string) {
		refreshToken := viper.GetString("auth.refresh_token")
		if refreshToken == "" {
			fmt.Fprintf(os.Stderr, "No refresh token found. Please login first.\n")
			os.Exit(1)
		}
		
		// Prepare refresh request
		refreshData := map[string]interface{}{
			"refresh_token": refreshToken,
		}
		
		// Make API call
		response, err := makeAPICall("POST", "/api/v1/auth/refresh", refreshData)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Token refresh failed: %v\n", err)
			os.Exit(1)
		}
		
		// Parse response
		var refreshResponse struct {
			Success bool `json:"success"`
			Data    struct {
				AccessToken  string `json:"access_token"`
				RefreshToken string `json:"refresh_token"`
				ExpiresIn    int    `json:"expires_in"`
			} `json:"data"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		
		if err := json.Unmarshal(response, &refreshResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse refresh response: %v\n", err)
			os.Exit(1)
		}
		
		if !refreshResponse.Success {
			if refreshResponse.Error != nil {
				fmt.Fprintf(os.Stderr, "Token refresh failed: %s\n", refreshResponse.Error.Message)
			} else {
				fmt.Fprintf(os.Stderr, "Token refresh failed\n")
			}
			os.Exit(1)
		}
		
		// Save new tokens to config
		viper.Set("auth.access_token", refreshResponse.Data.AccessToken)
		viper.Set("auth.refresh_token", refreshResponse.Data.RefreshToken)
		
		// Save config
		configDir := getConfigDir()
		configFile := configDir + "/config.yaml"
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Failed to save tokens: %v\n", err)
		}
		
		fmt.Println("Token refresh successful!")
		fmt.Printf("Access token expires in %d seconds\n", refreshResponse.Data.ExpiresIn)
	},
}

// statusCmd represents the status command
var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show authentication status",
	Long:  `Show current authentication status and token information.`,
	Run: func(cmd *cobra.Command, args []string) {
		token := viper.GetString("auth.access_token")
		refreshToken := viper.GetString("auth.refresh_token")
		
		if token == "" {
			fmt.Println("Not logged in")
			return
		}
		
		// Call user info endpoint to validate token
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/auth/me", nil)
		if err != nil {
			fmt.Printf("Authentication status: Invalid (token may be expired)\n")
			fmt.Printf("Error: %v\n", err)
			return
		}
		
		// Parse response
		var userResponse struct {
			Success bool `json:"success"`
			Data    struct {
				ID       string `json:"id"`
				Username string `json:"username"`
				Email    string `json:"email"`
				Name     string `json:"name"`
				Roles    []struct {
					Name string `json:"name"`
				} `json:"roles"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &userResponse); err != nil {
			fmt.Printf("Authentication status: Invalid (failed to parse response)\n")
			return
		}
		
		if !userResponse.Success {
			fmt.Printf("Authentication status: Invalid\n")
			return
		}
		
		fmt.Printf("Authentication status: Valid\n")
		fmt.Printf("User ID: %s\n", userResponse.Data.ID)
		fmt.Printf("Username: %s\n", userResponse.Data.Username)
		fmt.Printf("Email: %s\n", userResponse.Data.Email)
		fmt.Printf("Name: %s\n", userResponse.Data.Name)
		
		if len(userResponse.Data.Roles) > 0 {
			fmt.Println("Roles:")
			for _, role := range userResponse.Data.Roles {
				fmt.Printf("  - %s\n", role.Name)
			}
		}
		
		fmt.Printf("Has access token: Yes\n")
		if refreshToken != "" {
			fmt.Printf("Has refresh token: Yes\n")
		} else {
			fmt.Printf("Has refresh token: No\n")
		}
	},
}

func init() {
	// Add subcommands to auth command
	authCmd.AddCommand(loginCmd)
	authCmd.AddCommand(logoutCmd)
	authCmd.AddCommand(refreshCmd)
	authCmd.AddCommand(statusCmd)
	
	// Login command flags
	loginCmd.Flags().StringP("username", "u", "", "Username")
	loginCmd.Flags().StringP("password", "p", "", "Password")
}