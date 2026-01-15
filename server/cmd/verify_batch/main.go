package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	fmt.Println("🔍 Verify Batch API ...")

	data := map[string]interface{}{
		"instances": []map[string]interface{}{
			{
				"properties": map[string]interface{}{
					"inner_ip":  "10.0.0.201",
					"hostname":  "batch-01",
					"cpu_cores": 4,
				},
			},
			{
				"properties": map[string]interface{}{
					"inner_ip":  "10.0.0.202",
					"hostname":  "batch-02",
					"cpu_cores": 8,
				},
			},
		},
	}
	jsonData, _ := json.Marshal(data)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", baseURL+"/models/host/instances/batch", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ Failed to batch create: %v\n", err)
		return
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Printf("Status: %s\nBody: %s\n", resp.Status, string(body))
}
