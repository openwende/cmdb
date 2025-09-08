#!/usr/bin/env python3
"""
CSV Exporter Plugin for WEND CMDB
Demonstrates an export plugin implementation
"""

import os
import json
import csv
import io
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime, date
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CSVExporterPlugin:
    def __init__(self, config=None):
        self.config = config or {}
        self.delimiter = self.config.get('delimiter', ',')
        self.quote_char = self.config.get('quote_char', '"')
        self.escape_char = self.config.get('escape_char', '\\')
        self.include_headers = self.config.get('include_headers', True)
        self.encoding = self.config.get('encoding', 'utf-8')
        self.date_format = self.config.get('date_format', '%Y-%m-%d')
        self.datetime_format = self.config.get('datetime_format', '%Y-%m-%d %H:%M:%S')
        
        # Supported formats
        self.supported_formats = ['csv', 'tsv']
        
        logger.info(f"CSV exporter initialized with config: {self.config}")
    
    def export(self, data, format_type, options=None):
        """Export data to CSV format"""
        try:
            if format_type not in self.supported_formats:
                raise ValueError(f"Unsupported format: {format_type}")
            
            # Override config with options if provided
            config = self.config.copy()
            if options:
                config.update(options)
            
            # Set delimiter based on format
            if format_type == 'tsv':
                config['delimiter'] = '\t'
            
            # Convert data to list of dictionaries if needed
            if isinstance(data, dict):
                data = [data]
            elif not isinstance(data, list):
                raise ValueError("Data must be a list or dictionary")
            
            if not data:
                return b''  # Empty CSV for empty data
            
            # Create CSV in memory
            output = io.StringIO()
            
            # Get field names from first record
            if isinstance(data[0], dict):
                fieldnames = list(data[0].keys())
            else:
                raise ValueError("Data items must be dictionaries")
            
            # Create CSV writer
            writer = csv.DictWriter(
                output,
                fieldnames=fieldnames,
                delimiter=config.get('delimiter', ','),
                quotechar=config.get('quote_char', '"'),
                escapechar=config.get('escape_char', '\\'),
                quoting=csv.QUOTE_MINIMAL
            )
            
            # Write headers if requested
            if config.get('include_headers', True):
                writer.writeheader()
            
            # Write data rows
            for row in data:
                # Format special data types
                formatted_row = self._format_row(row, config)
                writer.writerow(formatted_row)
            
            # Get CSV content
            csv_content = output.getvalue()
            output.close()
            
            # Encode to bytes
            encoding = config.get('encoding', 'utf-8')
            return csv_content.encode(encoding)
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            raise
    
    def export_stream(self, data_stream, format_type, options=None):
        """Export streaming data to CSV format"""
        # For this example, we'll collect all data first
        # In a real implementation, this would stream the output
        data = list(data_stream)
        return self.export(data, format_type, options)
    
    def get_supported_formats(self):
        """Get list of supported export formats"""
        return self.supported_formats
    
    def get_format_options(self, format_type):
        """Get available options for a specific format"""
        if format_type not in self.supported_formats:
            return {}
        
        return {
            "delimiter": {
                "type": "string",
                "description": "Field delimiter character",
                "default": "," if format_type == "csv" else "\t",
                "examples": [",", ";", "\t", "|"]
            },
            "quote_char": {
                "type": "string",
                "description": "Quote character for fields containing delimiters",
                "default": "\"",
                "examples": ["\"", "'"]
            },
            "include_headers": {
                "type": "boolean",
                "description": "Include column headers in output",
                "default": True
            },
            "encoding": {
                "type": "string",
                "description": "Character encoding for output file",
                "default": "utf-8",
                "enum": ["utf-8", "utf-16", "iso-8859-1"]
            },
            "date_format": {
                "type": "string",
                "description": "Format string for date fields",
                "default": "%Y-%m-%d",
                "examples": ["%Y-%m-%d", "%m/%d/%Y", "%d.%m.%Y"]
            },
            "datetime_format": {
                "type": "string",
                "description": "Format string for datetime fields",
                "default": "%Y-%m-%d %H:%M:%S",
                "examples": ["%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M", "%Y-%m-%dT%H:%M:%SZ"]
            }
        }
    
    def _format_row(self, row, config):
        """Format a data row for CSV output"""
        formatted_row = {}
        
        for key, value in row.items():
            if value is None:
                formatted_row[key] = ''
            elif isinstance(value, datetime):
                formatted_row[key] = value.strftime(config.get('datetime_format', '%Y-%m-%d %H:%M:%S'))
            elif isinstance(value, date):
                formatted_row[key] = value.strftime(config.get('date_format', '%Y-%m-%d'))
            elif isinstance(value, (list, dict)):
                # Convert complex types to JSON strings
                formatted_row[key] = json.dumps(value)
            elif isinstance(value, bool):
                formatted_row[key] = 'true' if value else 'false'
            else:
                formatted_row[key] = str(value)
        
        return formatted_row

