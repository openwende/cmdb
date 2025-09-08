package main

import (
	"os"

	"github.com/wend/cmdb-backend/internal/cli"
)

func main() {
	if err := cli.Execute(); err != nil {
		os.Exit(1)
	}
}