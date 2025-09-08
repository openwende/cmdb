#!/usr/bin/env python3
"""
Slack Notifier Plugin for WEND CMDB
Sends notifications to Slack channels via webhooks
"""

import os
import json
import requests
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SlackNotifierPlugin:
    def __init__(self, config=None):
        self.config = config or {}
        self.webhook_url = self.config.get('webhook_url', '')
        self.channel = self.config.get('channel', '#alerts')
        self.username = self.config.get('username', 'CMDB Bot')
        self.icon_emoji = self.config.get('icon_emoji', ':robot_face:')
        self.include_metadata = self.config.get('include_metadata', True)
        self.severity_colors = self.config.get('severity_colors', {
            'info': '#36a64f',
            'warning': '#ff9900',
            'error': '#ff0000',
            'critical': '#8b0000'
        })
        
        logger.info(f"Slack notifier initialized with config: {self.config}")
    
    def notify(self, event, options=None):
        """Send notification to Slack"""
        try:
            if not self.webhook_url:
                return {"success": False, "error": "Webhook URL not configured"}
            
            # Build Slack message
            message = self._build_slack_message(event, options)
            
            # Send to Slack
            response = requests.post(
                self.webhook_url,
                json=message,
                timeout=30,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                logger.info(f"Slack notification sent successfully for event {event.get('id', 'unknown')}")
                return {
                    "success": True,
                    "message": "Notification sent to Slack",
                    "channel": message.get('channel', self.channel)
                }
            else:
                error_msg = f"Slack API returned status {response.status_code}: {response.text}"
                logger.error(error_msg)
                return {"success": False, "error": error_msg}
                
        except requests.RequestException as e:
            error_msg = f"Failed to send Slack notification: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
    
    def validate_config(self, config=None):
        """Validate plugin configuration"""
        config = config or self.config
        
        errors = []
        
        # Check webhook URL
        webhook_url = config.get('webhook_url', '')
        if not webhook_url:
            errors.append("webhook_url is required")
        elif not webhook_url.startswith('https://hooks.slack.com/'):
            errors.append("webhook_url must be a valid Slack webhook URL")
        
        # Check channel format
        channel = config.get('channel', '')
        if channel and not (channel.startswith('#') or channel.startswith('@')):
            errors.append("channel must start with # or @")
        
        if errors:
            return {"valid": False, "errors": errors}
        
        return {"valid": True}
    
    def test_connection(self, options=None):
        """Test connection to Slack"""
        try:
            if not self.webhook_url:
                return {"success": False, "error": "Webhook URL not configured"}
            
            # Send test message
            test_message = {
                "channel": self.channel,
                "username": self.username,
                "icon_emoji": self.icon_emoji,
                "text": "Test notification from CMDB",
                "attachments": [{
                    "color": "#36a64f",
                    "fields": [{
                        "title": "Status",
                        "value": "Connection test successful",
                        "short": True
                    }, {
                        "title": "Time",
                        "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "short": True
                    }]
                }]
            }
            
            response = requests.post(
                self.webhook_url,
                json=test_message,
                timeout=30,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Test notification sent successfully",
                    "channel": self.channel
                }
            else:
                return {
                    "success": False,
                    "error": f"Slack API returned status {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _build_slack_message(self, event, options=None):
        """Build Slack message from event"""
        options = options or {}
        
        # Override channel if specified in options
        channel = options.get('channel', self.channel)
        
        # Get severity color
        severity = event.get('severity', 'info')
        color = self.severity_colors.get(severity, '#808080')
        
        # Build main message
        title = event.get('title', 'CMDB Event')
        description = event.get('description', '')
        
        # Build attachment fields
        fields = []
        
        # Add basic event info
        fields.append({
            "title": "Event Type",
            "value": event.get('type', 'unknown'),
            "short": True
        })
        
        fields.append({
            "title": "Severity",
            "value": severity.title(),
            "short": True
        })
        
        if event.get('resource_type'):
            fields.append({
                "title": "Resource",
                "value": f"{event.get('resource_type')}/{event.get('resource_id', 'unknown')}",
                "short": True
            })
        
        if event.get('user_id'):
            fields.append({
                "title": "User",
                "value": event.get('user_id'),
                "short": True
            })
        
        # Add timestamp
        timestamp = event.get('timestamp')
        if timestamp:
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    timestamp = datetime.now()
            elif isinstance(timestamp, datetime):
                pass
            else:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()
        
        fields.append({
            "title": "Time",
            "value": timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "short": True
        })
        
        # Add source information
        if event.get('source'):
            source = event['source']
            source_info = f"{source.get('name', 'Unknown')} ({source.get('type', 'unknown')})"
            fields.append({
                "title": "Source",
                "value": source_info,
                "short": True
            })
        
        # Add metadata if enabled
        if self.include_metadata and event.get('metadata'):
            metadata_text = ""
            for key, value in event['metadata'].items():
                if len(metadata_text) > 500:  # Limit metadata size
                    metadata_text += "..."
                    break
                metadata_text += f"• {key}: {value}\n"
            
            if metadata_text:
                fields.append({
                    "title": "Metadata",
                    "value": metadata_text.strip(),
                    "short": False
                })
        
        # Add tags if present
        if event.get('tags'):
            tags_text = ", ".join(event['tags'])
            fields.append({
                "title": "Tags",
                "value": tags_text,
                "short": False
            })
        
        # Build Slack message
        message = {
            "channel": channel,
            "username": self.username,
            "icon_emoji": self.icon_emoji,
            "text": f"*{title}*",
            "attachments": [{
                "color": color,
                "text": description,
                "fields": fields,
                "footer": "WEND CMDB",
                "footer_icon": "https://example.com/cmdb-icon.png",
                "ts": int(timestamp.timestamp())
            }]
        }
        
        return message

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
            if operation == 'notify':
                result = self.plugin.notify(
                    params.get('event'),
                    params.get('options')
                )
            elif operation == 'validate_config':
                result = self.plugin.validate_config(params.get('config'))
            elif operation == 'test_connection':
                result = self.plugin.test_connection(params.get('options'))
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
            "plugin_id": "slack-notifier",
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
                "id": "slack-notifier",
                "name": "Slack Notification Plugin",
                "version": "1.0.0",
                "type": "notifier",
                "status": "running",
                "config": self.plugin.config,
                "supported_operations": [
                    "notify",
                    "validate_config",
                    "test_connection"
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
        plugin_id = os.environ.get('CMDB_PLUGIN_ID', 'slack-notifier')
        port = int(os.environ.get('CMDB_PLUGIN_PORT', '8003'))
        config_str = os.environ.get('CMDB_PLUGIN_CONFIG', '{}')
        
        # Parse configuration
        try:
            config = json.loads(config_str)
        except json.JSONDecodeError:
            logger.warning(f"Invalid config JSON, using defaults: {config_str}")
            config = {}
        
        logger.info(f"Starting Slack notifier plugin on port {port}")
        logger.info(f"Plugin ID: {plugin_id}")
        logger.info(f"Configuration: {config}")
        
        # Create plugin instance
        plugin = SlackNotifierPlugin(config)
        
        # Create HTTP server
        handler = create_handler(plugin)
        server = HTTPServer(('', port), handler)
        
        logger.info(f"Slack notifier plugin listening on port {port}")
        
        # Start server
        server.serve_forever()
        
    except KeyboardInterrupt:
        logger.info("Plugin stopped by user")
    except Exception as e:
        logger.error(f"Plugin failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()