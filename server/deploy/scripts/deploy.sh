#!/bin/bash

# WEND CMDB Backend Deployment Script
# This script helps deploy the CMDB backend to Kubernetes using either Helm or kubectl

set -euo pipefail

# Configuration
NAMESPACE=${NAMESPACE:-cmdb}
RELEASE_NAME=${RELEASE_NAME:-cmdb}
CHART_PATH=${CHART_PATH:-./deploy/helm/cmdb}
K8S_MANIFESTS_PATH=${K8S_MANIFESTS_PATH:-./deploy/k8s}
IMAGE_TAG=${IMAGE_TAG:-latest}
DEPLOYMENT_TYPE=${DEPLOYMENT_TYPE:-helm}  # helm or kubectl

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
WEND CMDB Backend Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -n, --namespace NAME    Kubernetes namespace (default: cmdb)
    -r, --release NAME      Helm release name (default: cmdb)
    -t, --tag TAG           Docker image tag (default: latest)
    -d, --deployment TYPE   Deployment type: helm or kubectl (default: helm)
    --dry-run              Perform a dry run
    --upgrade              Upgrade existing deployment
    --uninstall            Uninstall deployment

EXAMPLES:
    # Deploy using Helm
    $0 --deployment helm --namespace cmdb

    # Deploy using kubectl
    $0 --deployment kubectl --namespace cmdb

    # Upgrade existing deployment
    $0 --upgrade --tag v1.2.0

    # Dry run deployment
    $0 --dry-run

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check Helm if using Helm deployment
    if [[ "$DEPLOYMENT_TYPE" == "helm" ]]; then
        if ! command -v helm &> /dev/null; then
            log_error "Helm is not installed or not in PATH"
            exit 1
        fi
        
        if ! helm version &> /dev/null; then
            log_error "Cannot execute Helm commands"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Create namespace if it doesn't exist
ensure_namespace() {
    log_info "Ensuring namespace '$NAMESPACE' exists..."
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        kubectl create namespace "$NAMESPACE"
        log_success "Created namespace '$NAMESPACE'"
    else
        log_info "Namespace '$NAMESPACE' already exists"
    fi
}

# Deploy using Helm
deploy_with_helm() {
    log_info "Deploying with Helm..."
    
    local helm_args=(
        "$RELEASE_NAME"
        "$CHART_PATH"
        "--namespace" "$NAMESPACE"
        "--create-namespace"
        "--set" "image.tag=$IMAGE_TAG"
    )
    
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        helm_args+=("--dry-run" "--debug")
    fi
    
    if [[ "${UPGRADE:-false}" == "true" ]]; then
        log_info "Upgrading existing Helm release..."
        helm upgrade "${helm_args[@]}" --install
    else
        log_info "Installing new Helm release..."
        helm install "${helm_args[@]}"
    fi
    
    log_success "Helm deployment completed"
}

# Deploy using kubectl
deploy_with_kubectl() {
    log_info "Deploying with kubectl..."
    
    ensure_namespace
    
    # Update image tag in kustomization.yaml
    if [[ -f "$K8S_MANIFESTS_PATH/kustomization.yaml" ]]; then
        log_info "Updating image tag in kustomization.yaml..."
        sed -i.bak "s/newTag: .*/newTag: $IMAGE_TAG/" "$K8S_MANIFESTS_PATH/kustomization.yaml"
    fi
    
    local kubectl_args=("apply")
    
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        kubectl_args+=("--dry-run=client")
    fi
    
    # Use kustomize if available
    if [[ -f "$K8S_MANIFESTS_PATH/kustomization.yaml" ]]; then
        log_info "Deploying with Kustomize..."
        kubectl "${kubectl_args[@]}" -k "$K8S_MANIFESTS_PATH"
    else
        log_info "Deploying individual manifests..."
        kubectl "${kubectl_args[@]}" -f "$K8S_MANIFESTS_PATH/"
    fi
    
    log_success "kubectl deployment completed"
}

# Uninstall deployment
uninstall_deployment() {
    log_warning "Uninstalling deployment..."
    
    if [[ "$DEPLOYMENT_TYPE" == "helm" ]]; then
        if helm list -n "$NAMESPACE" | grep -q "$RELEASE_NAME"; then
            helm uninstall "$RELEASE_NAME" --namespace "$NAMESPACE"
            log_success "Helm release '$RELEASE_NAME' uninstalled"
        else
            log_warning "Helm release '$RELEASE_NAME' not found"
        fi
    else
        if [[ -f "$K8S_MANIFESTS_PATH/kustomization.yaml" ]]; then
            kubectl delete -k "$K8S_MANIFESTS_PATH" || true
        else
            kubectl delete -f "$K8S_MANIFESTS_PATH/" || true
        fi
        log_success "Kubernetes resources deleted"
    fi
}

# Wait for deployment to be ready
wait_for_deployment() {
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        return
    fi
    
    log_info "Waiting for deployment to be ready..."
    
    # Wait for deployment to be available
    if kubectl get deployment cmdb-backend -n "$NAMESPACE" &> /dev/null; then
        kubectl wait --for=condition=available deployment/cmdb-backend -n "$NAMESPACE" --timeout=600s
        log_success "Deployment is ready"
    else
        log_warning "Deployment not found, skipping readiness check"
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment status:"
    
    echo ""
    echo "Namespace: $NAMESPACE"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Image Tag: $IMAGE_TAG"
    
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        echo "Mode: DRY RUN"
        return
    fi
    
    echo ""
    log_info "Pods:"
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=cmdb || true
    
    echo ""
    log_info "Services:"
    kubectl get services -n "$NAMESPACE" -l app.kubernetes.io/name=cmdb || true
    
    echo ""
    log_info "Ingress:"
    kubectl get ingress -n "$NAMESPACE" || true
    
    if [[ "$DEPLOYMENT_TYPE" == "helm" ]]; then
        echo ""
        log_info "Helm releases:"
        helm list -n "$NAMESPACE" || true
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
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -r|--release)
                RELEASE_NAME="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -d|--deployment)
                DEPLOYMENT_TYPE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --upgrade)
                UPGRADE=true
                shift
                ;;
            --uninstall)
                UNINSTALL=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate deployment type
    if [[ "$DEPLOYMENT_TYPE" != "helm" && "$DEPLOYMENT_TYPE" != "kubectl" ]]; then
        log_error "Invalid deployment type: $DEPLOYMENT_TYPE. Must be 'helm' or 'kubectl'"
        exit 1
    fi
    
    log_info "Starting CMDB Backend deployment..."
    log_info "Configuration:"
    log_info "  Namespace: $NAMESPACE"
    log_info "  Deployment Type: $DEPLOYMENT_TYPE"
    log_info "  Image Tag: $IMAGE_TAG"
    
    if [[ "${UNINSTALL:-false}" == "true" ]]; then
        uninstall_deployment
        exit 0
    fi
    
    check_prerequisites
    
    if [[ "$DEPLOYMENT_TYPE" == "helm" ]]; then
        deploy_with_helm
    else
        deploy_with_kubectl
    fi
    
    wait_for_deployment
    show_status
    
    log_success "CMDB Backend deployment completed successfully!"
}

# Run main function
main "$@"