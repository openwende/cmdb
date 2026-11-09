#!/bin/bash

# Wende CMDB Server Build Script
# This script builds the Docker image and optionally pushes to registry

set -euo pipefail

# Configuration
IMAGE_NAME=${IMAGE_NAME:-openwende/cmdb-server}
IMAGE_TAG=${IMAGE_TAG:-latest}
REGISTRY=${REGISTRY:-}
PLATFORM=${PLATFORM:-linux/amd64,linux/arm64}
PUSH=${PUSH:-false}
BUILD_ARGS=${BUILD_ARGS:-}

# Build information
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Wende CMDB Server Build Script

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --name NAME         Docker image name (default: openwende/cmdb-server)
    -t, --tag TAG           Docker image tag (default: latest)
    -r, --registry URL      Docker registry URL
    -p, --platform LIST     Build platforms (default: linux/amd64,linux/arm64)
    --push                  Push image to registry
    --no-cache              Build without cache
    --build-arg KEY=VALUE   Add build argument

EXAMPLES:
    # Build image locally
    $0 --name myregistry/cmdb --tag v1.0.0

    # Build and push to registry
    $0 --registry myregistry.com --push

    # Build for specific platform
    $0 --platform linux/amd64

    # Build with custom build args
    $0 --build-arg GO_VERSION=1.21

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if buildx is available for multi-platform builds
    if [[ "$PLATFORM" == *","* ]]; then
        if ! docker buildx version &> /dev/null; then
            log_error "Docker buildx is required for multi-platform builds"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    
    local full_image_name="$IMAGE_NAME:$IMAGE_TAG"
    if [[ -n "$REGISTRY" ]]; then
        full_image_name="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    fi
    
    log_info "Image: $full_image_name"
    log_info "Version: $VERSION"
    log_info "Commit: $COMMIT"
    log_info "Build Time: $BUILD_TIME"
    log_info "Platform(s): $PLATFORM"
    
    # Prepare build arguments
    local build_cmd_args=(
        "build"
        "--platform" "$PLATFORM"
        "--build-arg" "VERSION=$VERSION"
        "--build-arg" "COMMIT=$COMMIT"
        "--build-arg" "BUILD_TIME=$BUILD_TIME"
    )
    
    # Add custom build arguments
    if [[ -n "$BUILD_ARGS" ]]; then
        IFS=' ' read -ra ARGS <<< "$BUILD_ARGS"
        for arg in "${ARGS[@]}"; do
            build_cmd_args+=("--build-arg" "$arg")
        done
    fi
    
    # Add no-cache flag if specified
    if [[ "${NO_CACHE:-false}" == "true" ]]; then
        build_cmd_args+=("--no-cache")
    fi
    
    # Add push flag if specified
    if [[ "$PUSH" == "true" ]]; then
        if [[ "$PLATFORM" == *","* ]]; then
            # Use buildx for multi-platform push
            build_cmd_args+=("--push")
        else
            # Regular build and push
            build_cmd_args+=("--load")
        fi
    else
        if [[ "$PLATFORM" == *","* ]]; then
            log_warning "Multi-platform build without push will not load images locally"
        else
            build_cmd_args+=("--load")
        fi
    fi
    
    build_cmd_args+=("-t" "$full_image_name" ".")
    
    # Execute build command
    if [[ "$PLATFORM" == *","* ]]; then
        # Use buildx for multi-platform builds
        docker buildx "${build_cmd_args[@]}"
    else
        # Use regular docker build
        docker "${build_cmd_args[@]}"
    fi
    
    log_success "Docker image built successfully"
    
    # Push image if requested and not multi-platform
    if [[ "$PUSH" == "true" && "$PLATFORM" != *","* ]]; then
        log_info "Pushing image to registry..."
        docker push "$full_image_name"
        log_success "Image pushed successfully"
    fi
}

# Show image information
show_image_info() {
    local full_image_name="$IMAGE_NAME:$IMAGE_TAG"
    if [[ -n "$REGISTRY" ]]; then
        full_image_name="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    fi
    
    log_info "Build completed successfully!"
    echo ""
    echo "Image Details:"
    echo "  Name: $full_image_name"
    echo "  Version: $VERSION"
    echo "  Commit: $COMMIT"
    echo "  Build Time: $BUILD_TIME"
    echo "  Platform(s): $PLATFORM"
    echo ""
    
    if [[ "$PUSH" == "true" ]]; then
        echo "Image has been pushed to registry"
    else
        echo "Image is available locally"
        if [[ "$PLATFORM" != *","* ]]; then
            echo ""
            echo "To run the image:"
            echo "  docker run -p 8080:8080 $full_image_name"
        fi
    fi
}

# Main function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -n|--name)
                IMAGE_NAME="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -p|--platform)
                PLATFORM="$2"
                shift 2
                ;;
            --push)
                PUSH=true
                shift
                ;;
            --no-cache)
                NO_CACHE=true
                shift
                ;;
            --build-arg)
                if [[ -n "$BUILD_ARGS" ]]; then
                    BUILD_ARGS="$BUILD_ARGS $2"
                else
                    BUILD_ARGS="$2"
                fi
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "Starting CMDB Backend build..."
    
    check_prerequisites
    build_image
    show_image_info
}

# Run main function
main "$@"