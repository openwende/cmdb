#!/usr/bin/env python3
"""
Email Validator Plugin for WEND CMDB
Demonstrates a field validation plugin implementation
"""

import os
import json
import re
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from threading import Thread
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmailValidatorPlugin:
    def __init__(self, config=None):
        self.config = config or {}
        self.strict_mode = self.config.get('strict_mode', False)
        self.allow_disposable = self.config.get('allow_disposable', True)
        self.custom_domains = self.config.get('custom_domains', [])
        self.blocked_domains = self.config.get('blocked_domains', [])
        
        # Common disposable email domains
        self.disposable_domains = {
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'temp-mail.org', 'throwaway.email'
        }
        
        # Email regex patterns
        self.simple_pattern = re.compile(r'^[^@]+@[^@]+\.[^@]+$')
        self.strict_pattern = re.compile(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        )
        
        logger.info(f"Email validator initialized with config: {self.config}")
    
    def validate_value(self, value, options=None):
        """Validate an email address"""
        if not value:
            return {"valid": False, "error": "Email address is required"}
        
        if not isinstance(value, str):
            return {"valid": False, "error": "Email must be a string"}
        
        value = value.strip().lower()
        
        # Basic format validation
        pattern = self.strict_pattern if self.strict_mode else self.simple_pattern
        if not pattern.match(value):
            return {"valid": False, "error": "Invalid email format"}
        
        # Extract domain
        domain = value.split('@')[1]
        
        # Check blocked domains
        if domain in self.blocked_domains:
            return {"valid": False, "error": f"Domain {domain} is blocked"}
        
        # Check custom domains (if specified, only allow these)
        if self.custom_domains and domain not in self.custom_domains:
            return {"valid": False, "error": f"Domain {domain} is not allowed"}
        
        # Check disposable email domains
        if not self.allow_disposable and domain in self.disposable_domains:
            return {"valid": False, "error": "Disposable email addresses are not allowed"}
        
        return {"valid": True, "normalized": value}
    
    def format_value(self, value, options=None):
        """Format an email address"""
        if not value:
            return value
        
        # Normalize email address
        email = str(value).strip().lower()
        
        # Basic validation
        if '@' in email:
            local, domain = email.split('@', 1)
            # Remove dots from Gmail addresses (Gmail ignores dots in local part)
            if domain == 'gmail.com':
                local = local.replace('.', '')
            return f"{local}@{domain}"
        
        return email
    
    def parse_value(self, input_str, options=None):
        """Parse email from input string"""
        if not input_str:
            return None
        
        # Extract email using regex
        email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        matches = email_pattern.findall(input_str)
        
        if matches:
            return matches[0].lower()
        
        return None
    
    def get_default_value(self, options=None):
        """Get default email value"""
        return ""
    
    def get_field_schema(self):
        """Get field schema for email type"""
        return {
            "type": "string",
            "format": "email",
            "pattern": "^[^@]+@[^@]+\\.[^@]+$",
            "minLength": 5,
            "maxLength": 254,
            "description": "Valid email address",
            "examples": ["user@example.com", "test.email@domain.org"]
        }
    
    def get_supported_operators(self):
        """Get supported query operators for email fields"""
        return ["eq", "ne", "like", "not_like", "in", "not_in", "is_null", "is_not_null"]

class PluginHTTPHandler(BaseHTTPRequestHandler):
    def __init__(self, plugin, *args, **kwargs):
        self.plugin = plugin
        super().__init__(*args, **kwargs)
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            # Parse URL
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
            
            logger.info(f"Executing operation: {operation} with params: {params}")
            
            # Route to appropriate method
            if operation == 'validate_value':
                result = self.plugin.validate_value(
                    params.get('value'),
                    params.get('options')
                )
            elif operation == 'format_value':
                result = self.plugin.format_value(
                    params.get('value'),
                    params.get('options')
                )
            elif operation == 'parse_value':
                result = self.plugin.parse_value(
                    params.get('input'),
                    params.get('options')
                )
            elif operation == 'get_default_value':
                result = self.plugin.get_default_value(params.get('options'))
            elif operation == 'get_field_schema':
                result = self.plugin.get_field_schema()
            elif operation == 'get_supported_operators':
                result = self.plugin.get_supported_operators()
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
                "duration_ms": 0  # Would measure actual duration in production
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
            "plugin_id": "email-validator",
            "version": "1.0.0",
            "uptime": 0  # Would calculate actual uptime
        })
    
    def handle_configure(self):
        """Handle configuration updates"""
        try:
            content_length = int(self.headers['Content-Length'])
            config_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            
            # Update plugin configuration
            self.plugin.config.update(config_data.get('config', {}))
            self.plugin.__init__(self.plugin.config)  # Reinitialize with new config
            
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
                "id": "email-validator",
                "name": "Email Address Validator",
                "version": "1.0.0",
                "type": "field",
                "status": "running",
                "config": self.plugin.config,
                "supported_operations": [
                    "validate_value",
                    "format_value", 
                    "parse_value",
                    "get_default_value",
                    "get_field_schema",
                    "get_supported_operators"
                ]
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
        plugin_id = os.environ.get('CMDB_PLUGIN_ID', 'email-validator')
        port = int(os.environ.get('CMDB_PLUGIN_PORT', '8001'))
        config_str = os.environ.get('CMDB_PLUGIN_CONFIG', '{}')
        
        # Parse configuration
        try:
            config = json.loads(config_str)
        except json.JSONDecodeError:
            logger.warning(f"Invalid config JSON, using defaults: {config_str}")
            config = {}
        
        logger.info(f"Starting email validator plugin on port {port}")
        logger.info(f"Plugin ID: {plugin_id}")
        logger.info(f"Configuration: {config}")
        
        # Create plugin instance
        plugin = EmailValidatorPlugin(config)
        
        # Create HTTP server
        handler = create_handler(plugin)
        server = HTTPServer(('', port), handler)
        
        logger.info(f"Email validator plugin listening on port {port}")
        
        # Start server
        server.serve_forever()
        
    except KeyboardInterrupt:
        logger.info("Plugin stopped by user")
    except Exception as e:
        logger.error(f"Plugin failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()