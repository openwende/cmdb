package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"syscall"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh/terminal"
)

// userCmd represents the user command
var userCmd = &cobra.Command{
	Use:   "user",
	Short: "User management",
	Long:  `Manage users, roles, and permissions.`,
}

// userListCmd represents the user list command
var userListCmd = &cobra.Command{
	Use:   "list",
	Short: "List users",
	Long:  `List all users in the system.`,
	Run: func(cmd *cobra.Command, args []string) {
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		search, _ := cmd.Flags().GetString("search")
		status, _ := cmd.Flags().GetString("status")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if search != "" {
			params += "&search=" + search
		}
		if status != "" {
			params += "&status=" + status
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/users"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var listResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Items []map[string]interface{} `json:"items"`
				Pagination struct {
					Page     int `json:"page"`
					PageSize int `json:"page_size"`
					Total    int `json:"total"`
				} `json:"pagination"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &listResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !listResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to list users\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// userShowCmd represents the user show command
var userShowCmd = &cobra.Command{
	Use:   "show <user-id>",
	Short: "Show user details",
	Long:  `Show detailed information about a specific user.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		userID := args[0]
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/users/"+userID, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var showResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &showResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !showResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get user details\n")
			os.Exit(1)
		}
		
		if err := formatOutput(showResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// userCreateCmd represents the user create command
var userCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new user",
	Long:  `Create a new user in the system.`,
	Run: func(cmd *cobra.Command, args []string) {
		username, _ := cmd.Flags().GetString("username")
		email, _ := cmd.Flags().GetString("email")
		name, _ := cmd.Flags().GetString("name")
		password, _ := cmd.Flags().GetString("password")
		roles, _ := cmd.Flags().GetStringSlice("role")
		
		if username == "" {
			fmt.Fprintf(os.Stderr, "Username is required\n")
			os.Exit(1)
		}
		
		if email == "" {
			fmt.Fprintf(os.Stderr, "Email is required\n")
			os.Exit(1)
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
		
		// Prepare user data
		userData := map[string]interface{}{
			"username": username,
			"email":    email,
			"name":     name,
			"password": password,
		}
		
		if len(roles) > 0 {
			userData["roles"] = roles
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/users", userData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var createResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &createResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !createResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to create user\n")
			os.Exit(1)
		}
		
		fmt.Println("User created successfully!")
		if err := formatOutput(createResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// userUpdateCmd represents the user update command
var userUpdateCmd = &cobra.Command{
	Use:   "update <user-id>",
	Short: "Update a user",
	Long:  `Update an existing user.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		userID := args[0]
		email, _ := cmd.Flags().GetString("email")
		name, _ := cmd.Flags().GetString("name")
		status, _ := cmd.Flags().GetString("status")
		
		// Prepare update data (only include non-empty values)
		updateData := make(map[string]interface{})
		if email != "" {
			updateData["email"] = email
		}
		if name != "" {
			updateData["name"] = name
		}
		if status != "" {
			updateData["status"] = status
		}
		
		if len(updateData) == 0 {
			fmt.Fprintf(os.Stderr, "No update data provided\n")
			os.Exit(1)
		}
		
		response, err := makeAuthenticatedAPICall("PUT", "/api/v1/users/"+userID, updateData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var updateResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &updateResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !updateResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to update user\n")
			os.Exit(1)
		}
		
		fmt.Println("User updated successfully!")
		if err := formatOutput(updateResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// userRoleCmd represents the user role command
var userRoleCmd = &cobra.Command{
	Use:   "role",
	Short: "Manage user roles",
	Long:  `Manage role assignments for users.`,
}

// userRoleAssignCmd represents the user role assign command
var userRoleAssignCmd = &cobra.Command{
	Use:   "assign <user-id> <role-name>",
	Short: "Assign role to user",
	Long:  `Assign a role to a user.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		userID := args[0]
		roleName := args[1]
		
		assignData := map[string]interface{}{
			"role_name": roleName,
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/users/"+userID+"/roles", assignData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse response
		var assignResponse struct {
			Success bool `json:"success"`
		}
		
		if err := json.Unmarshal(response, &assignResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !assignResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to assign role to user\n")
			os.Exit(1)
		}
		
		fmt.Printf("Role %s assigned to user %s successfully!\n", roleName, userID)
	},
}

// userRoleRevokeCmd represents the user role revoke command
var userRoleRevokeCmd = &cobra.Command{
	Use:   "revoke <user-id> <role-name>",
	Short: "Revoke role from user",
	Long:  `Revoke a role from a user.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		userID := args[0]
		roleName := args[1]
		
		response, err := makeAuthenticatedAPICall("DELETE", "/api/v1/users/"+userID+"/roles/"+roleName, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse response
		var revokeResponse struct {
			Success bool `json:"success"`
		}
		
		if err := json.Unmarshal(response, &revokeResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !revokeResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to revoke role from user\n")
			os.Exit(1)
		}
		
		fmt.Printf("Role %s revoked from user %s successfully!\n", roleName, userID)
	},
}

// roleCmd represents the role command
var roleCmd = &cobra.Command{
	Use:   "role",
	Short: "Role management",
	Long:  `Manage roles and permissions.`,
}

// roleListCmd represents the role list command
var roleListCmd = &cobra.Command{
	Use:   "list",
	Short: "List roles",
	Long:  `List all roles in the system.`,
	Run: func(cmd *cobra.Command, args []string) {
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/roles", nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var listResponse struct {
			Success bool                     `json:"success"`
			Data    []map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &listResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !listResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to list roles\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	// Add subcommands to user command
	userCmd.AddCommand(userListCmd)
	userCmd.AddCommand(userShowCmd)
	userCmd.AddCommand(userCreateCmd)
	userCmd.AddCommand(userUpdateCmd)
	userCmd.AddCommand(userRoleCmd)
	
	// Add subcommands to user role command
	userRoleCmd.AddCommand(userRoleAssignCmd)
	userRoleCmd.AddCommand(userRoleRevokeCmd)
	
	// Add standalone role command
	rootCmd.AddCommand(roleCmd)
	roleCmd.AddCommand(roleListCmd)
	
	// List command flags
	userListCmd.Flags().Int("page", 1, "Page number")
	userListCmd.Flags().Int("page-size", 20, "Page size")
	userListCmd.Flags().String("search", "", "Search term")
	userListCmd.Flags().String("status", "", "Filter by status")
	
	// Create command flags
	userCreateCmd.Flags().StringP("username", "u", "", "Username (required)")
	userCreateCmd.Flags().StringP("email", "e", "", "Email (required)")
	userCreateCmd.Flags().StringP("name", "n", "", "Full name")
	userCreateCmd.Flags().StringP("password", "p", "", "Password")
	userCreateCmd.Flags().StringSlice("role", []string{}, "Roles to assign")
	
	// Update command flags
	userUpdateCmd.Flags().StringP("email", "e", "", "Email")
	userUpdateCmd.Flags().StringP("name", "n", "", "Full name")
	userUpdateCmd.Flags().String("status", "", "Status (active, inactive, suspended)")
}