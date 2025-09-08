package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// configCmd represents the config command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration management",
	Long:  `Manage CLI configuration settings.`,
}

// configShowCmd represents the config show command
var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current configuration",
	Long:  `Display the current CLI configuration.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Current CLI configuration:")
		fmt.Printf("Config file: %s\n", viper.ConfigFileUsed())
		fmt.Println()
		
		fmt.Println("API Settings:")
		fmt.Printf("  Endpoint: %s\n", viper.GetString("api.endpoint"))
		fmt.Printf("  Timeout: %s\n", viper.GetString("api.timeout"))
		fmt.Println()
		
		fmt.Println("Authentication:")
		token := viper.GetString("auth.access_token")
		if token != "" {
			fmt.Printf("  Access Token: %s...%s\n", token[:8], token[len(token)-8:])
		} else {
			fmt.Printf("  Access Token: Not set\n")
		}
		refreshToken := viper.GetString("auth.refresh_token")
		if refreshToken != "" {
			fmt.Printf("  Refresh Token: %s...%s\n", refreshToken[:8], refreshToken[len(refreshToken)-8:])
		} else {
			fmt.Printf("  Refresh Token: Not set\n")
		}
		fmt.Println()
		
		fmt.Println("Output Settings:")
		fmt.Printf("  Format: %s\n", viper.GetString("output.format"))
		fmt.Printf("  No Headers: %t\n", viper.GetBool("output.no_headers"))
		fmt.Println()
		
		fmt.Println("Tenant:")
		fmt.Printf("  ID: %s\n", viper.GetString("tenant.id"))
		fmt.Println()
		
		fmt.Println("Pagination:")
		fmt.Printf("  Default Size: %d\n", viper.GetInt("paging.size"))
		fmt.Println()
		
		fmt.Println("Other:")
		fmt.Printf("  Verbose: %t\n", viper.GetBool("verbose"))
	},
}

// configSetCmd represents the config set command
var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set configuration value",
	Long:  `Set a configuration value.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := args[1]
		
		// Validate key
		validKeys := []string{
			"api.endpoint",
			"api.timeout",
			"output.format",
			"output.no_headers",
			"tenant.id",
			"paging.size",
		}
		
		valid := false
		for _, validKey := range validKeys {
			if key == validKey {
				valid = true
				break
			}
		}
		
		if !valid {
			fmt.Fprintf(os.Stderr, "Invalid configuration key: %s\n", key)
			fmt.Fprintf(os.Stderr, "Valid keys: %v\n", validKeys)
			os.Exit(1)
		}
		
		// Set the value
		viper.Set(key, value)
		
		// Save to config file
		configDir := getConfigDir()
		ensureConfigDir()
		configFile := configDir + "/config.yaml"
		
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to save configuration: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Printf("Configuration updated: %s = %s\n", key, value)
	},
}

// configGetCmd represents the config get command
var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get configuration value",
	Long:  `Get a configuration value.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := viper.GetString(key)
		
		if value == "" {
			fmt.Fprintf(os.Stderr, "Configuration key '%s' not found or empty\n", key)
			os.Exit(1)
		}
		
		fmt.Printf("%s = %s\n", key, value)
	},
}

// configUnsetCmd represents the config unset command
var configUnsetCmd = &cobra.Command{
	Use:   "unset <key>",
	Short: "Unset configuration value",
	Long:  `Remove a configuration value.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		
		// Set to empty string (viper doesn't have unset)
		viper.Set(key, "")
		
		// Save to config file
		configDir := getConfigDir()
		ensureConfigDir()
		configFile := configDir + "/config.yaml"
		
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to save configuration: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Printf("Configuration key '%s' unset\n", key)
	},
}

// configResetCmd represents the config reset command
var configResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset configuration to defaults",
	Long:  `Reset all configuration to default values.`,
	Run: func(cmd *cobra.Command, args []string) {
		force, _ := cmd.Flags().GetBool("force")
		
		if !force {
			fmt.Print("Are you sure you want to reset all configuration? This will clear all settings including authentication tokens. [y/N]: ")
			var confirmation string
			fmt.Scanln(&confirmation)
			if confirmation != "y" && confirmation != "Y" && confirmation != "yes" && confirmation != "Yes" {
				fmt.Println("Reset cancelled.")
				return
			}
		}
		
		// Clear all configuration
		for _, key := range viper.AllKeys() {
			viper.Set(key, "")
		}
		
		// Reset to defaults
		setDefaults()
		
		// Save to config file
		configDir := getConfigDir()
		ensureConfigDir()
		configFile := configDir + "/config.yaml"
		
		if err := viper.WriteConfigAs(configFile); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to save configuration: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Println("Configuration reset to defaults.")
	},
}

// configEditCmd represents the config edit command
var configEditCmd = &cobra.Command{
	Use:   "edit",
	Short: "Edit configuration file",
	Long:  `Open the configuration file in an editor.`,
	Run: func(cmd *cobra.Command, args []string) {
		configFile := viper.ConfigFileUsed()
		if configFile == "" {
			configDir := getConfigDir()
			ensureConfigDir()
			configFile = configDir + "/config.yaml"
		}
		
		editor := os.Getenv("EDITOR")
		if editor == "" {
			editor = "vi" // Default to vi
		}
		
		fmt.Printf("Opening %s with %s...\n", configFile, editor)
		
		// In a real implementation, you would execute the editor
		// cmd := exec.Command(editor, configFile)
		// cmd.Stdin = os.Stdin
		// cmd.Stdout = os.Stdout
		// cmd.Stderr = os.Stderr
		// err := cmd.Run()
		
		fmt.Printf("Editor command: %s %s\n", editor, configFile)
		fmt.Println("Note: This is a placeholder - in a real implementation, the editor would open.")
	},
}

func init() {
	// Add subcommands to config command
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configUnsetCmd)
	configCmd.AddCommand(configResetCmd)
	configCmd.AddCommand(configEditCmd)
	
	// Reset command flags
	configResetCmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
}