class PluginHTTPHandler(BaseHTTPRequestHandler):
    def __init__(self, plugin, *args, **kwargs):
        self.plugin = plugin
        super().__init__(*args, **kwargs)
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            parsed_url = urlparse(self.path)
            
            if parsed_url.path == '/api/execute':
                self.handle_execute()
            elif parsed_url.path == '/api/health':
                self.handle_health()
            elif parsed_url.path == '/api/configure':
                self.handle_configure()
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            parsed_url = urlparse(self.path)
            
            if parsed_url.path == '/api/health':
                self.handle_health()
            elif parsed_url.path == '/api/info':
                self.handle_info()
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def handle_execute(self):
        """Handle plugin execution requests"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            request_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            
            operation = request_data.get('operation')
            params = request_data.get('params', {})
            request_id = request_data.get('request_id')
            
            logger.info(f"Executing operation: {operation}")
            
            # Route to appropriate method
            if operation == 'export':
                result = self.plugin.export(
                    params.get('data'),
                    params.get('format'),
                    params.get('options')
                )
                # Convert bytes to base64 for JSON response
                import base64
                result = base64.b64encode(result).decode('utf-8')
                
            elif operation == 'export_stream':
                # For demo, treat as regular export
                result = self.plugin.export(
                    list(params.get('data', [])),
                    params.get('format'),
                    params.get('options')
                )
                import base64
                result = base64.b64encode(result).decode('utf-8')
                
            elif operation == 'get_supported_formats':
                result = self.plugin.get_supported_formats()
                
            elif operation == 'get_format_options':
                result = self.plugin.get_format_options(params.get('format'))
                
            else:
                self.send_json_response(400, {
                    "success": False,
                    "error": f"Unknown operation: {operation}",
                    "request_id": request_id
                })
                return
            
            self.send_json_response(200, {
                "success": True,
                "data": result,
                "request_id": request_id,
                "duration_ms": 0
            })
            
        except Exception as e:
            logger.error(f"Error executing operation: {e}")
            self.send_json_response(500, {
                "success": False,
                "error": str(e),
                "request_id": request_data.get('request_id') if 'request_data' in locals() else None
            })
    
    def handle_health(self):
        """Handle health check requests"""
        self.send_json_response(200, {
            "success": True,
            "status": "healthy",
            "plugin_id": "csv-exporter",
            "version": "1.0.0"
        })
    
    def handle_configure(self):
        """Handle configuration updates"""
        try:
            content_length = int(self.headers['Content-Length'])
            config_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            
            # Update plugin configuration
            self.plugin.config.update(config_data.get('config', {}))
            self.plugin.__init__(self.plugin.config)
            
            logger.info(f"Plugin reconfigured with: {self.plugin.config}")
            
            self.send_json_response(200, {
                "success": True,
                "message": "Plugin reconfigured successfully"
            })
            
        except Exception as e:
            logger.error(f"Error configuring plugin: {e}")
            self.send_json_response(500, {"success": False, "error": str(e)})
    
    def handle_info(self):
        """Handle plugin info requests"""
        self.send_json_response(200, {
            "success": True,
            "data": {
                "id": "csv-exporter",
                "name": "CSV Data Exporter",
                "version": "1.0.0",
                "type": "exporter",
                "status": "running",
                "config": self.plugin.config,
                "supported_operations": [
                    "export",
                    "export_stream", 
                    "get_supported_formats",
                    "get_format_options"
                ],
                "supported_formats": self.plugin.get_supported_formats()
            }
        })
    
    def send_json_response(self, status_code, data):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override log message to use our logger"""
        logger.info(f"{self.address_string()} - {format % args}")

def create_handler(plugin):
    """Create HTTP handler with plugin instance"""
    def handler(*args, **kwargs):
        return PluginHTTPHandler(plugin, *args, **kwargs)
    return handler

def main():
    """Main plugin entry point"""
    try:
        # Get configuration from environment
        plugin_id = os.environ.get('CMDB_PLUGIN_ID', 'csv-exporter')
        port = int(os.environ.get('CMDB_PLUGIN_PORT', '8002'))
        config_str = os.environ.get('CMDB_PLUGIN_CONFIG', '{}')
        
        # Parse configuration
        try:
            config = json.loads(config_str)
        except json.JSONDecodeError:
            logger.warning(f"Invalid config JSON, using defaults: {config_str}")
            config = {}
        
        logger.info(f"Starting CSV exporter plugin on port {port}")
        logger.info(f"Plugin ID: {plugin_id}")
        logger.info(f"Configuration: {config}")
        
        # Create plugin instance
        plugin = CSVExporterPlugin(config)
        
        # Create HTTP server
        handler = create_handler(plugin)
        server = HTTPServer(('', port), handler)
        
        logger.info(f"CSV exporter plugin listening on port {port}")
        
        # Start server
        server.serve_forever()
        
    except KeyboardInterrupt:
        logger.info("Plugin stopped by user")
    except Exception as e:
        logger.error(f"Plugin failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()